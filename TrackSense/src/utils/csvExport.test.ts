import { describe, expect, it } from "vitest";
import type { Expense } from "@/types/expense";
import {
  EXPENSE_CSV_HEADERS,
  defaultExportColumns,
  expenseExportFilename,
  expensesToCsv,
  selectedExportFields,
} from "./csvExport";

function expense(
  partial: Pick<Expense, "_id"> & Partial<Expense>,
): Expense {
  return {
    date: partial.date ?? new Date("2026-03-04T00:00:00.000Z"),
    account: partial.account ?? "Checking",
    vendor: partial.vendor ?? "Store",
    category: partial.category ?? "Food",
    amount: partial.amount ?? 12.5,
    notes: partial.notes ?? "",
    assignedMemberId: partial.assignedMemberId ?? null,
    ...partial,
  };
}

describe("expensesToCsv", () => {
  it("writes headers even when there are no transactions", () => {
    expect(expensesToCsv([], () => "")).toBe(
      `${EXPENSE_CSV_HEADERS.join(",")}\r\n`,
    );
  });

  it("exports one row per transaction with person labels", () => {
    const csv = expensesToCsv(
      [
        expense({
          _id: "a",
          vendor: "Zoo",
          amount: 40,
          assignedMemberId: "alex",
        }),
        expense({
          _id: "b",
          date: new Date("2026-01-15T00:00:00.000Z"),
          vendor: "Alpha",
          category: "Rent",
          amount: 5,
          notes: "first of the month",
        }),
      ],
      (row) => (row.assignedMemberId === "alex" ? "alex" : "Split (2)"),
    );

    expect(csv).toBe(
      [
        EXPENSE_CSV_HEADERS.join(","),
        "2026-03-04,Checking,Zoo,40,Food,alex,",
        "2026-01-15,Checking,Alpha,5,Rent,Split (2),first of the month",
        "",
      ].join("\r\n"),
    );
  });

  it("quotes commas, quotes, and line breaks so the file stays valid CSV", () => {
    const csv = expensesToCsv(
      [
        expense({
          _id: "quoted",
          vendor: 'Joe "The Shop" LLC',
          notes: "line 1\nline 2, extra",
        }),
      ],
      () => "Split",
    );

    expect(csv).toContain(
      `"Joe ""The Shop"" LLC",12.5,Food,Split,"line 1\nline 2, extra"`,
    );
  });

  it("writes only the selected columns", () => {
    const csv = expensesToCsv(
      [
        expense({
          _id: "subset",
          vendor: "Cafe",
          amount: 8,
          notes: "ignored",
        }),
      ],
      () => "alex",
      ["date", "vendor", "amount"],
    );

    expect(csv).toBe("Date,Vendor,Amount\r\n2026-03-04,Cafe,8\r\n");
  });

  it("returns an empty string when no columns are selected", () => {
    expect(expensesToCsv([expense({ _id: "none" })], () => "", [])).toBe("");
  });
});

describe("selectedExportFields", () => {
  it("keeps the default column order and drops unchecked fields", () => {
    const columns = defaultExportColumns();
    columns.account = false;
    columns.person = false;
    expect(selectedExportFields(columns)).toEqual([
      "date",
      "vendor",
      "amount",
      "category",
      "notes",
    ]);
  });
});

describe("expenseExportFilename", () => {
  it("uses an ISO date so exports are easy to tell apart", () => {
    expect(expenseExportFilename(new Date("2026-11-16T17:00:00.000Z"))).toBe(
      "expenses-2026-11-16.csv",
    );
  });
});
