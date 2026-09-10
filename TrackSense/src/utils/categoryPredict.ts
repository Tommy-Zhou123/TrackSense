export const UNCATEGORIZED = "Uncategorized";

const TLD_TOKENS = new Set(["ca", "com", "net", "org", "www"]);
const MAJORITY = 0.7;
const LONG_TOKEN = 6;

export interface LabeledVendor {
    vendor: string;
    category: string;
}

export type VendorMatchType = "exact" | "fingerprint";

export interface VendorRule {
    matchType: VendorMatchType;
    matchKey: string;
    category: string;
}

export interface CategoryPrediction {
    category: string;
    fingerprint: string;
    source: "rule" | "history";
}

export function isUncategorized(category: string | undefined | null): boolean {
    const value = (category || "").trim();
    return !value || value.toLowerCase() === UNCATEGORIZED.toLowerCase();
}

export function normalizeVendor(vendor: string): string {
    let text = String(vendor || "").toLowerCase();
    const star = text.indexOf("*");
    if (star !== -1) {
        text = text.slice(star + 1);
    }
    return text
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim()
        .replace(/\s+/g, " ");
}

function isHardStop(token: string): boolean {
    if (/^\d+$/.test(token)) return true;
    return (token.match(/\d/g) || []).length >= 3;
}

export function vendorFingerprint(vendor: string): string {
    const tokens = normalizeVendor(vendor).split(" ").filter(Boolean);
    const collected: string[] = [];

    for (const token of tokens) {
        if (token.length === 1 || TLD_TOKENS.has(token)) continue;
        if (isHardStop(token)) break;
        collected.push(token);
    }

    if (collected.length === 0) return "";
    if (collected[0].length >= LONG_TOKEN) return collected[0];
    return collected.slice(0, 2).join(" ");
}

function isSpecificFingerprint(fingerprint: string): boolean {
    if (!fingerprint) return false;
    return fingerprint.length >= LONG_TOKEN || fingerprint.split(" ").length >= 2;
}

function fingerprintsRelated(query: string, other: string): boolean {
    if (!query || !other) return false;
    if (query === other) return true;
    if (other.startsWith(`${query} `) && isSpecificFingerprint(query)) return true;
    if (query.startsWith(`${other} `) && isSpecificFingerprint(other)) return true;
    return false;
}

function voteCategory(rows: LabeledVendor[]): string | null {
    const counts = new Map<string, number>();
    for (const row of rows) {
        const category = (row.category || "").trim();
        if (isUncategorized(category)) continue;
        counts.set(category, (counts.get(category) || 0) + 1);
    }

    let top = "";
    let topCount = 0;
    let total = 0;
    for (const [category, count] of counts) {
        total += count;
        if (count > topCount) {
            top = category;
            topCount = count;
        }
    }

    if (total === 0) return null;
    if (topCount / total >= MAJORITY) return top;
    return null;
}

export function predictCategory(
    vendor: string,
    labeled: LabeledVendor[],
    rules: VendorRule[] = [],
): CategoryPrediction | null {
    const fingerprint = vendorFingerprint(vendor);
    const normalized = normalizeVendor(vendor);
    if (!normalized) return null;

    const exactRule = rules.find((rule) =>
        rule.matchType === "exact"
        && rule.matchKey === normalized
        && !isUncategorized(rule.category)
    );
    if (exactRule) {
        return { category: exactRule.category, fingerprint, source: "rule" };
    }

    const fingerprintRule = fingerprint
        ? rules.find((rule) =>
            rule.matchType === "fingerprint"
            && rule.matchKey === fingerprint
            && !isUncategorized(rule.category)
        )
        : undefined;
    if (fingerprintRule) {
        return { category: fingerprintRule.category, fingerprint, source: "rule" };
    }

    const usable = labeled.filter((row) => row.vendor && !isUncategorized(row.category));

    const exact = usable.filter((row) => normalizeVendor(row.vendor) === normalized);
    if (exact.length > 0) {
        const category = voteCategory(exact);
        return category ? { category, fingerprint, source: "history" } : null;
    }

    if (fingerprint) {
        const same = usable.filter((row) => vendorFingerprint(row.vendor) === fingerprint);
        if (same.length > 0) {
            const category = voteCategory(same);
            return category ? { category, fingerprint, source: "history" } : null;
        }

        if (isSpecificFingerprint(fingerprint)) {
            const related = usable.filter((row) =>
                fingerprintsRelated(fingerprint, vendorFingerprint(row.vendor))
            );
            const category = voteCategory(related);
            if (category) return { category, fingerprint, source: "history" };
        }
    }

    return null;
}

export function suggestDraftCategories<T extends LabeledVendor>(
    drafts: T[],
    history: LabeledVendor[],
    rules: VendorRule[] = [],
): { drafts: T[]; suggested: boolean[] } {
    const next = drafts.map((draft) => ({ ...draft }));
    const suggested = next.map(() => false);
    const labeled = [
        ...history.filter((row) => !isUncategorized(row.category)),
        ...next.filter((row) => !isUncategorized(row.category)),
    ];

    for (let i = 0; i < next.length; i++) {
        if (!isUncategorized(next[i].category)) continue;
        const prediction = predictCategory(next[i].vendor, labeled, rules);
        if (!prediction) continue;
        next[i] = { ...next[i], category: prediction.category };
        suggested[i] = true;
        labeled.push(next[i]);
    }

    return { drafts: next, suggested };
}

export function fillUncategorizedByFingerprint<T extends LabeledVendor>(
    drafts: T[],
    fingerprint: string,
    category: string,
): { drafts: T[]; filled: boolean[] } {
    const filled = drafts.map(() => false);
    if (!fingerprint || isUncategorized(category)) {
        return { drafts, filled };
    }

    const next = drafts.map((draft, index) => {
        if (!isUncategorized(draft.category)) return draft;
        if (vendorFingerprint(draft.vendor) !== fingerprint) return draft;
        filled[index] = true;
        return { ...draft, category };
    });

    return { drafts: next, filled };
}

export function fillUncategorizedByExactVendor<T extends LabeledVendor>(
    drafts: T[],
    vendor: string,
    category: string,
): { drafts: T[]; filled: boolean[] } {
    const filled = drafts.map(() => false);
    const key = normalizeVendor(vendor);
    if (!key || isUncategorized(category)) {
        return { drafts, filled };
    }

    const next = drafts.map((draft, index) => {
        if (!isUncategorized(draft.category)) return draft;
        if (normalizeVendor(draft.vendor) !== key) return draft;
        filled[index] = true;
        return { ...draft, category };
    });

    return { drafts: next, filled };
}
