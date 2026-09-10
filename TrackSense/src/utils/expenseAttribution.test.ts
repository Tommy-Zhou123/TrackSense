import { describe, expect, it } from "vitest";
import type { ProfileMember } from "../types/profile";
import {
  attributionLabel,
  defaultSplitPercents,
  expensesByPerson,
  isSplitAssignment,
  personLabel,
  splitAmount,
} from "./expenseAttribution";

function member(id: string, email: string, splitPercent = 0): ProfileMember {
  return {
    id,
    email,
    role: "member",
    status: "active",
    userId: `user_${id}`,
    invitedBy: null,
    createdAt: "",
    splitPercent,
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

  it("treats the split sentinel as unassigned", () => {
    expect(isSplitAssignment("split")).toBe(true);
    expect(isSplitAssignment("Split (2)")).toBe(true);
    expect(isSplitAssignment(null)).toBe(true);
    expect(isSplitAssignment("a")).toBe(false);
  });

  it("defaults split percents to even shares that add to 100", () => {
    expect(defaultSplitPercents(1)).toEqual([100]);
    expect(defaultSplitPercents(2)).toEqual([50, 50]);
    const three = defaultSplitPercents(3);
    expect(three[0]).toBe(33.333);
    expect(three[1]).toBe(33.333);
    expect(three[2]).toBe(33.334);
    expect(three.reduce((sum, value) => sum + value, 0)).toBe(100);
  });

  it("uses custom split percents for unassigned expenses", () => {
    const alex70 = member("a", "alex@example.com", 70);
    const blair30 = member("b", "blair@example.com", 30);
    const rows = expensesByPerson(
      [{ amount: 90, assignedMemberId: "split" }],
      [alex70, blair30],
    );
    expect(rows).toEqual([
      expect.objectContaining({ category: "alex", amount: 63 }),
      expect.objectContaining({ category: "blair", amount: 27 }),
    ]);
  });
});
