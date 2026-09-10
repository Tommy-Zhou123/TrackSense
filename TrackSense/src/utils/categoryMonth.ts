import { UNCATEGORIZED } from "./categoryPredict";
import { expenseDateKey, toDateKey } from "./dateRange";

export type PeriodGrain = "day" | "month" | "year";

export interface DateKeyRange {
    start: string;
    end: string;
}

export interface CategoryMonthExpense {
    date: Date;
    category: string;
    amount: number;
}

export interface CategoryMonthRow {
    month: string;
    [category: string]: string | number;
}

export interface CategoryMonthChart {
    months: string[];
    categories: string[];
    rows: CategoryMonthRow[];
}

export function normalizeCategory(category: string | undefined | null): string {
    const value = (category || "").trim();
    return value || UNCATEGORIZED;
}

export function monthKeyFromDate(date: Date): string | null {
    return periodKeyFromDate(date, "month");
}

export function periodKeyFromDate(date: Date, grain: PeriodGrain): string | null {
    if (Number.isNaN(date.getTime())) return null;
    const key = expenseDateKey(date);
    if (grain === "day") return key;
    if (grain === "month") return key.slice(0, 7);
    return key.slice(0, 4);
}

export function dateKeyToPeriodKey(dateKey: string, grain: PeriodGrain): string {
    if (grain === "day") return dateKey.slice(0, 10);
    if (grain === "month") return dateKey.slice(0, 7);
    return dateKey.slice(0, 4);
}

export function lastDayOfMonth(year: number, monthIndex: number): number {
    return new Date(year, monthIndex + 1, 0).getDate();
}

export function alignRangeToGrain(range: DateKeyRange, grain: PeriodGrain): DateKeyRange {
    const start = range.start <= range.end ? range.start : range.end;
    const end = range.start <= range.end ? range.end : range.start;
    const [startYear, startMonth, startDay] = start.split("-").map(Number);
    const [endYear, endMonth, endDay] = end.split("-").map(Number);
    if (grain === "day") {
        return {
            start: toDateKey(startYear, startMonth - 1, startDay),
            end: toDateKey(endYear, endMonth - 1, endDay),
        };
    }
    if (grain === "month") {
        return {
            start: toDateKey(startYear, startMonth - 1, 1),
            end: toDateKey(endYear, endMonth - 1, lastDayOfMonth(endYear, endMonth - 1)),
        };
    }
    return {
        start: toDateKey(startYear, 0, 1),
        end: toDateKey(endYear, 11, 31),
    };
}

export function currentPeriodRange(grain: PeriodGrain, now: Date = new Date()): DateKeyRange {
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDate();
    if (grain === "day") {
        const key = toDateKey(year, month, day);
        return { start: key, end: key };
    }
    if (grain === "month") {
        return {
            start: toDateKey(year, month, 1),
            end: toDateKey(year, month, lastDayOfMonth(year, month)),
        };
    }
    return { start: toDateKey(year, 0, 1), end: toDateKey(year, 11, 31) };
}

export function trailingPeriodRange(grain: PeriodGrain, now: Date = new Date()): DateKeyRange {
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDate();
    if (grain === "day") {
        const start = new Date(year, month, day - 29);
        return alignRangeToGrain({
            start: toDateKey(start.getFullYear(), start.getMonth(), start.getDate()),
            end: toDateKey(year, month, day),
        }, "day");
    }
    if (grain === "month") {
        const start = new Date(year, month - 11, 1);
        return alignRangeToGrain({
            start: toDateKey(start.getFullYear(), start.getMonth(), 1),
            end: toDateKey(year, month, lastDayOfMonth(year, month)),
        }, "month");
    }
    return alignRangeToGrain({
        start: toDateKey(year - 4, 0, 1),
        end: toDateKey(year, 11, 31),
    }, "year");
}

export function expenseInKeyRange(date: Date, range: DateKeyRange): boolean {
    if (Number.isNaN(date.getTime())) return false;
    const key = expenseDateKey(date);
    return key >= range.start && key <= range.end;
}

export function formatMonthLabel(monthKey: string): string {
    return formatPeriodLabel(monthKey, "month");
}

export function formatPeriodLabel(periodKey: string, grain: PeriodGrain): string {
    if (grain === "year") {
        return /^\d{4}$/.test(periodKey) ? periodKey : periodKey.slice(0, 4);
    }
    if (grain === "month") {
        const [yearText, monthText] = periodKey.split("-");
        const year = Number(yearText);
        const month = Number(monthText);
        if (!year || !month || month < 1 || month > 12) return periodKey;
        return new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-US", {
            month: "short",
            year: "numeric",
            timeZone: "UTC",
        });
    }
    const [yearText, monthText, dayText] = periodKey.split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    if (!year || !month || !day) return periodKey;
    return new Date(Date.UTC(year, month - 1, day)).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
    });
}

export function formatRangeLabel(range: DateKeyRange, grain: PeriodGrain): string {
    const aligned = alignRangeToGrain(range, grain);
    const startKey = dateKeyToPeriodKey(aligned.start, grain);
    const endKey = dateKeyToPeriodKey(aligned.end, grain);
    if (startKey === endKey) return formatPeriodLabel(startKey, grain);
    return `${formatPeriodLabel(startKey, grain)} – ${formatPeriodLabel(endKey, grain)}`;
}

export function listMonthsInclusive(start: string, end: string): string[] {
    if (!start || !end || start > end) return [];
    const [startYear, startMonth] = start.split("-").map(Number);
    const [endYear, endMonth] = end.split("-").map(Number);
    if (!startYear || !startMonth || !endYear || !endMonth) return [];

    const months: string[] = [];
    let year = startYear;
    let month = startMonth;
    while (year < endYear || (year === endYear && month <= endMonth)) {
        months.push(`${year}-${String(month).padStart(2, "0")}`);
        month += 1;
        if (month > 12) {
            month = 1;
            year += 1;
        }
    }
    return months;
}

export function listDaysInclusive(start: string, end: string): string[] {
    if (!start || !end || start > end) return [];
    const days: string[] = [];
    let current = start;
    while (current <= end) {
        days.push(current);
        const [year, month, day] = current.split("-").map(Number);
        current = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
    }
    return days;
}

export function listYearsInclusive(start: string, end: string): string[] {
    const startYear = Number(start);
    const endYear = Number(end);
    if (!startYear || !endYear || startYear > endYear) return [];
    const years: string[] = [];
    for (let year = startYear; year <= endYear; year += 1) years.push(String(year));
    return years;
}

export function listPeriodsInclusive(start: string, end: string, grain: PeriodGrain): string[] {
    if (grain === "day") return listDaysInclusive(start, end);
    if (grain === "month") return listMonthsInclusive(start, end);
    return listYearsInclusive(start, end);
}

function compareCategories(a: string, b: string): number {
    if (a === UNCATEGORIZED && b !== UNCATEGORIZED) return 1;
    if (b === UNCATEGORIZED && a !== UNCATEGORIZED) return -1;
    return a.localeCompare(b);
}

export function uniqueCategories(expenses: CategoryMonthExpense[]): string[] {
    const seen = new Set<string>();
    for (const expense of expenses) {
        if (Number.isNaN(expense.date.getTime())) continue;
        seen.add(normalizeCategory(expense.category));
    }
    return [...seen].sort(compareCategories);
}

export function aggregateCategoryMonth(
    expenses: CategoryMonthExpense[],
    options: {
        monthStart?: string;
        monthEnd?: string;
        categories?: Iterable<string>;
    } = {},
): CategoryMonthChart {
    const chart = aggregateCategoryPeriod(expenses, {
        grain: "month",
        periodStart: options.monthStart,
        periodEnd: options.monthEnd,
        categories: options.categories,
    });
    return {
        months: chart.periods,
        categories: chart.categories,
        rows: chart.rows.map(({ period, ...rest }) => ({ month: period, ...rest })),
    };
}

export interface CategoryPeriodRow {
    period: string;
    [category: string]: string | number;
}

export interface CategoryPeriodChart {
    periods: string[];
    categories: string[];
    rows: CategoryPeriodRow[];
}

export function aggregateCategoryPeriod(
    expenses: CategoryMonthExpense[],
    options: {
        grain: PeriodGrain;
        periodStart?: string;
        periodEnd?: string;
        categories?: Iterable<string>;
    },
): CategoryPeriodChart {
    const categoryFilter = options.categories
        ? new Set([...options.categories].map(normalizeCategory))
        : null;

    const totals = new Map<string, number>();
    const discovered = new Set<string>();
    let dataStart: string | null = null;
    let dataEnd: string | null = null;

    for (const expense of expenses) {
        const period = periodKeyFromDate(expense.date, options.grain);
        if (!period) continue;
        const category = normalizeCategory(expense.category);
        if (categoryFilter && !categoryFilter.has(category)) continue;
        if (!Number.isFinite(expense.amount)) continue;

        discovered.add(category);
        if (!dataStart || period < dataStart) dataStart = period;
        if (!dataEnd || period > dataEnd) dataEnd = period;

        const key = `${period}\0${category}`;
        totals.set(key, (totals.get(key) || 0) + expense.amount);
    }

    const periods = options.periodStart && options.periodEnd
        ? listPeriodsInclusive(options.periodStart, options.periodEnd, options.grain)
        : dataStart && dataEnd
            ? listPeriodsInclusive(dataStart, dataEnd, options.grain)
            : [];

    const categories = categoryFilter
        ? [...categoryFilter].sort(compareCategories)
        : [...discovered].sort(compareCategories);

    const rows: CategoryPeriodRow[] = periods.map((period) => {
        const row: CategoryPeriodRow = { period };
        for (const category of categories) {
            row[category] = totals.get(`${period}\0${category}`) || 0;
        }
        return row;
    });

    return { periods, categories, rows };
}

export interface CategoryTotal {
    category: string;
    amount: number;
}

export function aggregateCategoryTotals(
    expenses: CategoryMonthExpense[],
    options: { categories?: Iterable<string> } = {},
): CategoryTotal[] {
    const categoryFilter = options.categories
        ? new Set([...options.categories].map(normalizeCategory))
        : null;
    const totals = new Map<string, number>();

    for (const expense of expenses) {
        if (!monthKeyFromDate(expense.date)) continue;
        if (!Number.isFinite(expense.amount)) continue;
        const category = normalizeCategory(expense.category);
        if (categoryFilter && !categoryFilter.has(category)) continue;
        totals.set(category, (totals.get(category) || 0) + expense.amount);
    }

    const categories = categoryFilter
        ? [...categoryFilter].sort(compareCategories)
        : [...totals.keys()].sort(compareCategories);

    return categories
        .map((category) => ({ category, amount: totals.get(category) || 0 }))
        .filter((entry) => entry.amount !== 0)
        .sort((a, b) => b.amount - a.amount || compareCategories(a.category, b.category));
}
