import { describe, expect, it } from "vitest";
import type { Expense } from "@/types/expense";
import { groupsForPage, orderExpenses } from "./expenseTable";

function expense(partial: Pick<Expense, "_id" | "amount" | "category"> & Partial<Expense>): Expense {
  return {
    date: partial.date ?? new Date("2026-01-15T00:00:00.000Z"),
    account: partial.account ?? "Checking",
    vendor: partial.vendor ?? "Store",
    notes: partial.notes ?? "",
    assignedMemberId: partial.assignedMemberId ?? null,
    ...partial,
  };
}

describe("orderExpenses", () => {
  const rows = [
    expense({ _id: "a", amount: 50, category: "Food", vendor: "Zoo" }),
    expense({ _id: "b", amount: 5, category: "Rent", vendor: "Alpha" }),
    expense({ _id: "c", amount: 20, category: "Food", vendor: "Middle" }),
    expense({ _id: "d", amount: 1, category: "Rent", vendor: "Beta" }),
  ];

  it("sorts the full list so later pages continue that order", () => {
    const ordered = orderExpenses(rows, "none", {
      key: "amount",
      direction: "down",
    });
    expect(ordered.map((row) => row._id)).toEqual(["d", "b", "c", "a"]);
    expect(ordered.slice(2).map((row) => row._id)).toEqual(["c", "a"]);
  });

  it("keeps a reversed sort across the whole list", () => {
    const ordered = orderExpenses(rows, "none", {
      key: "amount",
      direction: "up",
    });
    expect(ordered.map((row) => row.amount)).toEqual([50, 20, 5, 1]);
  });

  it("groups every matching transaction before paging", () => {
    const ordered = orderExpenses(rows, "category", null);
    expect(ordered.map((row) => row.category)).toEqual([
      "Food",
      "Food",
      "Rent",
      "Rent",
    ]);
    const page = groupsForPage(ordered, "category", 2, 2);
    expect(page.map((group) => group.key)).toEqual(["Rent"]);
    expect(page[0].items.map((row) => row._id)).toEqual(["b", "d"]);
    expect(page[0].total).toBe(2);
  });

  it("sorts inside each group without splitting the group across the sort", () => {
    const ordered = orderExpenses(rows, "category", {
      key: "amount",
      direction: "down",
    });
    expect(ordered.map((row) => `${row.category}:${row.amount}`)).toEqual([
      "Food:20",
      "Food:50",
      "Rent:1",
      "Rent:5",
    ]);
  });
});

describe("groupsForPage", () => {
  it("continues a group onto the next page and keeps the full membership", () => {
    const rows = ["g1", "g2", "g3", "r1"].map((id, index) =>
      expense({
        _id: id,
        amount: index + 1,
        category: id.startsWith("g") ? "Groceries" : "Rent",
      }),
    );
    const ordered = orderExpenses(rows, "category", null);
    const first = groupsForPage(ordered, "category", 1, 2);
    const second = groupsForPage(ordered, "category", 2, 2);

    expect(first).toHaveLength(1);
    expect(first[0].key).toBe("Groceries");
    expect(first[0].items.map((row) => row._id)).toEqual(["g1", "g2"]);
    expect(first[0].total).toBe(3);
    expect(first[0].ids).toEqual(["g1", "g2", "g3"]);

    expect(second.map((group) => group.key)).toEqual(["Groceries", "Rent"]);
    expect(second[0].items.map((row) => row._id)).toEqual(["g3"]);
    expect(second[0].total).toBe(3);
    expect(second[1].items.map((row) => row._id)).toEqual(["r1"]);
  });
});
