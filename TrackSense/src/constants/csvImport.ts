import type { ColumnFieldConfig } from "@/types/csvImport";

export const UNMAPPED = -1;

export const COLUMN_FIELDS: ColumnFieldConfig[] = [
    { key: "date", label: "Date", required: true },
    { key: "vendor", label: "Vendor", required: true },
    { key: "amount", label: "Amount", required: true, hint: "Or map Debit / Credit instead" },
    { key: "debit", label: "Debit" },
    { key: "credit", label: "Credit" },
    { key: "account", label: "Account" },
    { key: "category", label: "Category" },
    { key: "notes", label: "Notes" },
];

export const DATE_HEADERS = [
    "transaction date",
    "trans date",
    "posted date",
    "posting date",
    "txn date",
    "settle date",
    "settlement date",
    "date",
];

export const ACCOUNT_HEADERS = ["account name", "account type", "account", "card", "wallet"];

export const VENDOR_HEADERS = [
    "description 1",
    "vendor",
    "merchant",
    "payee",
    "narrative",
    "particulars",
    "description",
    "name",
    "details",
];

export const AMOUNT_HEADERS = [
    "transaction amount",
    "amount cad",
    "amount usd",
    "cad amount",
    "usd amount",
    "amount",
    "cad",
    "usd",
    "eur",
    "gbp",
    "total",
    "value",
];

export const DEBIT_HEADERS = ["debit", "withdrawal", "withdrawals", "charge", "money out"];
export const CREDIT_HEADERS = ["credit", "deposit", "deposits", "payment", "money in"];
export const CATEGORY_HEADERS = ["expense category", "category", "type"];
export const NOTES_HEADERS = ["description 2", "notes", "memo", "comment", "reference", "details"];
export const EXACT_ONLY_ALIASES = new Set(["name", "type", "details", "total", "value", "card"]);

export const NEW_CATEGORY_OPTION = "__new__";
export const IMPORT_CATEGORY_PAGE_SIZE = 10;
export const CSV_PAGE_SIZE = 100;
