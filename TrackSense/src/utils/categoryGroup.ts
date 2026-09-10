import { normalizeCategory } from "./categoryMonth";

export interface CategoryGroup {
    id: string;
    name: string;
    categories: string[];
}

export interface GroupOwner {
    id: string;
    name: string;
}

function leafKey(category: string | undefined | null): string {
    return normalizeCategory(category).toLowerCase();
}

export function groupLookup(groups: CategoryGroup[]): Map<string, string> {
    const lookup = new Map<string, string>();
    for (const group of groups) {
        const parent = group.name.trim();
        if (!parent) continue;
        for (const category of group.categories) {
            const key = leafKey(category);
            if (!key) continue;
            lookup.set(key, parent);
        }
    }
    return lookup;
}

export function resolveCategory(
    leaf: string | undefined | null,
    lookup: Map<string, string>,
): string {
    const normalized = normalizeCategory(leaf);
    return lookup.get(normalized.toLowerCase()) || normalized;
}

export function mapExpensesToGroups<T extends { category: string }>(
    expenses: T[],
    lookup: Map<string, string>,
    options: { groupedOnly?: boolean } = {},
): T[] {
    const mapped: T[] = [];
    for (const expense of expenses) {
        const group = lookup.get(normalizeCategory(expense.category).toLowerCase());
        if (group) {
            mapped.push({ ...expense, category: group });
            continue;
        }
        if (options.groupedOnly) continue;
        mapped.push({ ...expense, category: normalizeCategory(expense.category) });
    }
    return mapped;
}

export function uniqueLeafCategories(
    expenses: { category?: string | null }[],
    extra: Iterable<string> = [],
): string[] {
    const seen = new Set<string>();
    const names: string[] = [];
    function add(raw: string | undefined | null) {
        const name = (raw || "").trim();
        if (!name) return;
        const key = name.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        names.push(name);
    }
    for (const expense of expenses) add(expense.category);
    for (const name of extra) add(name);
    return names.sort((a, b) => a.localeCompare(b));
}

export function memberOwnerLookup(groups: CategoryGroup[]): Map<string, GroupOwner> {
    const lookup = new Map<string, GroupOwner>();
    for (const group of groups) {
        for (const category of group.categories) {
            const key = category.trim().toLowerCase();
            if (!key) continue;
            lookup.set(key, { id: group.id, name: group.name });
        }
    }
    return lookup;
}

export function sameCategorySet(a: Iterable<string>, b: Iterable<string>): boolean {
    const left = new Set([...a].map((name) => name.trim().toLowerCase()).filter(Boolean));
    const right = new Set([...b].map((name) => name.trim().toLowerCase()).filter(Boolean));
    if (left.size !== right.size) return false;
    for (const name of left) {
        if (!right.has(name)) return false;
    }
    return true;
}

export function sortLeafCategories(
    names: Iterable<string>,
    options: {
        selectedGroupId?: string | null;
        owners: Map<string, GroupOwner>;
    },
): string[] {
    function bucket(name: string): number {
        const key = name.trim().toLowerCase();
        const owner = options.owners.get(key);
        if (options.selectedGroupId && owner?.id === options.selectedGroupId) return 0;
        if (owner && owner.id !== options.selectedGroupId) return 2;
        return 1;
    }

    return [...names].sort((a, b) => bucket(a) - bucket(b) || a.localeCompare(b));
}
