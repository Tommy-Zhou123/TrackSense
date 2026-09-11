import { useMemo, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { Header } from "./Home";
import { useProfile } from "@/components/ProfileProvider";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GrainToggle, PeriodRangePicker } from "@/components/PeriodRangePicker";
import {
    aggregateCategoryPeriod,
    aggregateCategoryTotals,
    alignRangeToGrain,
    currentPeriodRange,
    dateKeyToPeriodKey,
    expenseInKeyRange,
    formatPeriodLabel,
    formatRangeLabel,
    normalizeCategory,
    trailingPeriodRange,
    uniqueCategories,
    type DateKeyRange,
    type PeriodGrain,
} from "@/utils/categoryMonth";
import {
    groupLookup,
    mapExpensesToGroups,
} from "@/utils/categoryGroup";
import { expensesByPerson } from "@/utils/expenseAttribution";

type ChartView = "category" | "group" | "person";

const CATEGORY_COLORS = [
    "#2563eb",
    "#16a34a",
    "#ea580c",
    "#9333ea",
    "#dc2626",
    "#0891b2",
    "#ca8a04",
    "#db2777",
    "#4f46e5",
    "#0d9488",
    "#65a30d",
    "#e11d48",
];

const TOTAL_KEY = "Total";

const currency = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
});

function formatCurrency(value: number): string {
    return currency.format(value);
}

function categoryColor(name: string): string {
    let hash = 0;
    for (let index = 0; index < name.length; index += 1) {
        hash = name.charCodeAt(index) + ((hash << 5) - hash);
    }
    return CATEGORY_COLORS[Math.abs(hash) % CATEGORY_COLORS.length];
}

function formatAxisLabel(key: string): string {
    if (/^\d{4}-\d{2}-\d{2}$/.test(key)) return formatPeriodLabel(key, "day");
    if (/^\d{4}-\d{2}$/.test(key)) return formatPeriodLabel(key, "month");
    if (/^\d{4}$/.test(key)) return formatPeriodLabel(key, "year");
    return key;
}

function ChartTooltip({
    active,
    payload,
    label,
}: {
    active?: boolean;
    payload?: ReadonlyArray<{ name?: string; value?: number; color?: string; payload?: { fill?: string } }>;
    label?: string | number;
}) {
    if (!active || !payload?.length) return null;
    const heading = typeof label === "string" ? formatAxisLabel(label) : null;
    return (
        <div className="rounded-md border bg-background px-3 py-2 text-sm shadow-md">
            {heading && heading !== payload[0]?.name ? <p className="mb-1.5 font-medium">{heading}</p> : null}
            {payload.map((item) => (
                <div key={String(item.name)} className="flex items-center gap-2">
                    <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ background: item.color || item.payload?.fill }}
                    />
                    <span className="text-muted-foreground">{item.name}</span>
                    <span className="ml-3 font-medium tabular-nums">{formatCurrency(Number(item.value ?? 0))}</span>
                </div>
            ))}
        </div>
    );
}

function LoadingPanel({ message }: { message: string }) {
    return (
        <div
            className="flex flex-col items-center justify-center gap-3 py-16 text-center"
            role="status"
            aria-live="polite"
        >
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">{message}</p>
        </div>
    );
}

function EmptyPanel({ message }: { message: string }) {
    return (
        <div className="px-6 py-16 text-center">
            <p className="text-sm text-muted-foreground">{message}</p>
        </div>
    );
}

function grainNoun(grain: PeriodGrain): string {
    if (grain === "day") return "day";
    if (grain === "month") return "month";
    return "year";
}

export default function Graphs() {
    const { activeProfile } = useProfile();
    const { expenses, groups, members: people, loading } = useWorkspace();
    const [deselected, setDeselected] = useState<Set<string>>(new Set());
    const [showCategories, setShowCategories] = useState(true);
    const [chartView, setChartView] = useState<ChartView>("category");
    const [barGrain, setBarGrain] = useState<PeriodGrain>("month");
    const [barRange, setBarRange] = useState<DateKeyRange>(() => trailingPeriodRange("month"));
    const [pieGrain, setPieGrain] = useState<PeriodGrain>("month");
    const [pieRange, setPieRange] = useState<DateKeyRange>(() => currentPeriodRange("month"));

    const lookup = useMemo(() => groupLookup(groups), [groups]);
    const chartExpenses = useMemo(() => {
        if (chartView === "person") {
            return expensesByPerson(expenses, people, activeProfile?.memberId);
        }
        if (chartView === "group") {
            return mapExpensesToGroups(expenses, lookup, { groupedOnly: true });
        }
        return expenses;
    }, [chartView, expenses, people, activeProfile?.memberId, lookup]);

    const alignedBarRange = useMemo(() => alignRangeToGrain(barRange, barGrain), [barRange, barGrain]);
    const alignedPieRange = useMemo(() => alignRangeToGrain(pieRange, pieGrain), [pieRange, pieGrain]);

    const inBarRange = useMemo(
        () => chartExpenses.filter((expense) => expenseInKeyRange(expense.date, alignedBarRange)),
        [chartExpenses, alignedBarRange],
    );

    const inPieRange = useMemo(
        () => chartExpenses.filter((expense) => expenseInKeyRange(expense.date, alignedPieRange)),
        [chartExpenses, alignedPieRange],
    );

    const availableCategories = useMemo(() => uniqueCategories(chartExpenses), [chartExpenses]);

    const selectedCategories = useMemo(
        () => availableCategories.filter((category) => !deselected.has(category)),
        [availableCategories, deselected],
    );

    const barCategories = useMemo(
        () => uniqueCategories(inBarRange).filter((category) => !deselected.has(category)),
        [inBarRange, deselected],
    );

    const chart = useMemo(() => (
        aggregateCategoryPeriod(inBarRange, {
            grain: barGrain,
            periodStart: dateKeyToPeriodKey(alignedBarRange.start, barGrain),
            periodEnd: dateKeyToPeriodKey(alignedBarRange.end, barGrain),
            categories: barCategories,
        })
    ), [inBarRange, barGrain, alignedBarRange, barCategories]);

    const barRows = useMemo(() => {
        if (showCategories) return chart.rows;
        return chart.rows.map((row) => ({
            period: row.period,
            [TOTAL_KEY]: chart.categories.reduce((sum, category) => sum + Number(row[category] || 0), 0),
        }));
    }, [chart, showCategories]);

    const pieData = useMemo(
        () => aggregateCategoryTotals(inPieRange, {
            categories: uniqueCategories(inPieRange).filter((category) => !deselected.has(category)),
        }),
        [inPieRange, deselected],
    );

    const sliceNoun = chartView === "person"
        ? "people"
        : chartView === "group"
            ? "category groups"
            : "categories";
    const sliceLabel = chartView === "person"
        ? "People"
        : chartView === "group"
            ? "Category groups"
            : "Categories";
    const allSelected = availableCategories.length > 0
        && selectedCategories.length === availableCategories.length;
    const categoryLabel = availableCategories.length === 0
        ? sliceLabel
        : allSelected
            ? `All ${sliceNoun}`
            : `${selectedCategories.length} of ${availableCategories.length} ${sliceNoun}`;

    function setViewMode(next: ChartView) {
        if (next === chartView) return;
        setChartView(next);
        setDeselected(new Set());
    }

    function toggleCategory(category: string, checked: boolean) {
        setDeselected((prev) => {
            const next = new Set(prev);
            if (checked) next.delete(category);
            else next.add(category);
            return next;
        });
    }

    function handleBarGrain(next: PeriodGrain) {
        setBarGrain(next);
        setBarRange((current) => alignRangeToGrain(current, next));
    }

    function handlePieGrain(next: PeriodGrain) {
        setPieGrain(next);
        setPieRange((current) => alignRangeToGrain(current, next));
    }

    const hasBarSpend = barCategories.length > 0 && inBarRange.some((expense) =>
        barCategories.includes(normalizeCategory(expense.category)),
    );
    const hasPieSpend = pieData.length > 0;
    const crowdedAxis = chart.periods.length > 8;

    return (
        <div className="min-h-screen bg-background pb-20">
            <Header />
            <main className="space-y-6 px-8 py-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <h1 className="text-4xl font-semibold tracking-tight">Graphs</h1>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="Chart grouping">
                            <Button
                                type="button"
                                size="sm"
                                variant={chartView === "category" ? "secondary" : "ghost"}
                                aria-pressed={chartView === "category"}
                                onClick={() => setViewMode("category")}
                            >
                                Categories
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant={chartView === "group" ? "secondary" : "ghost"}
                                aria-pressed={chartView === "group"}
                                onClick={() => setViewMode("group")}
                            >
                                Category groups
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant={chartView === "person" ? "secondary" : "ghost"}
                                aria-pressed={chartView === "person"}
                                onClick={() => setViewMode("person")}
                            >
                                People
                            </Button>
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" aria-label={`Filter ${sliceNoun}`}>
                                    {categoryLabel}
                                    <ChevronDown className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="max-h-80 w-56 overflow-y-auto">
                                <DropdownMenuLabel>
                                    {sliceLabel}
                                </DropdownMenuLabel>
                                <DropdownMenuItem
                                    onSelect={(event) => {
                                        event.preventDefault();
                                        setDeselected(new Set());
                                    }}
                                >
                                    Select all
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onSelect={(event) => {
                                        event.preventDefault();
                                        setDeselected(new Set(availableCategories));
                                    }}
                                >
                                    Clear
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {availableCategories.length === 0 ? (
                                    <DropdownMenuItem disabled>No {sliceNoun}</DropdownMenuItem>
                                ) : (
                                    availableCategories.map((category) => (
                                        <DropdownMenuCheckboxItem
                                            key={category}
                                            checked={!deselected.has(category)}
                                            onCheckedChange={(checked) => toggleCategory(category, checked === true)}
                                            onSelect={(event) => event.preventDefault()}
                                        >
                                            {category}
                                        </DropdownMenuCheckboxItem>
                                    ))
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                <div className="rounded-xl border bg-card">
                    {loading ? (
                        <LoadingPanel message="Loading your expenses..." />
                    ) : (
                        <div className="space-y-4 p-6">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <h2 className="text-lg font-semibold tracking-tight">
                                    {showCategories
                                        ? `Spend by ${chartView === "person" ? "person" : chartView === "group" ? "category group" : "category"} per ${grainNoun(barGrain)}`
                                        : `Spend per ${grainNoun(barGrain)}`}
                                </h2>
                                <div className="flex flex-wrap items-center gap-3">
                                    <GrainToggle
                                        value={barGrain}
                                        onChange={handleBarGrain}
                                        ariaLabel="Bar chart x-axis"
                                    />
                                    <PeriodRangePicker
                                        grain={barGrain}
                                        value={alignedBarRange}
                                        onChange={(range) => setBarRange(alignRangeToGrain(range, barGrain))}
                                    />
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            id="show-categories"
                                            checked={showCategories}
                                            onCheckedChange={(checked) => setShowCategories(checked === true)}
                                        />
                                        <Label htmlFor="show-categories" className="font-normal text-muted-foreground">
                                            {chartView === "person" ? "Show people" : chartView === "group" ? "Show groups" : "Show categories"}
                                        </Label>
                                    </div>
                                </div>
                            </div>
                            {!hasBarSpend ? (
                                <EmptyPanel message={`No expenses match the selected dates and ${sliceNoun}.`} />
                            ) : (
                            <div className="h-[420px] w-full overflow-visible">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={barRows} margin={{ top: 28, right: 8, left: 8, bottom: 8 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis
                                            dataKey="period"
                                            tickFormatter={formatAxisLabel}
                                            interval={crowdedAxis ? "preserveStartEnd" : 0}
                                            angle={crowdedAxis ? -35 : 0}
                                            textAnchor={crowdedAxis ? "end" : "middle"}
                                            height={crowdedAxis ? 64 : 32}
                                        />
                                        <YAxis
                                            tickFormatter={(value: number) => formatCurrency(Number(value))}
                                            width={80}
                                        />
                                        <Tooltip
                                            shared={false}
                                            allowEscapeViewBox={{ x: true, y: true }}
                                            reverseDirection={{ y: true }}
                                            offset={12}
                                            wrapperStyle={{ outline: "none" }}
                                            content={<ChartTooltip />}
                                            cursor={{ fill: "hsl(0 0% 0% / 0.04)" }}
                                        />
                                        {showCategories ? <Legend /> : null}
                                        {showCategories ? (
                                            chart.categories.map((category) => (
                                                <Bar
                                                    key={category}
                                                    dataKey={category}
                                                    stackId="spend"
                                                    fill={categoryColor(category)}
                                                />
                                            ))
                                        ) : (
                                            <Bar dataKey={TOTAL_KEY} fill={categoryColor(TOTAL_KEY)} />
                                        )}
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="rounded-xl border bg-card">
                    {loading ? (
                        <LoadingPanel message="Loading your expenses..." />
                    ) : (
                        <div className="space-y-4 p-6">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <h2 className="text-lg font-semibold tracking-tight">
                                        {chartView === "person"
                                            ? "Spend by person"
                                            : chartView === "group"
                                                ? "Spend by category group"
                                                : "Spend by category"}
                                    </h2>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        {formatRangeLabel(alignedPieRange, pieGrain)}
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                    <GrainToggle
                                        value={pieGrain}
                                        onChange={handlePieGrain}
                                        ariaLabel="Pie chart period"
                                    />
                                    <PeriodRangePicker
                                        grain={pieGrain}
                                        value={alignedPieRange}
                                        onChange={(range) => setPieRange(alignRangeToGrain(range, pieGrain))}
                                    />
                                </div>
                            </div>
                            {!hasPieSpend ? (
                                <EmptyPanel message={`No expenses match the selected dates and ${sliceNoun}.`} />
                            ) : (
                            <div className="h-[420px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={pieData}
                                            dataKey="amount"
                                            nameKey="category"
                                            cx="50%"
                                            cy="50%"
                                            outerRadius={130}
                                            paddingAngle={1}
                                            stroke="#fff"
                                        >
                                            {pieData.map((entry) => (
                                                <Cell key={entry.category} fill={categoryColor(entry.category)} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            allowEscapeViewBox={{ x: true, y: true }}
                                            wrapperStyle={{ outline: "none" }}
                                            content={<ChartTooltip />}
                                        />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            )}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
