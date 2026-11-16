import type { Expense } from "@/types/expense";

export const EXPENSE_CSV_FIELDS = [
  { key: "date", label: "Date" },
  { key: "account", label: "Account" },
  { key: "vendor", label: "Vendor" },
  { key: "amount", label: "Amount" },
  { key: "category", label: "Category" },
  { key: "person", label: "Person" },
  { key: "notes", label: "Notes" },
] as const;

export type ExpenseCsvField = (typeof EXPENSE_CSV_FIELDS)[number]["key"];

export const EXPENSE_CSV_HEADERS = EXPENSE_CSV_FIELDS.map(
  (field) => field.label,
);

const ALL_FIELDS: ExpenseCsvField[] = EXPENSE_CSV_FIELDS.map(
  (field) => field.key,
);

export function defaultExportColumns(): Record<ExpenseCsvField, boolean> {
  return {
    date: true,
    account: true,
    vendor: true,
    amount: true,
    category: true,
    person: true,
    notes: true,
  };
}

export function selectedExportFields(
  columns: Record<ExpenseCsvField, boolean>,
): ExpenseCsvField[] {
  return EXPENSE_CSV_FIELDS.filter((field) => columns[field.key]).map(
    (field) => field.key,
  );
}

function csvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function csvDate(date: Date): string {
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
}

function csvAmount(amount: number): string {
  return Number.isFinite(amount) ? String(amount) : "0";
}

function cellForField(
  expense: Expense,
  field: ExpenseCsvField,
  personFor: (expense: Expense) => string,
): string {
  switch (field) {
    case "date":
      return csvDate(expense.date);
    case "account":
      return expense.account || "";
    case "vendor":
      return expense.vendor || "";
    case "amount":
      return csvAmount(expense.amount);
    case "category":
      return expense.category || "";
    case "person":
      return personFor(expense) || "";
    case "notes":
      return expense.notes || "";
  }
}

export function expensesToCsv(
  expenses: readonly Expense[],
  personFor: (expense: Expense) => string,
  fields: readonly ExpenseCsvField[] = ALL_FIELDS,
): string {
  if (fields.length === 0) return "";
  const labels = fields.map(
    (key) =>
      EXPENSE_CSV_FIELDS.find((field) => field.key === key)?.label || key,
  );
  const lines = [
    labels.join(","),
    ...expenses.map((expense) =>
      fields
        .map((field) => csvCell(cellForField(expense, field, personFor)))
        .join(","),
    ),
  ];
  return `${lines.join("\r\n")}\r\n`;
}

export function expenseExportFilename(now = new Date()): string {
  const day = now.toISOString().split("T")[0] || "export";
  return `expenses-${day}.csv`;
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([`\uFEFF${csv}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
