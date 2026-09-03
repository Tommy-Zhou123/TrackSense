import type { ColumnField, ColumnMapping, CsvInspection, CsvParseResult, DateOrder, ParsedExpense } from "@/types/csvImport";
import {
    ACCOUNT_HEADERS,
    AMOUNT_HEADERS,
    CATEGORY_HEADERS,
    COLUMN_FIELDS,
    CREDIT_HEADERS,
    DATE_HEADERS,
    DEBIT_HEADERS,
    EXACT_ONLY_ALIASES,
    NOTES_HEADERS,
    UNMAPPED,
    VENDOR_HEADERS,
} from "@/constants/csvImport";

function normalizeHeader(header: string): string {
    return header
        .replace(/^\uFEFF/, "")
        .trim()
        .toLowerCase()
        .replace(/[$£€¥]/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .replace(/\s+/g, " ");
}

function matchScore(header: string, alias: string): number {
    if (!header || !alias) return 0;
    if (header === alias) return 100;
    if (EXACT_ONLY_ALIASES.has(alias)) return 0;
    if (alias.length <= 3) {
        if (header.startsWith(`${alias} `)) return 70;
        if (header.endsWith(` ${alias}`)) return 65;
        return 0;
    }
    if (header.startsWith(`${alias} `)) return 85;
    if (header.endsWith(` ${alias}`)) return 75;
    const words = header.split(" ");
    if (alias.length >= 5 && words.includes(alias)) return 60;
    return 0;
}

function headerIndex(headers: string[], aliases: string[], used?: Set<number>): number {
    let bestIdx = UNMAPPED;
    let bestScore = 0;
    for (let aliasPriority = 0; aliasPriority < aliases.length; aliasPriority++) {
        const alias = aliases[aliasPriority];
        for (let i = 0; i < headers.length; i++) {
            if (used?.has(i)) continue;
            const score = matchScore(headers[i], alias);
            if (score === 0) continue;
            const weighted = score * 1000 - aliasPriority * 10 - i;
            if (weighted > bestScore) {
                bestScore = weighted;
                bestIdx = i;
            }
        }
    }
    return bestIdx;
}

function pickColumn(headers: string[], aliases: string[], used: Set<number>): number {
    const idx = headerIndex(headers, aliases, used);
    if (idx !== UNMAPPED) used.add(idx);
    return idx;
}

function isValidDate(date: Date): boolean {
    return !Number.isNaN(date.getTime());
}

function pad(n: number): string {
    return n.toString().padStart(2, "0");
}

function dateFromParts(year: number, month: number, day: number): Date | null {
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const date = new Date(`${year}-${pad(month)}-${pad(day)}T00:00:00.000Z`);
    return isValidDate(date) ? date : null;
}

export function parseDate(value: string, order: DateOrder = "mdy"): Date | null {
    const v = value.trim();
    if (!v) return null;

    let match = v.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
    if (match) {
        return dateFromParts(Number(match[1]), Number(match[2]), Number(match[3]));
    }

    match = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
    if (match) {
        const first = Number(match[1]);
        const second = Number(match[2]);
        let year = Number(match[3]);
        if (year < 100) year += 2000;
        if (first > 12) return dateFromParts(year, second, first);
        if (second > 12) return dateFromParts(year, first, second);
        return order === "mdy"
            ? dateFromParts(year, first, second)
            : dateFromParts(year, second, first);
    }

    const parsed = new Date(v);
    return isValidDate(parsed) ? parsed : null;
}

export function parseAmount(value: string): number | null {
    const v = value.trim();
    if (!v) return null;
    const negative = /^\(.*\)$/.test(v);
    const cleaned = v.replace(/[()$£€¥]/g, "").replace(/cad|usd|eur|gbp/gi, "").replace(/,/g, "").trim();
    const amount = Number(cleaned);
    if (!Number.isFinite(amount)) return null;
    return negative ? -Math.abs(amount) : amount;
}

function detectDelimiter(text: string): string {
    const firstLine = text.split(/\r?\n/).find((line) => line.trim()) || "";
    const commas = (firstLine.match(/,/g) || []).length;
    const semis = (firstLine.match(/;/g) || []).length;
    const tabs = (firstLine.match(/\t/g) || []).length;
    if (tabs > commas && tabs > semis) return "\t";
    if (semis > commas) return ";";
    return ",";
}

export function parseCsv(text: string): string[][] {
    const input = text.replace(/^\uFEFF/, "");
    const delimiter = detectDelimiter(input);
    const rows: string[][] = [];
    let row: string[] = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < input.length; i++) {
        const char = input[i];
        if (inQuotes) {
            if (char === '"') {
                if (input[i + 1] === '"') {
                    field += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                field += char;
            }
        } else if (char === '"') {
            inQuotes = true;
        } else if (char === delimiter) {
            row.push(field);
            field = "";
        } else if (char === "\n") {
            row.push(field);
            if (row.some((cell) => cell.trim() !== "")) rows.push(row);
            row = [];
            field = "";
        } else if (char !== "\r") {
            field += char;
        }
    }

    row.push(field);
    if (row.some((cell) => cell.trim() !== "")) rows.push(row);
    return rows;
}

function findHeaderRow(rows: string[][]): number {
    const limit = Math.min(rows.length, 15);
    for (let i = 0; i < limit; i++) {
        const headers = rows[i].map(normalizeHeader);
        const hasDate = headerIndex(headers, DATE_HEADERS) !== UNMAPPED;
        const hasAmount =
            headerIndex(headers, AMOUNT_HEADERS) !== UNMAPPED ||
            headerIndex(headers, DEBIT_HEADERS) !== UNMAPPED ||
            headerIndex(headers, CREDIT_HEADERS) !== UNMAPPED;
        if (hasDate && hasAmount) return i;
    }
    return 0;
}

export function suggestColumnMapping(headers: string[]): ColumnMapping {
    const used = new Set<number>();
    return {
        date: pickColumn(headers, DATE_HEADERS, used),
        amount: pickColumn(headers, AMOUNT_HEADERS, used),
        debit: pickColumn(headers, DEBIT_HEADERS, used),
        credit: pickColumn(headers, CREDIT_HEADERS, used),
        vendor: pickColumn(headers, VENDOR_HEADERS, used),
        account: pickColumn(headers, ACCOUNT_HEADERS, used),
        category: pickColumn(headers, CATEGORY_HEADERS, used),
        notes: pickColumn(headers, NOTES_HEADERS, used),
    };
}

export function mappingError(mapping: ColumnMapping): string {
    if (mapping.date === UNMAPPED) return "Map a Date column.";
    if (mapping.vendor === UNMAPPED) return "Map a Vendor / Description column.";
    if (mapping.amount === UNMAPPED && mapping.debit === UNMAPPED && mapping.credit === UNMAPPED) {
        return "Map an Amount column, or Debit and/or Credit.";
    }
    return "";
}

export function columnSamples(rows: string[][], index: number, limit = 3): string[] {
    if (index < 0) return [];
    const samples: string[] = [];
    for (const row of rows) {
        const value = (row[index] || "").trim();
        if (value && !samples.includes(value)) samples.push(value);
        if (samples.length >= limit) break;
    }
    return samples;
}

export function fieldForColumn(mapping: ColumnMapping, columnIndex: number): ColumnField | "" {
    for (const field of COLUMN_FIELDS) {
        if (mapping[field.key] === columnIndex) return field.key;
    }
    return "";
}

export function assignColumnField(
    mapping: ColumnMapping,
    columnIndex: number,
    field: ColumnField | "",
): ColumnMapping {
    const next = { ...mapping };
    for (const item of COLUMN_FIELDS) {
        if (next[item.key] === columnIndex) next[item.key] = UNMAPPED;
    }
    if (field) next[field] = columnIndex;
    return next;
}

export function inspectCsv(text: string): CsvInspection {
    const allRows = parseCsv(text);
    if (allRows.length < 2) {
        throw new Error("CSV file has no data rows.");
    }

    const headerRowIndex = findHeaderRow(allRows);
    const originalHeaders = allRows[headerRowIndex].map((header) => header.replace(/^\uFEFF/, "").trim());
    const normalizedHeaders = originalHeaders.map(normalizeHeader);
    const rows = allRows.slice(headerRowIndex + 1);
    if (rows.length === 0) {
        throw new Error("CSV file has no data rows.");
    }

    return {
        originalHeaders,
        normalizedHeaders,
        rows,
        suggestedMapping: suggestColumnMapping(normalizedHeaders),
    };
}

function cell(row: string[], index: number): string {
    if (index < 0) return "";
    return (row[index] || "").trim();
}

function detectDateOrder(rows: string[][], dateIdx: number): DateOrder {
    let monthDay = 0;
    let dayMonth = 0;
    for (const row of rows) {
        const match = cell(row, dateIdx).match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
        if (!match) continue;
        const first = Number(match[1]);
        const second = Number(match[2]);
        if (first > 12 && second <= 12) dayMonth += 1;
        if (second > 12 && first <= 12) monthDay += 1;
    }
    if (dayMonth > monthDay) return "dmy";
    return "mdy";
}

export function applyColumnMapping(inspection: CsvInspection, mapping: ColumnMapping): CsvParseResult {
    const expenses: ParsedExpense[] = [];
    let skipped = 0;
    const dateOrder = mapping.date === UNMAPPED ? "mdy" : detectDateOrder(inspection.rows, mapping.date);

    for (const row of inspection.rows) {
        const date = mapping.date === UNMAPPED ? null : parseDate(cell(row, mapping.date), dateOrder);
        const vendor = cell(row, mapping.vendor);
        let amount: number | null = null;
        if (mapping.amount !== UNMAPPED) {
            amount = parseAmount(cell(row, mapping.amount));
        } else {
            const debit = parseAmount(cell(row, mapping.debit));
            const credit = parseAmount(cell(row, mapping.credit));
            if (debit != null && debit !== 0) amount = Math.abs(debit);
            else if (credit != null && credit !== 0) amount = -Math.abs(credit);
        }

        if (!date || !vendor || amount == null) {
            skipped += 1;
            continue;
        }

        expenses.push({
            date,
            account: cell(row, mapping.account),
            vendor,
            amount,
            category: cell(row, mapping.category),
            notes: cell(row, mapping.notes),
        });
    }

    return {
        expenses,
        skipped,
        hasAccount: mapping.account !== UNMAPPED,
        hasCategory: mapping.category !== UNMAPPED,
    };
}

export function parseExpenseCsv(text: string): CsvParseResult {
    const inspection = inspectCsv(text);
    const error = mappingError(inspection.suggestedMapping);
    if (error) {
        throw new Error("Could not find Date, Description/Vendor, and Amount columns.");
    }

    const result = applyColumnMapping(inspection, inspection.suggestedMapping);
    if (result.expenses.length === 0) {
        throw new Error("No valid expense rows were found in the CSV.");
    }
    return result;
}
