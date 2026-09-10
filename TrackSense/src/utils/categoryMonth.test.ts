import { describe, expect, it } from "vitest";
import {
    aggregateCategoryMonth,
    aggregateCategoryPeriod,
    aggregateCategoryTotals,
    alignRangeToGrain,
    currentPeriodRange,
    formatMonthLabel,
    formatPeriodLabel,
    listMonthsInclusive,
    listPeriodsInclusive,
    monthKeyFromDate,
    uniqueCategories,
} from "./categoryMonth";

function expense(date: string, category: string, amount: number) {
    return { date: new Date(`${date}T00:00:00.000Z`), category, amount };
}

describe("monthKeyFromDate", () => {
    it("uses the UTC YYYY-MM key", () => {
        expect(monthKeyFromDate(new Date("2026-09-03T00:00:00.000Z"))).toBe("2026-09");
    });

    it("returns null for invalid dates", () => {
        expect(monthKeyFromDate(new Date("not-a-date"))).toBeNull();
    });
});

describe("formatMonthLabel", () => {
    it("formats as short month and year", () => {
        expect(formatMonthLabel("2026-09")).toBe("Sep 2026");
    });
});

describe("listMonthsInclusive", () => {
    it("fills every month between the bounds", () => {
        expect(listMonthsInclusive("2026-06", "2026-09")).toEqual([
            "2026-06",
            "2026-07",
            "2026-08",
            "2026-09",
        ]);
    });

    it("crosses a year boundary", () => {
        expect(listMonthsInclusive("2025-11", "2026-02")).toEqual([
            "2025-11",
            "2025-12",
            "2026-01",
            "2026-02",
        ]);
    });
});

describe("uniqueCategories", () => {
    it("normalizes blanks and sorts Uncategorized last", () => {
        expect(uniqueCategories([
            expense("2026-01-01", "Fuel", 10),
            expense("2026-01-02", "  ", 5),
            expense("2026-01-03", "Food", 8),
        ])).toEqual(["Food", "Fuel", "Uncategorized"]);
    });
});

describe("aggregateCategoryMonth", () => {
    it("returns empty series when there is no data and no range", () => {
        expect(aggregateCategoryMonth([])).toEqual({
            months: [],
            categories: [],
            rows: [],
        });
    });

    it("sums amounts per category per month", () => {
        const chart = aggregateCategoryMonth([
            expense("2026-08-01", "Food", 10),
            expense("2026-08-15", "Food", 5.5),
            expense("2026-08-20", "Fuel", 40),
        ]);
        expect(chart.months).toEqual(["2026-08"]);
        expect(chart.categories).toEqual(["Food", "Fuel"]);
        expect(chart.rows).toEqual([{ month: "2026-08", Food: 15.5, Fuel: 40 }]);
    });

    it("treats blank categories as Uncategorized", () => {
        const chart = aggregateCategoryMonth([
            expense("2026-03-01", "", 12),
            expense("2026-03-02", "   ", 3),
        ]);
        expect(chart.categories).toEqual(["Uncategorized"]);
        expect(chart.rows[0].Uncategorized).toBe(15);
    });

    it("fills month gaps between the earliest and latest expense", () => {
        const chart = aggregateCategoryMonth([
            expense("2026-01-10", "Food", 4),
            expense("2026-03-10", "Food", 6),
        ]);
        expect(chart.months).toEqual(["2026-01", "2026-02", "2026-03"]);
        expect(chart.rows.map((row) => row.Food)).toEqual([4, 0, 6]);
    });

    it("fills the provided month range even when a month has no spend", () => {
        const chart = aggregateCategoryMonth(
            [expense("2026-08-12", "Fuel", 20)],
            { monthStart: "2026-07", monthEnd: "2026-09" },
        );
        expect(chart.months).toEqual(["2026-07", "2026-08", "2026-09"]);
        expect(chart.rows.map((row) => row.Fuel)).toEqual([0, 20, 0]);
    });

    it("keeps only the selected categories", () => {
        const chart = aggregateCategoryMonth(
            [
                expense("2026-08-01", "Food", 10),
                expense("2026-08-01", "Fuel", 40),
            ],
            { categories: ["Food"] },
        );
        expect(chart.categories).toEqual(["Food"]);
        expect(chart.rows[0]).toEqual({ month: "2026-08", Food: 10 });
    });

    it("skips invalid dates", () => {
        const chart = aggregateCategoryMonth([
            { date: new Date("invalid"), category: "Food", amount: 99 },
            expense("2026-04-01", "Food", 2),
        ]);
        expect(chart.rows).toEqual([{ month: "2026-04", Food: 2 }]);
    });
});

describe("aggregateCategoryPeriod", () => {
    it("buckets by day", () => {
        const chart = aggregateCategoryPeriod(
            [
                expense("2026-09-01", "Food", 4),
                expense("2026-09-03", "Food", 6),
            ],
            { grain: "day", periodStart: "2026-09-01", periodEnd: "2026-09-03" },
        );
        expect(chart.periods).toEqual(["2026-09-01", "2026-09-02", "2026-09-03"]);
        expect(chart.rows.map((row) => row.Food)).toEqual([4, 0, 6]);
    });

    it("buckets by year", () => {
        const chart = aggregateCategoryPeriod(
            [
                expense("2024-03-01", "Fuel", 10),
                expense("2026-01-01", "Fuel", 15),
            ],
            { grain: "year", periodStart: "2024", periodEnd: "2026" },
        );
        expect(chart.periods).toEqual(["2024", "2025", "2026"]);
        expect(chart.rows.map((row) => row.Fuel)).toEqual([10, 0, 15]);
    });
});

describe("alignRangeToGrain", () => {
    it("snaps a mid-month span to full months", () => {
        expect(alignRangeToGrain({ start: "2026-07-12", end: "2026-09-03" }, "month")).toEqual({
            start: "2026-07-01",
            end: "2026-09-30",
        });
    });
});

describe("currentPeriodRange", () => {
    it("uses the current calendar month", () => {
        expect(currentPeriodRange("month", new Date(2026, 8, 3))).toEqual({
            start: "2026-09-01",
            end: "2026-09-30",
        });
    });
});

describe("listPeriodsInclusive", () => {
    it("lists days", () => {
        expect(listPeriodsInclusive("2026-09-01", "2026-09-03", "day")).toEqual([
            "2026-09-01",
            "2026-09-02",
            "2026-09-03",
        ]);
    });
});

describe("formatPeriodLabel", () => {
    it("formats a day with year", () => {
        expect(formatPeriodLabel("2026-09-03", "day")).toBe("Sep 3, 2026");
    });
});

describe("aggregateCategoryTotals", () => {
    it("sums each category and sorts by amount", () => {
        expect(aggregateCategoryTotals([
            expense("2026-07-01", "Fuel", 40),
            expense("2026-08-01", "Food", 10),
            expense("2026-09-01", "Food", 5),
        ])).toEqual([
            { category: "Fuel", amount: 40 },
            { category: "Food", amount: 15 },
        ]);
    });

    it("keeps only the selected categories and drops zeros", () => {
        expect(aggregateCategoryTotals(
            [
                expense("2026-08-01", "Food", 10),
                expense("2026-08-01", "Fuel", 40),
            ],
            { categories: ["Food"] },
        )).toEqual([{ category: "Food", amount: 10 }]);
    });
});
