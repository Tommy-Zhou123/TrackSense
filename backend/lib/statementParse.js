import { GoogleGenAI } from "@google/genai";
import { PDFParse } from "pdf-parse";
import { geminiApiKey, geminiModel } from "../config.js";
import {
	GEMINI_TIMEOUT_MS,
	MAX_IMPORT_ROWS,
	MAX_PDF_PAGES,
} from "./rateLimit.js";

const MIN_TEXT_CHARS = 200;
const MAX_TEXT_CHARS = 40_000;
const MAX_FIELD_CHARS = 500;

const EXTRACT_PROMPT = `Extract every posted transaction from this credit card or bank statement.

Return only posted transaction rows. Ignore APR, interest rates, credit limit, available credit, payment due date, minimum payment, rewards ads, marketing, page headers/footers, and account-summary totals that are not individual posted transactions.

Rules:
- date: ISO YYYY-MM-DD
- vendor: merchant or description line (not the card number)
- amount: numeric, as on the statement (charges/purchases typically negative or as printed; payments/credits/refunds as printed)
- account: card or account nickname if clearly labeled, otherwise empty
- notes: optional extra detail (reference id). Never include a full card number.

Do not invent transactions. Do not drop posted purchases, fees, or interest charges. Extract everything and let the user exclude rows later.`;

const RESPONSE_SCHEMA = {
	type: "object",
	properties: {
		transactions: {
			type: "array",
			items: {
				type: "object",
				properties: {
					date: {
						type: "string",
						description: "Posted date as YYYY-MM-DD",
					},
					vendor: { type: "string" },
					amount: { type: "number" },
					account: { type: "string" },
					notes: { type: "string" },
				},
				required: ["date", "vendor", "amount"],
			},
		},
	},
	required: ["transactions"],
};

export function maskPan(value) {
	if (value == null) return "";
	return String(value).replace(/\b(?:\d[ \-]*){13,19}\b/g, "[redacted]");
}

function clip(value) {
	const text = maskPan(String(value || "").trim());
	if (text.length <= MAX_FIELD_CHARS) return text;
	return text.slice(0, MAX_FIELD_CHARS);
}

function pad(n) {
	return String(n).padStart(2, "0");
}

function isoFromParts(year, month, day) {
	if (month < 1 || month > 12 || day < 1 || day > 31) return null;
	if (year < 1990 || year > 2100) return null;
	const iso = `${year}-${pad(month)}-${pad(day)}`;
	const date = new Date(`${iso}T00:00:00.000Z`);
	if (Number.isNaN(date.getTime())) return null;
	if (date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return null;
	return iso;
}

export function parseDateToIso(value) {
	if (value == null) return null;
	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		return value.toISOString().slice(0, 10);
	}

	const v = String(value).trim();
	if (!v) return null;

	let match = v.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
	if (match) {
		return isoFromParts(Number(match[1]), Number(match[2]), Number(match[3]));
	}

	match = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
	if (match) {
		const first = Number(match[1]);
		const second = Number(match[2]);
		let year = Number(match[3]);
		if (year < 100) year += 2000;
		if (first > 12) return isoFromParts(year, second, first);
		if (second > 12) return isoFromParts(year, first, second);
		return isoFromParts(year, first, second);
	}

	const parsed = new Date(v);
	if (Number.isNaN(parsed.getTime())) return null;
	return parsed.toISOString().slice(0, 10);
}

export function parseAmount(value) {
	if (typeof value === "number" && Number.isFinite(value)) {
		return Math.round(value * 100) / 100;
	}
	const v = String(value || "").trim();
	if (!v) return null;
	const negative = /^\(.*\)$/.test(v);
	const cleaned = v
		.replace(/[()$£€¥]/g, "")
		.replace(/cad|usd|eur|gbp/gi, "")
		.replace(/,/g, "")
		.trim();
	const amount = Number(cleaned);
	if (!Number.isFinite(amount)) return null;
	const signed = negative ? -Math.abs(amount) : amount;
	return Math.round(signed * 100) / 100;
}

function isRetryableGeminiError(err) {
	const message = String(err?.message || "");
	return (
		err?.status === 503 ||
		err?.code === 503 ||
		message.includes('"code":503') ||
		message.includes("UNAVAILABLE") ||
		message.includes("high demand")
	);
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function extractPdfText(buffer) {
	let parser;
	try {
		parser = new PDFParse({ data: Uint8Array.from(buffer) });
		const result = await parser.getText();
		return {
			text: (result.text || "").trim(),
			pages: Number(result.total) || 0,
		};
	} finally {
		if (parser) await parser.destroy().catch(() => {});
	}
}

function parseModelJson(raw) {
	const trimmed = String(raw || "")
		.trim()
		.replace(/^```(?:json)?\s*/i, "")
		.replace(/\s*```$/, "");
	return JSON.parse(trimmed);
}

async function generateOnce({ ai, contents, abortSignal }) {
	const response = await ai.models.generateContent({
		model: geminiModel,
		contents,
		config: {
			abortSignal,
			temperature: 0,
			maxOutputTokens: 8192,
			thinkingConfig: { thinkingLevel: "low" },
			responseMimeType: "application/json",
			responseSchema: RESPONSE_SCHEMA,
		},
	});
	return {
		text: response?.text,
		finishReason: response?.candidates?.[0]?.finishReason,
	};
}

async function extractWithGemini({ text, pdfBuffer, scanned }) {
	if (!geminiApiKey) {
		const err = new Error("Statement parsing is not configured");
		err.status = 503;
		throw err;
	}

	const ai = new GoogleGenAI({ apiKey: geminiApiKey });
	const contents = scanned
		? [
				{
					inlineData: {
						mimeType: "application/pdf",
						data: pdfBuffer.toString("base64"),
					},
				},
				EXTRACT_PROMPT,
			]
		: `${EXTRACT_PROMPT}\n\n---\n${text}`;

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
	let lastError;
	try {
		for (let attempt = 0; attempt < 2; attempt++) {
			try {
				const result = await generateOnce({
					ai,
					contents,
					abortSignal: controller.signal,
				});
				const raw = result.text;
				console.log(
					maskPan(
						`[parse-statement] gemini ${geminiModel} scanned=${scanned} attempt=${attempt + 1} finish=${result.finishReason || "unknown"}\n${raw || "(empty)"}`
					)
				);
				if (!raw) {
					const err = new Error(
						"Could not extract transactions from this statement"
					);
					err.status = 422;
					throw err;
				}
				try {
					return parseModelJson(raw);
				} catch {
					const err = new Error(
						"Could not extract transactions from this statement"
					);
					err.status = 422;
					throw err;
				}
			} catch (err) {
				lastError = err;
				if (controller.signal.aborted || err?.name === "AbortError") {
					const timeout = new Error("Statement parsing timed out");
					timeout.status = 504;
					throw timeout;
				}
				if (err?.status === 422) throw err;
				if (attempt === 0 && isRetryableGeminiError(err)) {
					await sleep(2000);
					continue;
				}
				throw err;
			}
		}
	} finally {
		clearTimeout(timer);
	}

	throw lastError;
}

export function validateTransactions(payload) {
	const rows = Array.isArray(payload?.transactions)
		? payload.transactions
		: Array.isArray(payload)
			? payload
			: [];

	const expenses = [];
	let skipped = 0;

	for (const row of rows) {
		const date = parseDateToIso(row?.date);
		const vendor = clip(row?.vendor);
		const amount = parseAmount(row?.amount);
		if (!date || !vendor || amount == null) {
			skipped += 1;
			continue;
		}

		expenses.push({
			date,
			account: clip(row?.account),
			vendor,
			amount,
			category: clip(row?.category),
			notes: clip(row?.notes),
		});
	}

	let truncated = false;
	if (expenses.length > MAX_IMPORT_ROWS) {
		skipped += expenses.length - MAX_IMPORT_ROWS;
		expenses.length = MAX_IMPORT_ROWS;
		truncated = true;
	}

	return {
		expenses,
		skipped,
		truncated,
		hasAccount: expenses.length > 0 && expenses.every((row) => row.account),
	};
}

export async function parseStatementPdf(buffer) {
	const warnings = [];
	let extracted;
	try {
		extracted = await extractPdfText(buffer);
	} catch {
		extracted = { text: "", pages: 0 };
	}

	if (extracted.pages > MAX_PDF_PAGES) {
		const err = new Error(
			`PDF is limited to ${MAX_PDF_PAGES} pages. Split the statement and try again.`
		);
		err.status = 400;
		throw err;
	}

	const text = extracted.text.slice(0, MAX_TEXT_CHARS);
	const scanned = text.length < MIN_TEXT_CHARS;
	if (scanned) {
		warnings.push(
			"This looks like a scanned or image-based statement. OCR may miss or misread rows — review before importing."
		);
	} else if (extracted.text.length > MAX_TEXT_CHARS) {
		warnings.push(
			"Only the first part of this statement was sent for extraction. Review the preview for missing rows."
		);
	}

	let payload;
	try {
		payload = await extractWithGemini({
			text,
			pdfBuffer: buffer,
			scanned,
		});
	} catch (err) {
		if (err.status === 504 || err.message === "Statement parsing timed out") {
			const timeout = new Error(
				"Statement parsing timed out. Try a shorter PDF."
			);
			timeout.status = 504;
			throw timeout;
		}
		if (isRetryableGeminiError(err)) {
			const busy = new Error(
				"Statement parsing is busy right now. Please try again in a moment."
			);
			busy.status = 503;
			throw busy;
		}
		if (err.status) throw err;
		const wrapped = new Error(
			"Could not extract transactions from this statement"
		);
		wrapped.status = 502;
		throw wrapped;
	}

	const result = validateTransactions(payload);
	if (result.expenses.length === 0) {
		const err = new Error(
			"No valid transactions were found in this statement"
		);
		err.status = 422;
		throw err;
	}

	if (result.skipped > 0) {
		warnings.push(
			`${result.skipped} row${result.skipped === 1 ? "" : "s"} could not be validated and ${result.skipped === 1 ? "was" : "were"} skipped.`
		);
	}
	if (result.truncated) {
		warnings.push(
			`Only the first ${MAX_IMPORT_ROWS} transactions were kept.`
		);
	}

	return {
		expenses: result.expenses,
		skipped: result.skipped,
		warnings,
		hasAccount: result.hasAccount,
	};
}
