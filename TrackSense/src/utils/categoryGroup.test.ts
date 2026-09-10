import { describe, expect, it } from "vitest";
import { aggregateCategoryMonth, aggregateCategoryTotals } from "./categoryMonth";
import {
    groupLookup,
    mapExpensesToGroups,
    memberOwnerLookup,
    resolveCategory,
    sameCategorySet,
    sortLeafCategories,
    uniqueLeafCategories,
    type CategoryGroup,
} from "./categoryGroup";

const groups: CategoryGroup[] = [
    {
        id: "housing",
        name: "Housing",
        categories: ["Rent", "Water", "Wifi", "Gas"],
    },
    {
        id: "vacation",
        name: "Vacation",
        categories: ["Flights", "Hotels"],
    },
];

function expense(date: string, category: string, amount: number) {
    return { date: new Date(`${date}T00:00:00.000Z`), category, amount };
}

describe("groupLookup", () => {
    it("maps each leaf to its parent", () => {
        const lookup = groupLookup(groups);
        expect(lookup.get("rent")).toBe("Housing");
        expect(lookup.get("wifi")).toBe("Housing");
        expect(lookup.get("flights")).toBe("Vacation");
        expect(lookup.has("food")).toBe(false);
    });
});

describe("resolveCategory", () => {
    const lookup = groupLookup(groups);

    it("returns the category group name for linked leaves", () => {
        expect(resolveCategory("Rent", lookup)).toBe("Housing");
        expect(resolveCategory(" water ", lookup)).toBe("Housing");
        expect(resolveCategory("HOTELS", lookup)).toBe("Vacation");
    });

    it("keeps unlinked leaves as themselves", () => {
        expect(resolveCategory("Food", lookup)).toBe("Food");
    });

    it("normalizes blanks to Uncategorized when unlinked", () => {
        expect(resolveCategory("  ", lookup)).toBe("Uncategorized");
    });
});

describe("mapExpensesToGroups", () => {
    it("rolls Housing members together and leaves Food alone", () => {
        const lookup = groupLookup(groups);
        const mapped = mapExpensesToGroups([
            expense("2026-08-01", "Rent", 1200),
            expense("2026-08-02", "Water", 40),
            expense("2026-08-03", "Wifi", 80),
            expense("2026-08-04", "Food", 25),
        ], lookup);

        expect(mapped.map((row) => row.category)).toEqual([
            "Housing",
            "Housing",
            "Housing",
            "Food",
        ]);

        expect(aggregateCategoryTotals(mapped)).toEqual([
            { category: "Housing", amount: 1320 },
            { category: "Food", amount: 25 },
        ]);

        const chart = aggregateCategoryMonth(mapped);
        expect(chart.categories).toEqual(["Food", "Housing"]);
        expect(chart.rows[0].Housing).toBe(1320);
        expect(chart.rows[0].Food).toBe(25);
    });

    it("drops ungrouped categories when groupedOnly is set", () => {
        const lookup = groupLookup(groups);
        const mapped = mapExpensesToGroups([
            expense("2026-08-01", "Rent", 1200),
            expense("2026-08-02", "Water", 40),
            expense("2026-08-04", "Food", 25),
            expense("2026-08-05", "Flights", 300),
        ], lookup, { groupedOnly: true });

        expect(mapped.map((row) => row.category)).toEqual(["Housing", "Housing", "Vacation"]);
        expect(aggregateCategoryTotals(mapped)).toEqual([
            { category: "Housing", amount: 1240 },
            { category: "Vacation", amount: 300 },
        ]);
    });
});

describe("uniqueLeafCategories", () => {
    it("dedupes case-insensitively and skips blanks", () => {
        expect(uniqueLeafCategories([
            { category: "Rent" },
            { category: "rent" },
            { category: "  " },
            { category: "Food" },
        ])).toEqual(["Food", "Rent"]);
    });

    it("includes extra names from category groups", () => {
        expect(uniqueLeafCategories(
            [{ category: "Rent" }],
            ["Wifi", "rent"],
        )).toEqual(["Rent", "Wifi"]);
    });
});

describe("memberOwnerLookup", () => {
    it("points a leaf at the group that owns it", () => {
        const owners = memberOwnerLookup(groups);
        expect(owners.get("wifi")).toEqual({ id: "housing", name: "Housing" });
        expect(owners.get("hotels")).toEqual({ id: "vacation", name: "Vacation" });
    });
});

describe("sameCategorySet", () => {
    it("compares trimmed names without regard to order or case", () => {
        expect(sameCategorySet(["Rent", "Wifi"], ["wifi", "rent"])).toBe(true);
        expect(sameCategorySet(["Rent"], ["Rent", "Wifi"])).toBe(false);
    });
});

describe("sortLeafCategories", () => {
    const owners = memberOwnerLookup(groups);

    it("puts the selected group's categories first and other groups last", () => {
        expect(sortLeafCategories(
            ["Food", "Hotels", "Rent", "Wifi", "Flights"],
            { selectedGroupId: "housing", owners },
        )).toEqual(["Rent", "Wifi", "Food", "Flights", "Hotels"]);
    });

    it("does not move a category until it is saved into the group", () => {
        expect(sortLeafCategories(
            ["Food", "Rent"],
            { selectedGroupId: "vacation", owners },
        )).toEqual(["Food", "Rent"]);
    });
});
