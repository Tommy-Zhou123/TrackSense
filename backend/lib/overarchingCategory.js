export const MAX_GROUP_NAME = 80;
export const MAX_MEMBER_CATEGORY = 200;
export const MAX_MEMBERS = 500;

const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value) {
	return UUID_RE.test(String(value || ""));
}

export function clip(value, max) {
	return String(value || "").trim().slice(0, max);
}

export function isUniqueViolation(error) {
	return error?.code === "23505";
}

export const UNCATEGORIZED = "Uncategorized";

export function namesMatch(a, b) {
	return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
}

export function uniqueCategories(names) {
	const seen = new Set();
	const result = [];
	for (const name of names) {
		const value = clip(name, MAX_MEMBER_CATEGORY);
		if (!value || namesMatch(value, UNCATEGORIZED)) continue;
		const key = value.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		result.push(value);
	}
	return result;
}

export function mapGroup(row) {
	const members = row.overarching_category_members || [];
	const categories = members
		.map((member) => member.category)
		.filter(Boolean)
		.sort((a, b) => a.localeCompare(b));
	return {
		id: row.id,
		name: row.name,
		categories,
	};
}
