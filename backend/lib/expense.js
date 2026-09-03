export function mapExpense(row) {
	return {
		_id: row.id,
		date: row.date,
		account: row.account,
		vendor: row.vendor,
		category: row.category,
		amount: Number(row.amount),
		notes: row.notes ?? "",
		user: row.user_id,
	};
}

export function toDateValue(value) {
	if (!value) return null;
	if (typeof value === "string") return value.slice(0, 10);
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return null;
	return date.toISOString().slice(0, 10);
}
