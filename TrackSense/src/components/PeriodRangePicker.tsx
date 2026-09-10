import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
    alignRangeToGrain,
    dateKeyToPeriodKey,
    formatRangeLabel,
    lastDayOfMonth,
    type DateKeyRange,
    type PeriodGrain,
} from "@/utils/categoryMonth";
import { toDateKey } from "@/utils/dateRange";

const GRAINS: { value: PeriodGrain; label: string }[] = [
    { value: "day", label: "Day" },
    { value: "month", label: "Month" },
    { value: "year", label: "Year" },
];

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

const navSelectClassName = "h-8 min-w-0 rounded-md border border-input bg-transparent px-1.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

function yearOptions(centerYear: number): number[] {
    const current = new Date().getFullYear();
    const start = Math.min(centerYear, current) - 25;
    const end = Math.max(centerYear, current) + 1;
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

export function GrainToggle({
    value,
    onChange,
    ariaLabel,
}: {
    value: PeriodGrain;
    onChange: (grain: PeriodGrain) => void;
    ariaLabel: string;
}) {
    return (
        <div className="inline-flex rounded-md border p-0.5" role="group" aria-label={ariaLabel}>
            {GRAINS.map((grain) => (
                <Button
                    key={grain.value}
                    type="button"
                    size="sm"
                    variant={value === grain.value ? "secondary" : "ghost"}
                    aria-pressed={value === grain.value}
                    onClick={() => onChange(grain.value)}
                >
                    {grain.label}
                </Button>
            ))}
        </div>
    );
}

export function PeriodRangePicker({
    grain,
    value,
    onChange,
    onGrainChange,
    onClear,
    align = "end",
}: {
    grain: PeriodGrain;
    value: DateKeyRange | null;
    onChange: (range: DateKeyRange) => void;
    onGrainChange?: (grain: PeriodGrain) => void;
    onClear?: () => void;
    align?: "start" | "end";
}) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const aligned = value ? alignRangeToGrain(value, grain) : null;

    useEffect(() => {
        if (!open) return;
        function handlePointer(event: MouseEvent) {
            if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
        }
        function handleKey(event: KeyboardEvent) {
            if (event.key === "Escape") setOpen(false);
        }
        document.addEventListener("mousedown", handlePointer);
        document.addEventListener("keydown", handleKey);
        return () => {
            document.removeEventListener("mousedown", handlePointer);
            document.removeEventListener("keydown", handleKey);
        };
    }, [open]);

    function handleGrainChange(next: PeriodGrain) {
        onGrainChange?.(next);
        if (aligned) onChange(alignRangeToGrain(aligned, next));
    }

    return (
        <div className="relative" ref={rootRef}>
            <Button
                type="button"
                variant="outline"
                onClick={() => setOpen((current) => !current)}
                aria-expanded={open}
                aria-haspopup="dialog"
                aria-label="Date range"
            >
                <CalendarDays className="h-4 w-4" />
                {aligned ? formatRangeLabel(aligned, grain) : "All dates"}
            </Button>
            {open ? (
                <div
                    className={cn(
                        "absolute z-50 mt-2 w-[21rem] rounded-xl border bg-popover p-3 text-popover-foreground shadow-md",
                        align === "end" ? "right-0" : "left-0",
                    )}
                    role="dialog"
                    aria-label="Select date range"
                >
                    <div className="space-y-3">
                        {onGrainChange ? (
                            <GrainToggle
                                value={grain}
                                onChange={handleGrainChange}
                                ariaLabel="Date range unit"
                            />
                        ) : null}
                        {grain === "day" ? (
                            <DayCalendar value={aligned} onChange={onChange} onComplete={() => setOpen(false)} />
                        ) : grain === "month" ? (
                            <MonthCalendar value={aligned} onChange={onChange} onComplete={() => setOpen(false)} />
                        ) : (
                            <YearCalendar value={aligned} onChange={onChange} onComplete={() => setOpen(false)} />
                        )}
                        {onClear ? (
                            <Button
                                type="button"
                                size="sm"
                                variant={aligned ? "ghost" : "secondary"}
                                className="w-full"
                                onClick={() => {
                                    onClear();
                                    setOpen(false);
                                }}
                            >
                                All dates
                            </Button>
                        ) : null}
                    </div>
                </div>
            ) : null}
        </div>
    );
}

function rangeFromKeys(a: string, b: string, grain: PeriodGrain): DateKeyRange {
    return alignRangeToGrain({ start: a, end: b }, grain);
}

function DayCalendar({
    value,
    onChange,
    onComplete,
}: {
    value: DateKeyRange | null;
    onChange: (range: DateKeyRange) => void;
    onComplete?: () => void;
}) {
    const today = new Date();
    const startParts = (value?.start ?? toDateKey(today.getFullYear(), today.getMonth(), today.getDate()))
        .split("-")
        .map(Number);
    const [viewYear, setViewYear] = useState(startParts[0]);
    const [viewMonth, setViewMonth] = useState(startParts[1] - 1);
    const [anchor, setAnchor] = useState<string | null>(null);
    const years = useMemo(() => yearOptions(viewYear), [viewYear]);

    const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
    const days = lastDayOfMonth(viewYear, viewMonth);
    const cells: (number | null)[] = [
        ...Array.from({ length: firstWeekday }, () => null),
        ...Array.from({ length: days }, (_, index) => index + 1),
    ];

    function shift(delta: number) {
        const next = new Date(viewYear, viewMonth + delta, 1);
        setViewYear(next.getFullYear());
        setViewMonth(next.getMonth());
    }

    function selectDay(day: number) {
        const key = toDateKey(viewYear, viewMonth, day);
        if (!anchor) {
            setAnchor(key);
            onChange(rangeFromKeys(key, key, "day"));
            return;
        }
        onChange(rangeFromKeys(anchor, key, "day"));
        setAnchor(null);
        onComplete?.();
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-1">
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => shift(-1)} aria-label="Previous month">
                    <ChevronLeft />
                </Button>
                <select
                    aria-label="Month"
                    className={cn(navSelectClassName, "flex-1")}
                    value={viewMonth}
                    onChange={(event) => setViewMonth(Number(event.target.value))}
                >
                    {MONTH_NAMES.map((label, monthIndex) => (
                        <option key={label} value={monthIndex}>{label}</option>
                    ))}
                </select>
                <select
                    aria-label="Year"
                    className={cn(navSelectClassName, "w-[5.25rem]")}
                    value={viewYear}
                    onChange={(event) => setViewYear(Number(event.target.value))}
                >
                    {years.map((year) => (
                        <option key={year} value={year}>{year}</option>
                    ))}
                </select>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => shift(1)} aria-label="Next month">
                    <ChevronRight />
                </Button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
                {WEEKDAYS.map((day) => (
                    <div key={day} className="py-1">{day}</div>
                ))}
                {cells.map((day, index) => {
                    if (day == null) return <div key={`empty-${index}`} />;
                    const key = toDateKey(viewYear, viewMonth, day);
                    const selected = Boolean(value && key >= value.start && key <= value.end);
                    const edge = Boolean(value && (key === value.start || key === value.end));
                    return (
                        <button
                            key={key}
                            type="button"
                            className={cn(
                                "h-8 rounded-md text-sm hover:bg-accent",
                                selected && "bg-secondary",
                                edge && "bg-primary text-primary-foreground hover:bg-primary",
                            )}
                            onClick={() => selectDay(day)}
                        >
                            {day}
                        </button>
                    );
                })}
            </div>
            <p className="text-xs text-muted-foreground">Click a start day, then an end day.</p>
        </div>
    );
}

function MonthCalendar({
    value,
    onChange,
    onComplete,
}: {
    value: DateKeyRange | null;
    onChange: (range: DateKeyRange) => void;
    onComplete?: () => void;
}) {
    const todayYear = new Date().getFullYear();
    const [viewYear, setViewYear] = useState(Number((value?.start ?? `${todayYear}-01-01`).slice(0, 4)));
    const [anchor, setAnchor] = useState<string | null>(null);
    const years = useMemo(() => yearOptions(viewYear), [viewYear]);
    const startKey = value ? dateKeyToPeriodKey(value.start, "month") : "";
    const endKey = value ? dateKeyToPeriodKey(value.end, "month") : "";

    function selectMonth(monthIndex: number) {
        const key = toDateKey(viewYear, monthIndex, 1);
        if (!anchor) {
            setAnchor(key);
            onChange(rangeFromKeys(key, key, "month"));
            return;
        }
        onChange(rangeFromKeys(anchor, key, "month"));
        setAnchor(null);
        onComplete?.();
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-1">
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => setViewYear((year) => year - 1)} aria-label="Previous year">
                    <ChevronLeft />
                </Button>
                <select
                    aria-label="Year"
                    className={cn(navSelectClassName, "flex-1")}
                    value={viewYear}
                    onChange={(event) => setViewYear(Number(event.target.value))}
                >
                    {years.map((year) => (
                        <option key={year} value={year}>{year}</option>
                    ))}
                </select>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => setViewYear((year) => year + 1)} aria-label="Next year">
                    <ChevronRight />
                </Button>
            </div>
            <div className="grid grid-cols-3 gap-1">
                {MONTHS.map((label, monthIndex) => {
                    const key = `${viewYear}-${String(monthIndex + 1).padStart(2, "0")}`;
                    const selected = Boolean(startKey && key >= startKey && key <= endKey);
                    const edge = key === startKey || key === endKey;
                    return (
                        <button
                            key={label}
                            type="button"
                            className={cn(
                                "h-9 rounded-md text-sm hover:bg-accent",
                                selected && "bg-secondary",
                                edge && "bg-primary text-primary-foreground hover:bg-primary",
                            )}
                            onClick={() => selectMonth(monthIndex)}
                        >
                            {label}
                        </button>
                    );
                })}
            </div>
            <p className="text-xs text-muted-foreground">Click a start month, then an end month.</p>
        </div>
    );
}

function YearCalendar({
    value,
    onChange,
    onComplete,
}: {
    value: DateKeyRange | null;
    onChange: (range: DateKeyRange) => void;
    onComplete?: () => void;
}) {
    const selectedYear = Number((value?.start ?? `${new Date().getFullYear()}-01-01`).slice(0, 4));
    const [startYear, setStartYear] = useState(Math.floor(selectedYear / 12) * 12);
    const [anchor, setAnchor] = useState<string | null>(null);
    const years = Array.from({ length: 12 }, (_, index) => startYear + index);
    const jumpYears = useMemo(() => yearOptions(selectedYear), [selectedYear]);
    const startKey = value ? dateKeyToPeriodKey(value.start, "year") : "";
    const endKey = value ? dateKeyToPeriodKey(value.end, "year") : "";

    function selectYear(year: number) {
        const key = toDateKey(year, 0, 1);
        if (!anchor) {
            setAnchor(key);
            onChange(rangeFromKeys(key, key, "year"));
            return;
        }
        onChange(rangeFromKeys(anchor, key, "year"));
        setAnchor(null);
        onComplete?.();
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-1">
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => setStartYear((year) => year - 12)} aria-label="Previous years">
                    <ChevronLeft />
                </Button>
                <select
                    aria-label="Year"
                    className={cn(navSelectClassName, "flex-1")}
                    value={years.includes(selectedYear) ? selectedYear : years[0]}
                    onChange={(event) => {
                        const year = Number(event.target.value);
                        setStartYear(Math.floor(year / 12) * 12);
                    }}
                >
                    {jumpYears.map((year) => (
                        <option key={year} value={year}>{year}</option>
                    ))}
                </select>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => setStartYear((year) => year + 12)} aria-label="Next years">
                    <ChevronRight />
                </Button>
            </div>
            <div className="grid grid-cols-3 gap-1">
                {years.map((year) => {
                    const key = String(year);
                    const selected = Boolean(startKey && key >= startKey && key <= endKey);
                    const edge = key === startKey || key === endKey;
                    return (
                        <button
                            key={year}
                            type="button"
                            className={cn(
                                "h-9 rounded-md text-sm hover:bg-accent",
                                selected && "bg-secondary",
                                edge && "bg-primary text-primary-foreground hover:bg-primary",
                            )}
                            onClick={() => selectYear(year)}
                        >
                            {year}
                        </button>
                    );
                })}
            </div>
            <p className="text-xs text-muted-foreground">Click a start year, then an end year.</p>
        </div>
    );
}
