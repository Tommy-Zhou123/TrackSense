import { describe, expect, it } from "vitest";
import type { ProfileMember } from "../types/profile";
import {
  attributionLabel,
  expensesByPerson,
  personLabel,
  splitAmount,
} from "./expenseAttribution";

function member(id: string, email: string): ProfileMember {
  return {
    id,
    email,
    role: "member",
    status: "active",
    userId: `user_${id}`,
    invitedBy: null,
    createdAt: "",
  };
}

const alex = member("a", "alex@example.com");
const blair = member("b", "blair@example.com");

describe("expenseAttribution", () => {
  it("labels people from the email local part", () => {
    expect(personLabel(alex)).toBe("alex");
    expect(personLabel(alex, "a")).toBe("alex (you)");
  });

  it("uses split among current people by default", () => {
    expect(attributionLabel(null, [alex, blair])).toBe("Split (2)");
    expect(attributionLabel(null, [alex])).toBe("alex");
    expect(attributionLabel("a", [alex, blair])).toBe("alex");
  });

  it("splits amounts equally", () => {
    expect(splitAmount(90, 3)).toBe(30);
  });

  it("attributes a full expense to one person or splits it", () => {
    const expenses = [
      { amount: 90, assignedMemberId: null, date: new Date("2026-01-01") },
      { amount: 40, assignedMemberId: "a", date: new Date("2026-01-02") },
    ];
    const rows = expensesByPerson(expenses, [alex, blair]);
    expect(rows).toEqual([
      expect.objectContaining({ category: "alex", amount: 45 }),
      expect.objectContaining({ category: "blair", amount: 45 }),
      expect.objectContaining({ category: "alex", amount: 40 }),
    ]);
  });
});
