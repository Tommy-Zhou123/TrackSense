import type { Expense } from "@/types/expense";
import { isSplitAssignment } from "@/utils/expenseAttribution";

export type ExpensePart =
  | "none"
  | "date"
  | "account"
  | "vendor"
  | "amount"
  | "category"
  | "notes"
  | "person";

export type SortDirection = "down" | "up";

export type ExpenseSort = {
  key: Exclude<ExpensePart, "none">;
  direction: SortDirection;
};

export type ExpenseGroupView = {
  key: string;
  items: Expense[];
  total: number;
  ids: string[];
};

function dateKey(date: Date) {
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
}

export function getGroupKey(expense: Expense, mode: ExpensePart): string {
  switch (mode) {
    case "date":
      return dateKey(expense.date);
    case "amount":
      return expense.amount.toString();
    case "account":
      return expense.account || "";
    case "vendor":
      return expense.vendor || "";
    case "category":
      return expense.category || "";
    case "person":
      return expense.assignedMemberId &&
        !isSplitAssignment(expense.assignedMemberId)
        ? expense.assignedMemberId
        : "split";
    case "notes":
      return expense.notes || "";
    default:
      return "";
  }
}

export function sortExpenseList(
  list: Expense[],
  sortByProp: ExpensePart,
  sort: SortDirection = "down",
): Expense[] {
  const updated = [...list];
  const direction = sort === "down" ? 1 : -1;
  if (sortByProp === "date") {
    updated.sort((a, b) => direction * (a.date.getTime() - b.date.getTime()));
  } else if (sortByProp === "amount") {
    updated.sort((a, b) => direction * (a.amount - b.amount));
  } else if (sortByProp !== "none") {
    updated.sort(
      (a, b) =>
        direction *
        getGroupKey(a, sortByProp).localeCompare(getGroupKey(b, sortByProp)),
    );
  }
  return updated;
}

export function groupExpenses(
  list: Expense[],
  mode: ExpensePart,
): { key: string; items: Expense[] }[] {
  const groups = new Map<string, Expense[]>();
  for (const expense of list) {
    const key = getGroupKey(expense, mode);
    const items = groups.get(key);
    if (items) {
      items.push(expense);
    } else {
      groups.set(key, [expense]);
    }
  }
  return Array.from(groups, ([key, items]) => ({ key, items }));
}

/** Order every transaction before any page is sliced off. */
export function orderExpenses(
  list: Expense[],
  grouping: ExpensePart,
  sort: ExpenseSort | null,
): Expense[] {
  if (grouping !== "none") {
    const groupDirection =
      sort && sort.key === grouping ? sort.direction : "down";
    const grouped = sortExpenseList(list, grouping, groupDirection);
    if (!sort || sort.key === grouping) return grouped;
    return groupExpenses(grouped, grouping).flatMap((group) =>
      sortExpenseList(group.items, sort.key, sort.direction),
    );
  }
  if (!sort) return list;
  return sortExpenseList(list, sort.key, sort.direction);
}

/**
 * Groups are built from the full ordered list. A page only windows the rows,
 * so a group can continue onto the next page with its full membership intact.
 */
export function groupsForPage(
  list: Expense[],
  grouping: ExpensePart,
  page: number,
  perPage: number,
): ExpenseGroupView[] {
  const groups = groupExpenses(list, grouping);
  const start = (Math.max(1, page) - 1) * perPage;
  const end = start + perPage;
  let cursor = 0;
  const visible: ExpenseGroupView[] = [];
  for (const group of groups) {
    const groupStart = cursor;
    const groupEnd = cursor + group.items.length;
    cursor = groupEnd;
    if (groupEnd <= start || groupStart >= end) continue;
    const from = Math.max(0, start - groupStart);
    const to = Math.min(group.items.length, end - groupStart);
    visible.push({
      key: group.key,
      items: group.items.slice(from, to),
      total: group.items.length,
      ids: group.items.map((item) => item._id.toString()),
    });
  }
  return visible;
}
