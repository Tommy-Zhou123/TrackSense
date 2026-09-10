export function mapVendorRule(row) {
	return {
		id: row.id,
		matchType: row.match_type,
		matchKey: row.match_key,
		category: row.category,
	};
}

export const MATCH_TYPES = new Set(["exact", "fingerprint"]);
export const MAX_RULE_CHARS = 500;
