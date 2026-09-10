export function defaultSplitPercents(count) {
	const n = Number(count);
	if (!Number.isInteger(n) || n <= 0) return [];
	const base = Math.floor((100 * 1000) / n) / 1000;
	const parts = [];
	for (let i = 0; i < n - 1; i += 1) parts.push(base);
	parts.push(Math.round((100 - base * (n - 1)) * 1000) / 1000);
	return parts;
}

export function isEvenSplit(values) {
	const n = values.length;
	if (n <= 1) return true;
	const nums = values.map((value) => Number(value));
	if (nums.some((value) => !Number.isFinite(value))) return true;
	const sum = nums.reduce((total, value) => total + value, 0);
	if (sum <= 0) return true;
	const expected = 100 / n;
	return nums.every((value) => Math.abs(value - expected) < 0.6);
}

export function scalePercentsTo100(values) {
	const nums = values.map((value) => Math.max(0, Number(value) || 0));
	if (nums.length === 0) return [];
	const sum = nums.reduce((total, value) => total + value, 0);
	if (sum <= 0) return defaultSplitPercents(nums.length);
	const scaled = nums.map((value) => Math.round(((value * 100) / sum) * 1000) / 1000);
	const used = scaled.slice(0, -1).reduce((total, value) => total + value, 0);
	scaled[scaled.length - 1] = Math.round((100 - used) * 1000) / 1000;
	return scaled;
}
