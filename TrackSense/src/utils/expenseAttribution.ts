import type { ProfileMember } from "../types/profile";

export const SPLIT_VALUE = "split";

export function activePeople(members: ProfileMember[]): ProfileMember[] {
  return members.filter((member) => member.status === "active");
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
  if (assignedMemberId) {
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
    const assigned = people.find((member) => member.id === expense.assignedMemberId);
    if (assigned) {
      rows.push({
        ...expense,
        category: personLabel(assigned, selfMemberId),
        amount: expense.amount,
      });
      continue;
    }
    const share = splitAmount(expense.amount, people.length);
    for (const person of people) {
      rows.push({
        ...expense,
        category: personLabel(person, selfMemberId),
        amount: share,
      });
    }
  }
  return rows;
}
