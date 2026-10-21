import { describe, expect, it } from "vitest";
import type { ProfileMember } from "../types/profile";
import {
  attributionLabel,
  defaultSplitPercents,
  chartExpensesByPerson,
  expensesByPerson,
  isSplitAssignment,
  personLabel,
  personPieSlices,
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

  it("keeps split spend in its own pie slice and personal spend with each person", () => {
    const rows = personPieSlices(
      [
        { amount: 90, assignedMemberId: null },
        { amount: 40, assignedMemberId: "a" },
        { amount: 10, assignedMemberId: "b" },
        { amount: 5, assignedMemberId: "split" },
      ],
      [alex, blair],
    );
    expect(rows).toEqual([
      { category: "Split (2)", amount: 95 },
      { category: "alex", amount: 40 },
      { category: "blair", amount: 10 },
    ]);
  });

  it("does not divide the split pie slice by custom percents", () => {
    const alex70 = member("a", "alex@example.com", 70);
    const blair30 = member("b", "blair@example.com", 30);
    expect(personPieSlices(
      [{ amount: 90, assignedMemberId: "split" }, { amount: 20, assignedMemberId: "a" }],
      [alex70, blair30],
      "a",
    )).toEqual([
      { category: "Split (2)", amount: 90 },
      { category: "alex (you)", amount: 20 },
    ]);
  });

  it("keeps split as its own bar series and leaves personal amounts whole", () => {
    const date = new Date("2026-03-01");
    expect(chartExpensesByPerson(
      [
        { amount: 90, assignedMemberId: null, date },
        { amount: 40, assignedMemberId: "a", date },
      ],
      [alex, blair],
    )).toEqual([
      { amount: 90, assignedMemberId: null, date, category: "Split (2)" },
      { amount: 40, assignedMemberId: "a", date, category: "alex" },
    ]);
  });

  it("drops a person's unsplit slice when that person is filtered out", () => {
    expect(personPieSlices(
      [
        { amount: 90, assignedMemberId: null },
        { amount: 40, assignedMemberId: "a" },
        { amount: 10, assignedMemberId: "b" },
      ],
      [alex, blair],
      null,
      { people: ["Split (2)", "alex"] },
    )).toEqual([
      { category: "Split (2)", amount: 90 },
      { category: "alex", amount: 40 },
    ]);
  });

  it("drops the split slice when split is filtered out", () => {
    expect(personPieSlices(
      [
        { amount: 90, assignedMemberId: null },
        { amount: 40, assignedMemberId: "a" },
        { amount: 10, assignedMemberId: "b" },
      ],
      [alex, blair],
      null,
      { people: ["alex", "blair"] },
    )).toEqual([
      { category: "alex", amount: 40 },
      { category: "blair", amount: 10 },
    ]);
  });

  it("returns no pie slices when every person is cleared", () => {
    expect(personPieSlices(
      [{ amount: 90, assignedMemberId: null }, { amount: 40, assignedMemberId: "a" }],
      [alex, blair],
      null,
      { people: [] },
    )).toEqual([]);
  });

  it("labels the split slice Split when only one person is active", () => {
    expect(personPieSlices(
      [{ amount: 30, assignedMemberId: null }, { amount: 12, assignedMemberId: "a" }],
      [alex],
    )).toEqual([
      { category: "Split", amount: 30 },
      { category: "alex", amount: 12 },
    ]);
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
