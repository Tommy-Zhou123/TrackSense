import { describe, expect, it } from "vitest";
import {
    fillUncategorizedByFingerprint,
    predictCategory,
    suggestDraftCategories,
    vendorFingerprint,
} from "./categoryPredict";

const history = [
    { vendor: "PETRO-CANADA 34871 MARKHAM", category: "Fuel" },
    { vendor: "PETRO-CANADA 34871 MARKHAM", category: "Fuel" },
    { vendor: "PETRO-CANADA 35083 NEWMARKET", category: "Fuel" },
    { vendor: "PETRO-CANADA 52257 DUNDAS", category: "Fuel" },
    { vendor: "WALMART.CA MISSISSAUGA", category: "Pokemon" },
    { vendor: "WALMART.CA MISSISSAUGA", category: "Pokemon" },
    { vendor: "KOCHI JAPANESE BBQ AND Niagara Falls", category: "Food" },
    { vendor: "RIPLEYS NIAGARA FALLS 905-356-2238", category: "Tickets" },
];

describe("vendorFingerprint", () => {
    it("cuts Petro-Canada at the store number", () => {
        expect(vendorFingerprint("PETRO-CANADA 34871 MARKHAM")).toBe("petro canada");
        expect(vendorFingerprint("PETRO-CANADA 35083 NEWMARKET")).toBe("petro canada");
        expect(vendorFingerprint("PETRO-CANADA 52257 DUNDAS")).toBe("petro canada");
    });

    it("keeps a long first token and drops a leftover TLD", () => {
        expect(vendorFingerprint("WALMART.CA MISSISSAUGA")).toBe("walmart");
    });

    it("stops at a phone number and keeps a long first token", () => {
        expect(vendorFingerprint("RIPLEYS NIAGARA FALLS 905-356-2238")).toBe("ripleys");
    });

    it("keeps two short tokens when there is no store number", () => {
        expect(vendorFingerprint("KOCHI JAPANESE BBQ AND Niagara Falls")).toBe("kochi japanese");
    });

    it("drops everything through the first asterisk", () => {
        expect(vendorFingerprint("WL *STEAM PURCHASE")).toBe("steam purchase");
        expect(vendorFingerprint("sq *kochi japanese bbq")).toBe("kochi japanese");
        expect(vendorFingerprint("tst*merchant")).toBe("merchant");
    });
});

describe("predictCategory", () => {
    it("predicts Fuel for a new Petro-Canada location", () => {
        const prediction = predictCategory("PETRO-CANADA 99999 TORONTO", history);
        expect(prediction?.category).toBe("Fuel");
        expect(prediction?.fingerprint).toBe("petro canada");
    });

    it("predicts Pokemon for Walmart.ca", () => {
        expect(predictCategory("WALMART.CA MISSISSAUGA", history)?.category).toBe("Pokemon");
        expect(predictCategory("walmart.ca toronto", history)?.category).toBe("Pokemon");
    });

    it("predicts Tickets and Food for distinct Niagara Falls merchants", () => {
        expect(predictCategory("RIPLEYS NIAGARA FALLS 416-555-1212", history)?.category).toBe("Tickets");
        expect(predictCategory("KOCHI JAPANESE BBQ AND Niagara Falls", history)?.category).toBe("Food");
    });

    it("predicts from a steam purchase after a wallet prefix", () => {
        const labeled = [{ vendor: "WL *STEAM PURCHASE", category: "Games" }];
        expect(predictCategory("wl *steam purchase", labeled)?.category).toBe("Games");
    });

    it("does not guess when the same fingerprint has mixed categories", () => {
        const mixed = [
            ...history,
            { vendor: "WALMART.CA TORONTO", category: "Groceries" },
            { vendor: "WALMART SUPERCENTER", category: "Groceries" },
        ];
        expect(predictCategory("WALMART.CA BRAMPTON", mixed)).toBeNull();
    });

    it("keeps an exact vendor match even if the fingerprint is mixed elsewhere", () => {
        const mixed = [
            { vendor: "WALMART.CA MISSISSAUGA", category: "Pokemon" },
            { vendor: "WALMART.CA MISSISSAUGA", category: "Pokemon" },
            { vendor: "WALMART SUPERCENTER", category: "Groceries" },
            { vendor: "WALMART SUPERCENTER", category: "Groceries" },
        ];
        expect(predictCategory("WALMART.CA MISSISSAUGA", mixed)?.category).toBe("Pokemon");
    });

    it("ignores Uncategorized history rows", () => {
        const labeled = [
            { vendor: "PETRO-CANADA 34871 MARKHAM", category: "Uncategorized" },
            { vendor: "PETRO-CANADA 35083 NEWMARKET", category: "" },
        ];
        expect(predictCategory("PETRO-CANADA 11111 OAKVILLE", labeled)).toBeNull();
    });

    it("uses an exact vendor rule before history", () => {
        const mixed = [
            { vendor: "WALMART.CA MISSISSAUGA", category: "Pokemon" },
            { vendor: "WALMART.CA MISSISSAUGA", category: "Pokemon" },
        ];
        const rules = [
            { matchType: "exact" as const, matchKey: "walmart ca mississauga", category: "Groceries" },
        ];
        const prediction = predictCategory("WALMART.CA MISSISSAUGA", mixed, rules);
        expect(prediction?.category).toBe("Groceries");
        expect(prediction?.source).toBe("rule");
    });

    it("uses a fingerprint rule when the exact vendor is new", () => {
        const rules = [
            { matchType: "fingerprint" as const, matchKey: "petro canada", category: "Fuel" },
        ];
        const prediction = predictCategory("PETRO-CANADA 11111 OAKVILLE", [], rules);
        expect(prediction?.category).toBe("Fuel");
        expect(prediction?.source).toBe("rule");
    });
});

describe("suggestDraftCategories", () => {
    it("fills Uncategorized drafts from history and keeps CSV categories", () => {
        const drafts = [
            { vendor: "PETRO-CANADA 34871 MARKHAM", category: "Uncategorized" },
            { vendor: "KOCHI JAPANESE BBQ AND Niagara Falls", category: "Food" },
            { vendor: "WALMART.CA MISSISSAUGA", category: "" },
        ];
        const { drafts: filled, suggested } = suggestDraftCategories(drafts, history);
        expect(filled[0].category).toBe("Fuel");
        expect(filled[1].category).toBe("Food");
        expect(filled[2].category).toBe("Pokemon");
        expect(suggested).toEqual([true, false, true]);
    });

    it("uses an already-labeled row in the same batch", () => {
        const drafts = [
            { vendor: "WL *STEAM PURCHASE", category: "Games" },
            { vendor: "wl *steam purchase", category: "Uncategorized" },
        ];
        const { drafts: filled, suggested } = suggestDraftCategories(drafts, []);
        expect(filled[1].category).toBe("Games");
        expect(suggested).toEqual([false, true]);
    });
});

describe("fillUncategorizedByFingerprint", () => {
    it("applies a user-chosen category to other Uncategorized rows with the same fingerprint", () => {
        const drafts = [
            { vendor: "PETRO-CANADA 34871 MARKHAM", category: "Fuel" },
            { vendor: "PETRO-CANADA 35083 NEWMARKET", category: "Uncategorized" },
            { vendor: "WALMART.CA MISSISSAUGA", category: "Uncategorized" },
        ];
        const { drafts: filled, filled: flags } = fillUncategorizedByFingerprint(
            drafts,
            "petro canada",
            "Fuel",
        );
        expect(filled[1].category).toBe("Fuel");
        expect(filled[2].category).toBe("Uncategorized");
        expect(flags).toEqual([false, true, false]);
    });
});
