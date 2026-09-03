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

export type ColumnField = "date" | "account" | "vendor" | "amount" | "debit" | "credit" | "category" | "notes";

export type ColumnMapping = Record<ColumnField, number>;

export interface ColumnFieldConfig {
    key: ColumnField;
    label: string;
    required?: boolean;
    hint?: string;
}

export interface CsvInspection {
    originalHeaders: string[];
    normalizedHeaders: string[];
    rows: string[][];
    suggestedMapping: ColumnMapping;
}

export type DateOrder = "mdy" | "dmy";
