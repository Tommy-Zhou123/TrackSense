export interface ParsedExpense {
    date: Date;
    account: string;
    vendor: string;
    amount: number;
    category: string;
    notes: string;
}

export interface CsvParseResult {
    expenses: ParsedExpense[];
    skipped: number;
    hasAccount: boolean;
    hasCategory: boolean;
}

const DATE_HEADERS = ["date", "transaction date", "trans date", "posted date", "posting date", "txn date", "trans. date"];
const ACCOUNT_HEADERS = ["account", "account name", "account type"];
const VENDOR_HEADERS = ["vendor", "description", "merchant", "payee", "name", "details"];
const AMOUNT_HEADERS = ["amount", "transaction amount", "cad"];
const DEBIT_HEADERS = ["debit", "withdrawal", "charge"];
const CREDIT_HEADERS = ["credit", "deposit", "payment"];
const CATEGORY_HEADERS = ["category", "type", "expense category"];
const NOTES_HEADERS = ["notes", "memo", "comment", "reference"];

function normalizeHeader(header: string): string {
    return header.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[$]/g, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function headerIndex(headers: string[], aliases: string[]): number {
    for (const alias of aliases) {
        const idx = headers.indexOf(alias);
        if (idx !== -1) return idx;
    }
    return -1;
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

export function parseDate(value: string): Date | null {
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
        return dateFromParts(year, second, first);
    }

    const parsed = new Date(v);
    return isValidDate(parsed) ? parsed : null;
}

export function parseAmount(value: string): number | null {
    const v = value.trim();
    if (!v) return null;
    const negative = /^\(.*\)$/.test(v);
    const cleaned = v.replace(/[()$]/g, "").replace(/cad/gi, "").replace(/,/g, "").trim();
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
        const hasDate = headerIndex(headers, DATE_HEADERS) !== -1;
        const hasAmount =
            headerIndex(headers, AMOUNT_HEADERS) !== -1 ||
            headerIndex(headers, DEBIT_HEADERS) !== -1 ||
            headerIndex(headers, CREDIT_HEADERS) !== -1;
        if (hasDate && hasAmount) return i;
    }
    return 0;
}

export function parseExpenseCsv(text: string): CsvParseResult {
    const rows = parseCsv(text);
    if (rows.length < 2) {
        throw new Error("CSV file has no data rows.");
    }

    const headerRowIndex = findHeaderRow(rows);
    const headers = rows[headerRowIndex].map(normalizeHeader);
    const dateIdx = headerIndex(headers, DATE_HEADERS);
    const accountIdx = headerIndex(headers, ACCOUNT_HEADERS);
    const vendorIdx = headerIndex(headers, VENDOR_HEADERS);
    const amountIdx = headerIndex(headers, AMOUNT_HEADERS);
    const debitIdx = headerIndex(headers, DEBIT_HEADERS);
    const creditIdx = headerIndex(headers, CREDIT_HEADERS);
    const categoryIdx = headerIndex(headers, CATEGORY_HEADERS);
    const notesIdx = headerIndex(headers, NOTES_HEADERS);

    if (dateIdx === -1 || (amountIdx === -1 && debitIdx === -1 && creditIdx === -1) || vendorIdx === -1) {
        throw new Error("Could not find Date, Description/Vendor, and Amount columns.");
    }

    const expenses: ParsedExpense[] = [];
    let skipped = 0;

    for (let i = headerRowIndex + 1; i < rows.length; i++) {
        const row = rows[i];
        const date = parseDate(row[dateIdx] || "");
        const vendor = (row[vendorIdx] || "").trim();
        let amount: number | null = null;
        if (amountIdx !== -1) {
            amount = parseAmount(row[amountIdx] || "");
        } else {
            const debit = parseAmount(row[debitIdx] || "");
            const credit = parseAmount(row[creditIdx] || "");
            if (debit != null && debit !== 0) amount = Math.abs(debit);
            else if (credit != null && credit !== 0) amount = -Math.abs(credit);
        }

        if (!date || !vendor || amount == null) {
            skipped += 1;
            continue;
        }

        expenses.push({
            date,
            account: accountIdx === -1 ? "" : (row[accountIdx] || "").trim(),
            vendor,
            amount,
            category: categoryIdx === -1 ? "" : (row[categoryIdx] || "").trim(),
            notes: notesIdx === -1 ? "" : (row[notesIdx] || "").trim(),
        });
    }

    if (expenses.length === 0) {
        throw new Error("No valid expense rows were found in the CSV.");
    }

    return {
        expenses,
        skipped,
        hasAccount: accountIdx !== -1,
        hasCategory: categoryIdx !== -1,
    };
}
