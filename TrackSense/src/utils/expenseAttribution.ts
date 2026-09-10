import type { ProfileMember } from "../types/profile";

export const SPLIT_VALUE = "split";

export function activePeople(members: ProfileMember[]): ProfileMember[] {
  return members.filter((member) => member.status === "active");
}

export function isSplitAssignment(value: string | null | undefined): boolean {
  if (value == null) return true;
  const raw = String(value).trim().toLowerCase();
  return raw === "" || raw === "null" || raw === "undefined" || raw.startsWith("split");
}

export function defaultSplitPercents(count: number): number[] {
  if (!Number.isInteger(count) || count <= 0) return [];
  const base = Math.floor((100 * 1000) / count) / 1000;
  const parts: number[] = [];
  for (let index = 0; index < count - 1; index += 1) parts.push(base);
  parts.push(Math.round((100 - base * (count - 1)) * 1000) / 1000);
  return parts;
}

export function personLabel(member: ProfileMember, selfMemberId?: string | null): string {
  const local = member.email.endsWith("@clerk.local");
  const name = local ? "You" : member.email.split("@")[0] || member.email;
  if (selfMemberId && member.id === selfMemberId && !local) {
    return `${name} (you)`;
  }
  return name;
}

export function attributionLabel(
  assignedMemberId: string | null | undefined,
  members: ProfileMember[],
  selfMemberId?: string | null,
): string {
  const people = activePeople(members);
  if (!isSplitAssignment(assignedMemberId)) {
    const person =
      people.find((member) => member.id === assignedMemberId) ||
      members.find((member) => member.id === assignedMemberId);
    if (person) return personLabel(person, selfMemberId);
  }
  if (people.length <= 1) {
    return people[0] ? personLabel(people[0], selfMemberId) : "Split";
  }
  return `Split (${people.length})`;
}

export function splitAmount(amount: number, peopleCount: number): number {
  const n = Math.max(peopleCount, 1);
  return amount / n;
}

export function effectiveSplitWeights(
  members: ProfileMember[],
): Array<{ member: ProfileMember; weight: number }> {
  const people = activePeople(members);
  if (people.length === 0) return [];
  const percents = people.map((member) => Number(member.splitPercent));
  const sum = percents.reduce(
    (total, value) => total + (Number.isFinite(value) ? Math.max(0, value) : 0),
    0,
  );
  if (sum <= 0) {
    const defaults = defaultSplitPercents(people.length);
    return people.map((member, index) => ({ member, weight: defaults[index] ?? 0 }));
  }
  return people.map((member, index) => ({
    member,
    weight: Number.isFinite(percents[index]) ? Math.max(0, percents[index]) : 0,
  }));
}

export function allocateSplitAmount(
  amount: number,
  members: ProfileMember[],
): Array<{ member: ProfileMember; amount: number }> {
  const weights = effectiveSplitWeights(members).filter((item) => item.weight > 0);
  if (weights.length === 0) return [];
  const total = weights.reduce((sum, item) => sum + item.weight, 0);
  const shares = weights.map((item) => ({
    member: item.member,
    amount: (amount * item.weight) / total,
  }));
  if (shares.length > 0) {
    const used = shares.slice(0, -1).reduce((sum, item) => sum + item.amount, 0);
    shares[shares.length - 1].amount = amount - used;
  }
  return shares;
}

export function expensesByPerson<T extends { amount: number; assignedMemberId?: string | null }>(
  expenses: T[],
  members: ProfileMember[],
  selfMemberId?: string | null,
): Array<T & { category: string; amount: number }> {
  const people = activePeople(members);
  if (people.length === 0) {
    return expenses.map((expense) => ({ ...expense, category: "Unassigned", amount: expense.amount }));
  }
  const rows: Array<T & { category: string; amount: number }> = [];
  for (const expense of expenses) {
    const assigned = isSplitAssignment(expense.assignedMemberId)
      ? undefined
      : people.find((member) => member.id === expense.assignedMemberId);
    if (assigned) {
      rows.push({
        ...expense,
        category: personLabel(assigned, selfMemberId),
        amount: expense.amount,
      });
      continue;
    }
    for (const share of allocateSplitAmount(expense.amount, members)) {
      rows.push({
        ...expense,
        category: personLabel(share.member, selfMemberId),
        amount: share.amount,
      });
    }
  }
  return rows;
}
