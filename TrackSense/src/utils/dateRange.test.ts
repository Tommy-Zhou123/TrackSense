import { describe, expect, it } from "vitest";
import { dateRangeKeys, expenseInDateRange, lastNMonthRange } from "./dateRange";

const now = new Date(2026, 8, 3);

describe("dateRangeKeys", () => {
    it("returns null for all dates", () => {
        expect(dateRangeKeys("all", now)).toBeNull();
    });

    it("covers the current calendar month", () => {
        expect(dateRangeKeys("this-month", now)).toEqual({
            start: "2026-09-01",
            end: "2026-09-30",
        });
    });

    it("covers the previous calendar month", () => {
        expect(dateRangeKeys("last-month", now)).toEqual({
            start: "2026-08-01",
            end: "2026-08-31",
        });
    });

    it("uses a rolling three-month window", () => {
        expect(dateRangeKeys("last-3-months", now)).toEqual({
            start: "2026-06-03",
            end: "2026-09-03",
        });
    });

    it("uses a rolling twelve-month window", () => {
        expect(dateRangeKeys("last-12-months", now)).toEqual({
            start: "2025-09-03",
            end: "2026-09-03",
        });
    });

    it("covers year to date", () => {
        expect(dateRangeKeys("ytd", now)).toEqual({
            start: "2026-01-01",
            end: "2026-09-03",
        });
    });
});

describe("expenseInDateRange", () => {
    it("includes every date when the preset is all", () => {
        expect(expenseInDateRange(new Date("2020-01-01T00:00:00.000Z"), "all", now)).toBe(true);
    });

    it("includes August charges in last month and excludes July", () => {
        expect(expenseInDateRange(new Date("2026-08-31T00:00:00.000Z"), "last-month", now)).toBe(true);
        expect(expenseInDateRange(new Date("2026-07-31T00:00:00.000Z"), "last-month", now)).toBe(false);
        expect(expenseInDateRange(new Date("2026-09-01T00:00:00.000Z"), "last-month", now)).toBe(false);
    });
});

describe("lastNMonthRange", () => {
    it("covers the current calendar month when count is 1", () => {
        expect(lastNMonthRange(1, now)).toEqual({
            start: "2026-09-01",
            end: "2026-09-30",
        });
    });

    it("covers three full calendar months including the current one", () => {
        expect(lastNMonthRange(3, now)).toEqual({
            start: "2026-07-01",
            end: "2026-09-30",
        });
    });

    it("treats a count below 1 as one month", () => {
        expect(lastNMonthRange(0, now)).toEqual(lastNMonthRange(1, now));
    });
});
