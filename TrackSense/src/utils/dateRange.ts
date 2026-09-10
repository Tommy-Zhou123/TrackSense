export const DATE_RANGE_OPTIONS = [
    { value: "all", label: "All dates" },
    { value: "this-month", label: "This month" },
    { value: "last-month", label: "Last month" },
    { value: "last-3-months", label: "Last 3 months" },
    { value: "last-12-months", label: "Last 12 months" },
    { value: "ytd", label: "Year to date" },
] as const;

export type DateRangePreset = (typeof DATE_RANGE_OPTIONS)[number]["value"];

function pad(value: number): string {
    return String(value).padStart(2, "0");
}

export function toDateKey(year: number, monthIndex: number, day: number): string {
    return `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
}

export function expenseDateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
}

export function dateRangeKeys(
    preset: DateRangePreset,
    now: Date = new Date(),
): { start: string; end: string } | null {
    if (preset === "all") return null;

    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDate();
    const today = toDateKey(year, month, day);

    if (preset === "this-month") {
        const lastDay = new Date(year, month + 1, 0).getDate();
        return { start: toDateKey(year, month, 1), end: toDateKey(year, month, lastDay) };
    }

    if (preset === "last-month") {
        const start = new Date(year, month - 1, 1);
        const lastDay = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
        return {
            start: toDateKey(start.getFullYear(), start.getMonth(), 1),
            end: toDateKey(start.getFullYear(), start.getMonth(), lastDay),
        };
    }

    if (preset === "last-3-months") {
        const start = new Date(year, month - 3, day);
        return {
            start: toDateKey(start.getFullYear(), start.getMonth(), start.getDate()),
            end: today,
        };
    }

    if (preset === "last-12-months") {
        const start = new Date(year - 1, month, day);
        return {
            start: toDateKey(start.getFullYear(), start.getMonth(), start.getDate()),
            end: today,
        };
    }

    return { start: toDateKey(year, 0, 1), end: today };
}

export function expenseInDateRange(
    date: Date,
    preset: DateRangePreset,
    now: Date = new Date(),
): boolean {
    const bounds = dateRangeKeys(preset, now);
    if (!bounds) return true;
    if (Number.isNaN(date.getTime())) return false;
    const key = expenseDateKey(date);
    return key >= bounds.start && key <= bounds.end;
}

export function lastNMonthRange(
    count: number,
    now: Date = new Date(),
): { start: string; end: string } {
    const n = Math.max(1, Math.floor(count));
    const endYear = now.getFullYear();
    const endMonth = now.getMonth();
    const lastDay = new Date(endYear, endMonth + 1, 0).getDate();
    const start = new Date(endYear, endMonth - (n - 1), 1);
    return {
        start: toDateKey(start.getFullYear(), start.getMonth(), 1),
        end: toDateKey(endYear, endMonth, lastDay),
    };
}

export function expenseInLastNMonths(
    date: Date,
    count: number,
    now: Date = new Date(),
): boolean {
    if (Number.isNaN(date.getTime())) return false;
    const bounds = lastNMonthRange(count, now);
    const key = expenseDateKey(date);
    return key >= bounds.start && key <= bounds.end;
}
