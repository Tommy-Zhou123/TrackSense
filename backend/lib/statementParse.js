import { GoogleGenAI } from "@google/genai";
import { createRequire } from "node:module";
import {
  geminiApiKey,
  geminiModels,
  groqApiKey,
  groqModels,
  groqVisionModel,
} from "../config.js";
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
  if (date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day)
    return null;
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

function isRetryableLlmError(err) {
	const message = String(err?.message || "");
	const status = err?.status ?? err?.code;
	return (
		status === 503 ||
		status === 429 ||
		status === 404 ||
		status === 413 ||
		message.includes('"code":503') ||
		message.includes('"code":429') ||
		message.includes("UNAVAILABLE") ||
		message.includes("RESOURCE_EXHAUSTED") ||
		message.includes("high demand") ||
		message.includes("overloaded") ||
		message.includes("not found") ||
		message.includes("json_validate_failed")
	);
}

const require = createRequire(import.meta.url);

function loadPdfjs() {
  const canvas = require("canvas");
  if (canvas.DOMMatrix) globalThis.DOMMatrix = canvas.DOMMatrix;
  if (canvas.Path2D) globalThis.Path2D = canvas.Path2D;
  if (canvas.ImageData) globalThis.ImageData = canvas.ImageData;

  const pdfjs = require("pdfjs-dist/legacy/build/pdf.js");
  pdfjs.GlobalWorkerOptions.workerSrc =
    require.resolve("pdfjs-dist/legacy/build/pdf.worker.js");
  return pdfjs;
}

export async function extractPdfText(buffer) {
  const pdfjs = loadPdfjs();
  const loadingTask = pdfjs.getDocument({
    data: Uint8Array.from(buffer),
    disableFontFace: true,
    isEvalSupported: false,
    useSystemFonts: true,
    verbosity: 0,
  });
  const doc = await loadingTask.promise;
  try {
    const pages = doc.numPages;
    const parts = [];
    for (let pageNum = 1; pageNum <= pages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const content = await page.getTextContent();
      parts.push(
        content.items
          .map((item) => (typeof item.str === "string" ? item.str : ""))
          .join(" "),
      );
    }
    return {
      text: parts.join("\n").trim(),
      pages,
    };
  } finally {
    await doc.destroy();
  }
}

function parseJsonValue(raw) {
	const trimmed = String(raw || "")
		.trim()
		.replace(/^```(?:json)?\s*/i, "")
		.replace(/\s*```$/, "");
	try {
		return JSON.parse(trimmed);
	} catch {
		const objectStart = trimmed.indexOf("{");
		const objectEnd = trimmed.lastIndexOf("}");
		if (objectStart >= 0 && objectEnd > objectStart) {
			try {
				return JSON.parse(trimmed.slice(objectStart, objectEnd + 1));
			} catch {
				// fall through to array
			}
		}
		const arrayStart = trimmed.indexOf("[");
		const arrayEnd = trimmed.lastIndexOf("]");
		if (arrayStart >= 0 && arrayEnd > arrayStart) {
			return JSON.parse(trimmed.slice(arrayStart, arrayEnd + 1));
		}
		throw new SyntaxError("No JSON object in model output");
	}
}

function parseModelJson(raw) {
	const parsed = parseJsonValue(raw);
	if (Array.isArray(parsed)) return { transactions: parsed };
	return parsed;
}

async function generateOnce({ ai, model, contents, abortSignal }) {
	const config = {
		abortSignal,
		temperature: 0,
		maxOutputTokens: 8192,
		responseMimeType: "application/json",
		responseSchema: RESPONSE_SCHEMA,
	};
	if (/^gemini-3/.test(model)) {
		config.thinkingConfig = { thinkingLevel: "low" };
	}

	const response = await ai.models.generateContent({
		model,
		contents,
		config,
	});
	return {
		text: response?.text,
		finishReason: response?.candidates?.[0]?.finishReason,
	};
}

async function extractWithGemini({ text, pdfBuffer, scanned, abortSignal }) {
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

	let lastError;
	for (let i = 0; i < geminiModels.length; i++) {
		const model = geminiModels[i];
		try {
			const result = await generateOnce({
				ai,
				model,
				contents,
				abortSignal,
			});
			const raw = result.text;
			console.log(
				maskPan(
					`[parse-statement] gemini ${model} scanned=${scanned} finish=${result.finishReason || "unknown"}\n${raw || "(empty)"}`
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
			if (abortSignal.aborted || err?.name === "AbortError") {
				const timeout = new Error("Statement parsing timed out");
				timeout.status = 504;
				throw timeout;
			}
			if (i < geminiModels.length - 1 && isRetryableLlmError(err)) {
				console.log(
					`[parse-statement] ${model} unavailable, trying ${geminiModels[i + 1]}`
				);
				continue;
			}
			throw err;
		}
	}

	throw lastError;
}

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MAX_GROQ_IMAGES = 8;

async function renderPdfPageImages(buffer, pageCount) {
	const pdfjs = loadPdfjs();
	const canvasLib = require("canvas");
	const loadingTask = pdfjs.getDocument({
		data: Uint8Array.from(buffer),
		disableFontFace: true,
		isEvalSupported: false,
		useSystemFonts: true,
		verbosity: 0,
	});
	const doc = await loadingTask.promise;
	try {
		const pages = Math.min(pageCount || doc.numPages, MAX_GROQ_IMAGES);
		const images = [];
		for (let pageNum = 1; pageNum <= pages; pageNum++) {
			const page = await doc.getPage(pageNum);
			const viewport = page.getViewport({ scale: 1.15 });
			const canvas = canvasLib.createCanvas(
				Math.ceil(viewport.width),
				Math.ceil(viewport.height)
			);
			await page.render({
				canvasContext: canvas.getContext("2d"),
				viewport,
			}).promise;
			images.push(canvas.toDataURL("image/jpeg", 0.65));
		}
		return images;
	} finally {
		await doc.destroy();
	}
}

async function generateGroqOnce({ model, messages, abortSignal }) {
	const response = await fetch(GROQ_URL, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${groqApiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model,
			temperature: 0,
			max_completion_tokens: 8192,
			include_reasoning: false,
			messages,
		}),
		signal: abortSignal,
	});
	const rawBody = await response.text();
	if (!response.ok) {
		const err = new Error(rawBody.slice(0, 800) || `Groq HTTP ${response.status}`);
		err.status = response.status;
		throw err;
	}
	const payload = JSON.parse(rawBody);
	const message = payload?.choices?.[0]?.message || {};
	return message.content || message.reasoning || "";
}

async function extractWithGroq({ text, pdfBuffer, scanned, abortSignal }) {
	let images = [];
	if (scanned) {
		try {
			images = await renderPdfPageImages(pdfBuffer, MAX_GROQ_IMAGES);
		} catch (err) {
			console.log(
				`[parse-statement] groq could not render PDF pages: ${err?.message || err}`
			);
		}
	}

	const models = groqVisionModel && images.length
		? [groqVisionModel, ...groqModels.filter((model) => model !== groqVisionModel)]
		: groqModels;

	const jsonHint =
		'Return JSON only, as {"transactions":[{"date":"YYYY-MM-DD","vendor":"","amount":0,"account":"","notes":""}]}';
	const userContent = groqVisionModel && images.length
		? [
				{ type: "text", text: `${EXTRACT_PROMPT}\n\n${jsonHint}` },
				...images.map((url) => ({
					type: "image_url",
					image_url: { url },
				})),
			]
		: `${EXTRACT_PROMPT}\n\n${jsonHint}\n\n---\n${text}`;

	const messages = [
		{
			role: "system",
			content:
				"You extract posted bank and credit-card transactions. Reply with JSON only.",
		},
		{ role: "user", content: userContent },
	];

	let lastError;
	for (let i = 0; i < models.length; i++) {
		const model = models[i];
		try {
			const raw = await generateGroqOnce({ model, messages, abortSignal });
			console.log(
				maskPan(
					`[parse-statement] groq ${model} scanned=${scanned} images=${images.length}\n${raw || "(empty)"}`
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
			if (abortSignal.aborted || err?.name === "AbortError") {
				const timeout = new Error("Statement parsing timed out");
				timeout.status = 504;
				throw timeout;
			}
			if (
				i < models.length - 1 &&
				(isRetryableLlmError(err) || err?.status === 422)
			) {
				console.log(
					`[parse-statement] groq ${model} unavailable, trying ${models[i + 1]}: ${String(err.message || err).slice(0, 180)}`
				);
				continue;
			}
			throw err;
		}
	}

	throw lastError;
}

async function extractTransactions({ text, pdfBuffer, scanned }) {
	if (!geminiApiKey && !groqApiKey) {
		const err = new Error("Statement parsing is not configured");
		err.status = 503;
		throw err;
	}

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
	let lastError;
	try {
		if (geminiApiKey) {
			try {
				return await extractWithGemini({
					text,
					pdfBuffer,
					scanned,
					abortSignal: controller.signal,
				});
			} catch (err) {
				lastError = err;
				if (err?.status === 504 || err?.name === "AbortError") throw err;
				if (groqApiKey && (isRetryableLlmError(err) || err?.status === 422)) {
					console.log("[parse-statement] gemini unavailable, trying groq");
				} else {
					throw err;
				}
			}
		}

		if (groqApiKey) {
			return await extractWithGroq({
				text,
				pdfBuffer,
				scanned,
				abortSignal: controller.signal,
			});
		}

		throw lastError;
	} finally {
		clearTimeout(timer);
	}
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
      `PDF is limited to ${MAX_PDF_PAGES} pages. Split the statement and try again.`,
    );
    err.status = 400;
    throw err;
  }

  const text = extracted.text.slice(0, MAX_TEXT_CHARS);
  const scanned = text.length < MIN_TEXT_CHARS;
  if (scanned) {
    warnings.push(
      "This looks like a scanned or image-based statement. OCR may miss or misread rows — review before importing.",
    );
  } else if (extracted.text.length > MAX_TEXT_CHARS) {
    warnings.push(
      "Only the first part of this statement was sent for extraction. Review the preview for missing rows.",
    );
  }

  let payload;
  try {
    payload = await extractTransactions({
      text,
      pdfBuffer: buffer,
      scanned,
    });
  } catch (err) {
    if (err.status === 504 || err.message === "Statement parsing timed out") {
      const timeout = new Error(
        "Statement parsing timed out. Try a shorter PDF.",
      );
      timeout.status = 504;
      throw timeout;
    }
    if (isRetryableLlmError(err)) {
      const busy = new Error(
        "Statement parsing is busy right now. Please try again in a moment.",
      );
      busy.status = 503;
      throw busy;
    }
    if (err.status) throw err;
    const wrapped = new Error(
      "Could not extract transactions from this statement",
    );
    wrapped.status = 502;
    throw wrapped;
  }

  const result = validateTransactions(payload);
  if (result.expenses.length === 0) {
    const err = new Error("No valid transactions were found in this statement");
    err.status = 422;
    throw err;
  }

  if (result.skipped > 0) {
    warnings.push(
      `${result.skipped} row${result.skipped === 1 ? "" : "s"} could not be validated and ${result.skipped === 1 ? "was" : "were"} skipped.`,
    );
  }
  if (result.truncated) {
    warnings.push(`Only the first ${MAX_IMPORT_ROWS} transactions were kept.`);
  }

  return {
    expenses: result.expenses,
    skipped: result.skipped,
    warnings,
    hasAccount: result.hasAccount,
  };
}
