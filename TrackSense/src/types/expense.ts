export interface Expense {
  _id: string;
  date: Date;
  account: string;
  vendor: string;
  category: string;
  amount: number;
  notes: string;
  assignedMemberId: string | null;
}

export function mapExpense(raw: {
  _id?: string;
  id?: string;
  date: string | Date;
  account?: string;
  vendor?: string;
  category?: string;
  amount?: number;
  notes?: string | null;
  assignedMemberId?: string | null;
}): Expense {
  return {
    _id: raw._id || String(raw.id || ""),
    date: raw.date instanceof Date ? raw.date : new Date(raw.date),
    account: raw.account || "",
    vendor: raw.vendor || "",
    category: raw.category || "",
    amount: Number(raw.amount),
    notes: raw.notes ?? "",
    assignedMemberId: raw.assignedMemberId ?? null,
  };
}
