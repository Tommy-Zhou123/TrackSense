import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Header } from './Home';
import { api } from '../lib/api';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useAppFeedback } from '@/components/AppFeedback';
import {
    ArrowDown,
    ArrowDownAZ,
    ArrowDown01,
    ArrowUp,
    ArrowUpAZ,
    ArrowUp01,
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    ChevronsLeft,
    ChevronsRight,
    Search,
    X,
    CircleHelp,
    ThumbsDown,
    Loader2,
} from 'lucide-react';
import FileUpload from '@/components/kokonutui/file-upload';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip } from 'radix-ui';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    applyColumnMapping,
    assignColumnField,
    inspectCsv,
    mappingError,
    parseAmount,
    parseDate,
    reuseExistingCategory,
} from '@/utils/csvImport';
import {
    fillUncategorizedByExactVendor,
    fillUncategorizedByFingerprint,
    normalizeVendor,
    predictCategory,
    suggestDraftCategories,
    vendorFingerprint,
    type VendorRule,
} from '@/utils/categoryPredict';
import type {
    ColumnField,
    ColumnMapping,
    CsvInspection,
    ImportSource,
    ImportStep,
    ParsedExpense,
    StatementParseResponse,
} from '@/types/csvImport';
import {
    COLUMN_FIELDS,
    CSV_PAGE_SIZE,
    IMPORT_CATEGORY_PAGE_SIZE,
    NEW_CATEGORY_OPTION,
    UNMAPPED,
} from '@/constants/csvImport';
import { PeriodRangePicker } from '@/components/PeriodRangePicker';
import {
    expenseInKeyRange,
    type DateKeyRange,
    type PeriodGrain,
} from '@/utils/categoryMonth';
import { useProfile } from '@/components/ProfileProvider';
import type { ProfileMember } from '@/types/profile';
import {
    SPLIT_VALUE,
    attributionLabel,
    isSplitAssignment,
    personLabel,
} from '@/utils/expenseAttribution';

interface Expense {
    _id: string,
    date: Date,
    account: string,
    vendor: string,
    category: string,
    amount: number,
    notes: string,
    assignedMemberId: string | null,
}

type ExpensePart = "none" | "date" | "account" | "vendor" | "amount" | "category" | "notes" | "person";



const formatDate = (date: Date) => {
    if (!date || Number.isNaN(date.getTime())) return "";
    return date.toISOString().split('T')[0];
};

function getGroupKey(expense: Expense, mode: ExpensePart): string {
    switch (mode) {
        case "date":
            return formatDate(expense.date);
        case "amount":
            return expense.amount.toString();
        case "account":
            return expense.account || "";
        case "vendor":
            return expense.vendor || "";
        case "category":
            return expense.category || "";
        case "person":
            return expense.assignedMemberId && !isSplitAssignment(expense.assignedMemberId)
                ? expense.assignedMemberId
                : "split";
        case "notes":
            return expense.notes || "";
        default:
            return "";
    }
}

function sortExpenseList(list: Expense[], sortByProp: ExpensePart, sort: "down" | "up" = "down"): Expense[] {
    const updated = [...list];
    const direction = sort === "down" ? 1 : -1;
    if (sortByProp === "date") {
        updated.sort((a, b) => direction * (a.date.getTime() - b.date.getTime()));
    } else if (sortByProp === "amount") {
        updated.sort((a, b) => direction * (a.amount - b.amount));
    } else if (sortByProp !== "none") {
        updated.sort((a, b) => direction * getGroupKey(a, sortByProp).localeCompare(getGroupKey(b, sortByProp)));
    }
    return updated;
}

function groupExpenses(list: Expense[], mode: ExpensePart): { key: string; items: Expense[] }[] {
    const groups = new Map<string, Expense[]>();
    for (const expense of list) {
        const key = getGroupKey(expense, mode);
        const items = groups.get(key);
        if (items) {
            items.push(expense);
        } else {
            groups.set(key, [expense]);
        }
    }
    return Array.from(groups, ([key, items]) => ({ key, items }));
}

function expensePayload(expense: Expense) {
    return {
        _id: expense._id,
        date: formatDate(expense.date),
        account: expense.account,
        vendor: expense.vendor,
        amount: Number(expense.amount),
        category: expense.category,
        notes: expense.notes || "",
        assignedMemberId: isSplitAssignment(expense.assignedMemberId) ? null : expense.assignedMemberId,
    };
}

function expenseChanged(next: Expense, prev?: Expense) {
    if (!prev) return true;
    const a = expensePayload(next);
    const b = expensePayload(prev);
    return a.date !== b.date
        || a.account !== b.account
        || a.vendor !== b.vendor
        || a.amount !== b.amount
        || a.category !== b.category
        || a.notes !== b.notes
        || a.assignedMemberId !== b.assignedMemberId;
}

function buildExpandedMap(list: Expense[], mode: ExpensePart, open: boolean): Map<string, boolean> {
    const next = new Map<string, boolean>();
    for (const expense of list) {
        next.set(getGroupKey(expense, mode), open);
    }
    return next;
}

function matchesSearch(
    expense: Expense,
    filterBy: string,
    searchTerm: string,
    personName?: (expense: Expense) => string,
): boolean {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    if (filterBy === "date") return formatDate(expense.date).toLowerCase().includes(term);
    if (filterBy === "account") return (expense.account || "").toLowerCase().includes(term);
    if (filterBy === "vendor") return (expense.vendor || "").toLowerCase().includes(term);
    if (filterBy === "category") return (expense.category || "").toLowerCase().includes(term);
    if (filterBy === "person") return (personName?.(expense) || "split").toLowerCase().includes(term);
    if (filterBy === "amount") return expense.amount.toString().includes(searchTerm);
    if (filterBy === "notes") return (expense.notes || "").toLowerCase().includes(term);
    return true;
}

function filteredExpenseList(
    all: Expense[],
    dateRange: DateKeyRange | null,
    filterBy: string,
    searchTerm: string,
    grouping: ExpensePart,
    personName?: (expense: Expense) => string,
): Expense[] {
    let list = dateRange
        ? all.filter((expense) => expenseInKeyRange(expense.date, dateRange))
        : all;
    if (searchTerm) {
        list = list.filter((expense) => matchesSearch(expense, filterBy, searchTerm, personName));
    }
    if (grouping !== "none") {
        list = sortExpenseList(list, grouping, "down");
    }
    return list;
}


const Expenses = () => {
    let accCounter = 1;
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [expensesCopy, setExpensesCopy] = useState<Expense[]>([]);
    const [expensesLoading, setExpensesLoading] = useState(true);
    const [vendorRules, setVendorRules] = useState<VendorRule[]>([]);
    const [editableExpenses, setEditableExpenses] = useState<Expense[]>([]);
    const [checkedExps, setCheckedExps] = useState<string[]>([]);

    const [accSelect, setAccSelect] = useState('');
    const [newAccount, setNewAccount] = useState('');

    const [catSelect, setCatSelect] = useState('');
    const [newCategory, setNewCategory] = useState('');
    const [categoryLocked, setCategoryLocked] = useState(false);
    const [categoryHint, setCategoryHint] = useState('');

    const [showForm, setShowForm] = useState(false);
    const [formError, setFormError] = useState('');
    const [showCat, setShowCat] = useState(false);
    const [showAcc, setShowAcc] = useState(false);

    const [editMode, setEditMode] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [editAddingCategoryId, setEditAddingCategoryId] = useState<string | null>(null);
    const [editNewCategoryName, setEditNewCategoryName] = useState('');
    const [editPendingCategories, setEditPendingCategories] = useState<string[]>([]);

    const [date, setDate] = useState<Date>(new Date());
    const [account, setAccount] = useState('');
    const [vendor, setVendor] = useState('');
    const [amount, setAmount] = useState(0);
    const [category, setCategory] = useState('');
    const [notes, setNotes] = useState('');

    const [currentPage, setCurrentPage] = useState(1);
    const [perPage] = useState(50);

    const [sortDate, setSortDate] = useState<'down' | 'up'>('down');
    const [sortAccount, setSortAccount] = useState<'down' | 'up'>('down');
    const [sortVendor, setSortVendor] = useState<'down' | 'up'>('down');
    const [sortAmount, setSortAmount] = useState<'down' | 'up'>('down');
    const [sortCategory, setSortCategory] = useState<'down' | 'up'>('down');
    const [sortNotes, setSortNotes] = useState<'down' | 'up'>('down');

    const [groupMode, setGroupMode] = useState<ExpensePart>("none");
    const [searchBySelect, setSearchBySelect] = useState<string>('category');
    const [searchByQuery, setSearchByQuery] = useState<string>('');
    const [dateRange, setDateRange] = useState<DateKeyRange | null>(null);
    const [dateGrain, setDateGrain] = useState<PeriodGrain>("day");
    const [filteredTotal, setFilteredTotal] = useState(0);

    const [expanded, setExpanded] = useState<Map<string, boolean>>(new Map());

    const [showImport, setShowImport] = useState(false);
    const [importStep, setImportStep] = useState<ImportStep>("map");
    const [importSource, setImportSource] = useState<ImportSource>("csv");
    const [csvPreview, setCsvPreview] = useState<CsvInspection | null>(null);
    const [columnMapping, setColumnMapping] = useState<ColumnMapping | null>(null);
    const [importAccount, setImportAccount] = useState('');
    const [importDrafts, setImportDrafts] = useState<ParsedExpense[]>([]);
    const [importSelected, setImportSelected] = useState<boolean[]>([]);
    const [importCategories, setImportCategories] = useState<string[]>([]);
    const [importPendingCategories, setImportPendingCategories] = useState<string[]>([]);
    const [importSuggested, setImportSuggested] = useState<boolean[]>([]);
    const [importCorrectingIndex, setImportCorrectingIndex] = useState<number | null>(null);
    const [importPage, setImportPage] = useState(1);
    const [addingCategoryIndex, setAddingCategoryIndex] = useState<number | null>(null);
    const [newImportCategory, setNewImportCategory] = useState('');
    const [importing, setImporting] = useState(false);
    const [importParsing, setImportParsing] = useState(false);
    const [importError, setImportError] = useState('');
    const [importWarnings, setImportWarnings] = useState<string[]>([]);
    const [importHasAccount, setImportHasAccount] = useState(true);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const csvResult = useMemo(() => {
        if (!csvPreview || !columnMapping) return null;
        return applyColumnMapping(csvPreview, columnMapping);
    }, [csvPreview, columnMapping]);
    const csvMappingError = columnMapping ? mappingError(columnMapping) : '';

    const navigate = useNavigate();
    const { reportError, showSuccess, confirm } = useAppFeedback();
    const { canWrite, activeProfileId, activeProfile } = useProfile();
    const [people, setPeople] = useState<ProfileMember[]>([]);
    const [assignedMemberId, setAssignedMemberId] = useState<string>(SPLIT_VALUE);

    const pendingVendorCorrection = useRef(false);
    const peopleForAssign = useMemo(
        () => people.filter((member) => member.status === "active"),
        [people],
    );
    const personName = (expense: Expense) =>
        attributionLabel(expense.assignedMemberId, people, activeProfile?.memberId);
    const existingCategories = useMemo(
        () => uniqueCategoryNames(expensesCopy.map((expense) => expense.category)),
        [expensesCopy],
    );
    const selectClassName = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

    function resetEditCategoryAdd() {
        setEditAddingCategoryId(null);
        setEditNewCategoryName('');
        setEditPendingCategories([]);
    }

    function suggestCategoryFromVendor(vendorValue: string) {
        if (categoryLocked || showCat) return;
        const prediction = predictCategory(vendorValue, expensesCopy, vendorRules);
        if (prediction) {
            setCategory(prediction.category);
            setCatSelect(prediction.category);
            setCategoryHint(prediction.fingerprint);
        } else {
            setCategory('');
            setCatSelect('');
            setCategoryHint('');
        }
    }

    function loadVendorRules() {
        api.get("/api/vendor-rules")
            .then((response) => {
                setVendorRules(response.data.rules || []);
            })
            .catch((err) => {
                if (err?.response?.status !== 401) {
                    setVendorRules([]);
                }
            });
    }

    function upsertVendorRule(vendorValue: string, nextCategory: string) {
        const matchKey = normalizeVendor(vendorValue);
        const categoryName = nextCategory.trim();
        if (!matchKey || !categoryName) return;
        api.put("/api/vendor-rules", {
            matchType: "exact",
            matchKey,
            category: categoryName,
        })
            .then((response) => {
                const saved: VendorRule = response.data;
                setVendorRules((current) => [
                    saved,
                    ...current.filter((rule) =>
                        !(rule.matchType === saved.matchType && rule.matchKey === saved.matchKey)
                    ),
                ]);
            })
            .catch((err) => {
                reportError(err);
            });
    }

    const handleClose = () => {
        setShowForm(false);
        setFormError('');
    };
    const handleShow = () => {
        setCategoryLocked(Boolean(category));
        setFormError('');
        setShowForm(true);
    };

    useEffect(() => {
        if (!activeProfileId) return;
        setEditMode(false);
        setEditId(null);
        resetEditCategoryAdd();
        getExpenses();
        loadVendorRules();
        api.get(`/api/profiles/${activeProfileId}/members`)
            .then((response) => {
                setPeople(response.data.members || []);
            })
            .catch(() => setPeople([]));
        // Reload when the active profile changes; fetch helpers close over latest state.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeProfileId]);

    function clearFormValues() {
        setDate(new Date());
        setAccount('');
        setVendor('');
        setAmount(0);
        setCategory('');
        setNotes('');
        setNewAccount('');
        setNewCategory('');
        setAccSelect('');
        setCatSelect('');
        setShowCat(false);
        setCategoryLocked(false);
        setCategoryHint('');
        setAssignedMemberId(SPLIT_VALUE);
        pendingVendorCorrection.current = false;
    }

    function showExpenses(
        all: Expense[] = expensesCopy,
        overrides: {
            range?: DateKeyRange | null;
            query?: string;
            filterBy?: string;
            grouping?: ExpensePart;
            page?: number;
        } = {},
    ) {
        const range = overrides.range ?? dateRange;
        const query = overrides.query ?? searchByQuery;
        const filterBy = overrides.filterBy ?? searchBySelect;
        const grouping = overrides.grouping ?? groupMode;
        const page = overrides.page ?? currentPage;
        const list = filteredExpenseList(all, range, filterBy, query, grouping, personName);
        setFilteredTotal(list.length);

        if (grouping !== "none") {
            setExpanded(buildExpandedMap(list, grouping, true));
            setExpenses(list);
            if (editMode) setEditableExpenses(list);
            return;
        }

        if (query) {
            setExpenses(list);
            return;
        }

        const totalPages = Math.max(1, Math.ceil(list.length / perPage) || 1);
        const safePage = Math.min(Math.max(1, page), totalPages);
        if (safePage !== currentPage && overrides.page == null) {
            setCurrentPage(safePage);
        }
        setExpenses(list.slice((safePage - 1) * perPage, safePage * perPage));
    }

    function handleDateRangeChange(value: DateKeyRange | null) {
        setDateRange(value);
        setCurrentPage(1);
        showExpenses(expensesCopy, { range: value, page: 1 });
    }

    function handleDateGrainChange(grain: PeriodGrain) {
        setDateGrain(grain);
    }

    function getExpenses(sort: boolean = true, page: number = -1) {
        setExpensesLoading(true);
        api.get(`/api/expenses`)
            .then((response) => {
                const expensesWithDates = response.data.expenses.map((expense: any) => ({
                    ...expense,
                    date: new Date(expense.date),
                    assignedMemberId: expense.assignedMemberId ?? null,
                }));
                if (sort) expensesWithDates.sort(function (a: Expense, b: Expense) { return b.date.getTime() - a.date.getTime() });
                const nextPage = page === -1 ? currentPage : page;
                setExpensesCopy(expensesWithDates);
                showExpenses(expensesWithDates, { page: nextPage });
            })
            .catch((err) => {
                setExpenses([]);
                setExpensesCopy([]);
                setFilteredTotal(0);
                if (err?.response?.data?.message === "Not Logged In" || err?.response?.status === 401) {
                    navigate("/login");
                } else {
                    reportError(err);
                }
            })
            .finally(() => setExpensesLoading(false));
    }

    function AddExpense(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        const categoryName = (showCat ? newCategory : category).trim();
        if (date != null && account != null && vendor != null && amount != null && categoryName) {
            const data = {
                date, account, vendor, amount, category: categoryName, notes,
                assignedMemberId: assignedMemberId === SPLIT_VALUE ? null : assignedMemberId,
            }
            api.post(`/api/expenses/add`, data)
                .then((res) => {
                    if (pendingVendorCorrection.current) {
                        upsertVendorRule(vendor, categoryName);
                    }
                    const created = {
                        _id: res.data._id,
                        ...data,
                        assignedMemberId: res.data.assignedMemberId ?? data.assignedMemberId,
                    };
                    const updatedExpensesCopy: Expense[] = [...expensesCopy, created];
                    setExpensesCopy(updatedExpensesCopy);
                    showExpenses(updatedExpensesCopy);
                    handleClose()
                    setShowAcc(false);
                    clearFormValues()
                })
                .catch((err) => {
                    reportError(err);
                })
        } else {
            setFormError("Please fill out all required fields.");
        }
    }

    async function EditExpenses() {
        const originals = new Map(expensesCopy.map((item) => [item._id, item]));
        const rows = editId
            ? editableExpenses.filter((item) => item._id === editId)
            : editableExpenses;
        const changed = rows.filter((item) => expenseChanged(item, originals.get(item._id)));
        if (changed.length === 0) {
            setEditMode(false);
            setEditId(null);
            resetEditCategoryAdd();
            return;
        }
        const payloads = changed.map(expensePayload);
        if (payloads.some((item) => !item.date || item.amount == null || !item.vendor || !item.account || !item.category)) {
            reportError();
            return;
        }
        try {
            await api.put("/api/expenses/batch", { expenses: payloads });
            const byId = new Map(changed.map((item) => [
                item._id,
                { ...item, assignedMemberId: isSplitAssignment(item.assignedMemberId) ? null : item.assignedMemberId },
            ]));
            setExpenses((current) => current.map((item) => byId.get(item._id) || item));
            setExpensesCopy((current) => current.map((item) => byId.get(item._id) || item));
            setEditMode(false);
            setEditId(null);
            resetEditCategoryAdd();
            showSuccess(changed.length === 1 ? "Expense saved." : "Expenses saved.");
        } catch (err) {
            reportError(err);
        }
    }

    function closeImport() {
        setShowImport(false);
        resetImportFile();
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }

    function resetImportFile() {
        setImportStep("map");
        setImportSource("csv");
        setCsvPreview(null);
        setColumnMapping(null);
        setImportDrafts([]);
        setImportSelected([]);
        setImportSuggested([]);
        setImportCorrectingIndex(null);
        setImportCategories([]);
        setImportPendingCategories([]);
        setImportPage(1);
        setAddingCategoryIndex(null);
        setNewImportCategory('');
        setImportError('');
        setImportWarnings([]);
        setImportHasAccount(true);
        setImportParsing(false);
    }

    function isPdfFile(file: File) {
        return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    }

    function loadCsvText(text: string) {
        const inspection = inspectCsv(text);
        const accounts = [...new Set(expensesCopy.map((expense) => expense.account).filter(Boolean))];
        setImportSource("csv");
        setCsvPreview(inspection);
        setColumnMapping(inspection.suggestedMapping);
        setImportAccount(accounts[0] || '');
        setImportStep("map");
        setImportDrafts([]);
        setImportSelected([]);
        setImportSuggested([]);
        setImportPage(1);
        setAddingCategoryIndex(null);
        setNewImportCategory('');
        setImportError('');
        setImportWarnings([]);
        setImportHasAccount(true);
    }

    function loadPdfResult(data: StatementParseResponse) {
        const drafts = (data.expenses || []).map((row) => ({
            date: parseDate(String(row.date)) || new Date(`${String(row.date).slice(0, 10)}T00:00:00.000Z`),
            account: (row.account || "").trim(),
            vendor: (row.vendor || "").trim(),
            amount: Number(row.amount),
            category: (row.category || "").trim(),
            notes: (row.notes || "").trim(),
        })).filter((expense) => expense.vendor && Number.isFinite(expense.amount) && !Number.isNaN(expense.date.getTime()));

        if (drafts.length === 0) {
            throw new Error("No valid transactions were found in this statement.");
        }

        const accounts = [...new Set(expensesCopy.map((expense) => expense.account).filter(Boolean))];
        setImportSource("pdf");
        setCsvPreview(null);
        setColumnMapping(null);
        setImportDrafts(drafts);
        setImportSelected(drafts.map(() => true));
        setImportAccount(accounts[0] || "");
        setImportWarnings(data.warnings || []);
        setImportHasAccount(Boolean(data.hasAccount));
        setImportPage(1);
        setAddingCategoryIndex(null);
        setNewImportCategory("");
        setImportError("");
        setImportStep("preview");
    }

    async function parsePdfStatement(file: File) {
        setImportParsing(true);
        setImportError("");
        setImportWarnings([]);
        setImportSource("pdf");
        const form = new FormData();
        form.append("file", file);
        try {
            const res = await api.post("/api/expenses/parse-statement", form, { timeout: 120000 });
            loadPdfResult(res.data);
        } catch (err) {
            reportError(err);
            setImportError("");
            setImportStep("map");
            setImportDrafts([]);
            setImportSuggested([]);
            setImportCorrectingIndex(null);
        } finally {
            setImportParsing(false);
        }
    }

    function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        const name = file.name.toLowerCase();
        if (isPdfFile(file)) {
            setShowImport(true);
            void parsePdfStatement(file);
            return;
        }
        if (!name.endsWith(".csv")) {
            setShowImport(true);
            setImportError("Please choose a .csv or .pdf file.");
            e.target.value = "";
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            try {
                loadCsvText(String(reader.result || ""));
                setShowImport(true);
            } catch (err) {
                reportError(err);
                if (fileInputRef.current) fileInputRef.current.value = "";
            }
        };
        reader.onerror = () => {
            reportError(new Error("Could not read that CSV file."));
            if (fileInputRef.current) fileInputRef.current.value = "";
        };
        reader.readAsText(file);
    }

    function continueToCategories() {
        if (importSource === "pdf") {
            continueFromPreview();
            return;
        }
        if (!csvResult) return;
        if (csvMappingError) {
            setImportError(csvMappingError);
            return;
        }
        if (csvResult.expenses.length === 0) {
            setImportError("No valid expenses to import with the current column mapping.");
            return;
        }
        if (!csvResult.hasAccount && !importAccount.trim()) {
            setImportError("Please enter an account name for these transactions.");
            return;
        }

        const existingCategories = expensesCopy.map((expense) => expense.category).filter(Boolean);
        const drafts = csvResult.expenses.map((expense) => ({
            ...expense,
            account: expense.account || importAccount.trim(),
            category: reuseExistingCategory(expense.category, existingCategories) || "Uncategorized",
        })).filter((expense) => expense.account);

        openCategoryStep(drafts);
    }

    function continueFromPreview() {
        if (importDrafts.length === 0) {
            setImportError("No valid expenses to import.");
            return;
        }
        if (importSelected.every((value) => !value)) {
            setImportError("Select at least one transaction to import.");
            return;
        }
        if (!importHasAccount && !importAccount.trim() && importDrafts.some((expense) => !expense.account.trim())) {
            setImportError("Please enter an account name for these transactions.");
            return;
        }

        const drafts = importDrafts.map((expense) => ({
            ...expense,
            account: expense.account.trim() || importAccount.trim(),
            category: expense.category.trim() || "Uncategorized",
        })).filter((expense) => expense.account);

        if (drafts.length === 0) {
            setImportError("No valid expenses to import.");
            return;
        }

        openCategoryStep(drafts);
    }

    function openCategoryStep(drafts: ParsedExpense[]) {
        if (drafts.length === 0) {
            setImportError("No valid expenses to import.");
            return;
        }

        const existingCategories = expensesCopy.map((expense) => expense.category).filter(Boolean);
        const aligned = drafts.map((expense) => ({
            ...expense,
            category: reuseExistingCategory(expense.category, existingCategories) || "Uncategorized",
        }));
        const { drafts: predicted, suggested } = suggestDraftCategories(aligned, expensesCopy, vendorRules);
        const fromFile = predicted.map((expense) => expense.category).filter(Boolean);
        const fromExisting = existingCategories;
        const saved = uniqueCategoryNames(["Uncategorized", ...fromExisting])
            .sort((a, b) => a.localeCompare(b));
        const pending = uniqueCategoryNames(fromFile).filter((name) =>
            !saved.some((item) => item.toLowerCase() === name.toLowerCase())
        );

        setImportDrafts(predicted);
        setImportSuggested(suggested);
        setImportCorrectingIndex(null);
        setImportSelected((current) => current.length === predicted.length ? current : predicted.map(() => true));
        setImportCategories(saved);
        setImportPendingCategories(pending);
        setImportPage(1);
        setAddingCategoryIndex(null);
        setNewImportCategory("");
        setImportError("");
        setImportStep("categories");
    }

    function setDraftCategory(index: number, category: string, fromCorrection = false) {
        const vendorValue = importDrafts[index]?.vendor || "";
        if (fromCorrection) {
            upsertVendorRule(vendorValue, category);
        }
        setImportDrafts((current) => {
            const updated = current.map((expense, i) => (
                i === index ? { ...expense, category } : expense
            ));
            const filledResult = fromCorrection
                ? fillUncategorizedByExactVendor(updated, updated[index].vendor, category)
                : fillUncategorizedByFingerprint(
                    updated,
                    vendorFingerprint(updated[index].vendor),
                    category,
                );
            const { drafts, filled } = filledResult;
            setImportSuggested((currentSuggested) => {
                const next = currentSuggested.length === drafts.length
                    ? [...currentSuggested]
                    : drafts.map(() => false);
                next[index] = false;
                filled.forEach((wasFilled, i) => {
                    if (wasFilled) next[i] = fromCorrection ? false : true;
                });
                return next;
            });
            return drafts;
        });
        if (fromCorrection) setImportCorrectingIndex(null);
    }

    function confirmNewImportCategory(index: number) {
        const name = reuseExistingCategory(newImportCategory, [...importCategories, ...importPendingCategories]);
        if (!name) return;
        const alreadySaved = importCategories.some((item) => item.toLowerCase() === name.toLowerCase());
        if (!alreadySaved) {
            setImportPendingCategories((current) => (
                current.some((item) => item.toLowerCase() === name.toLowerCase())
                    ? current
                    : [...current, name]
            ));
        }
        setDraftCategory(index, alreadySaved
            ? importCategories.find((item) => item.toLowerCase() === name.toLowerCase()) || name
            : name, importCorrectingIndex === index);
        setAddingCategoryIndex(null);
        setNewImportCategory('');
    }

    function toggleImportSelected(index: number, checked: boolean) {
        setImportSelected((current) => current.map((value, i) => i === index ? checked : value));
    }

    function toggleImportSelectedAll(checked: boolean) {
        setImportSelected((current) => current.map(() => checked));
    }

    function negateAmountColumn() {
        if (!csvPreview || !columnMapping) return;
        const amountIdx = columnMapping.amount !== UNMAPPED
            ? columnMapping.amount
            : columnMapping.debit !== UNMAPPED
                ? columnMapping.debit
                : UNMAPPED;
        if (amountIdx === UNMAPPED) {
            setImportError('Map an Amount column first.');
            return;
        }

        setCsvPreview({
            ...csvPreview,
            rows: csvPreview.rows.map((row) => {
                const next = [...row];
                const parsed = parseAmount(next[amountIdx] || "");
                if (parsed == null) return row;
                const negated = parsed * -1;
                next[amountIdx] = Number.isInteger(negated) ? String(negated) : String(Number(negated.toFixed(4)));
                return next;
            }),
        });
        setImportError('');
    }

    function ImportExpenses() {
        const selectedDrafts = importDrafts.filter((_, index) => importSelected[index]);
        if (selectedDrafts.length === 0) {
            setImportError('Select at least one transaction to import.');
            return;
        }
        if (selectedDrafts.some((expense) => !expense.category.trim())) {
            setImportError('Please choose a category for every selected transaction.');
            return;
        }

        const expensesToImport = selectedDrafts.map((expense) => ({
            date: expense.date,
            account: expense.account,
            vendor: expense.vendor,
            amount: expense.amount,
            category: expense.category.trim(),
            notes: expense.notes,
        }));

        if (expensesToImport.length === 0) {
            setImportError('No valid expenses to import.');
            return;
        }

        setImporting(true);
        setImportError('');
        api.post(`/api/expenses/import`, { expenses: expensesToImport })
            .then((res) => {
                closeImport();
                getExpenses();
                showSuccess(`Imported ${res.data.count} expense${res.data.count === 1 ? '' : 's'}.`);
            })
            .catch((err) => {
                reportError(err);
                setImporting(false);
            });
    }

    async function DeleteExpenses() {
        if (checkedExps.length === 0) return;
        const ok = await confirm({
            title: checkedExps.length === 1 ? "Delete this expense?" : `Delete ${checkedExps.length} expenses?`,
            description: "This cannot be undone.",
            confirmLabel: "Delete",
            destructive: true,
        });
        if (!ok) return;
        checkedExps.forEach(expense => {
            api.delete(`/api/expenses/${expense}`)
                .then((res) => {
                    const updatedExpensesCopy: Expense[] = expensesCopy.filter((exp: Expense) => exp._id != res.data._id);
                    setExpensesCopy(updatedExpensesCopy);
                    showExpenses(updatedExpensesCopy);
                })
                .catch((err) => {
                    reportError(err);
                })
        });
    }

    function handleAccount(e: React.ChangeEvent<HTMLSelectElement>) {
        // Check if last option is selected, need to create new account
        if (e.target.selectedIndex == e.target.childElementCount - 1) {
            setShowAcc(true)
            setAccount(newAccount) // set account in case textbox already has a value, new account has most updated value
        } else {
            setShowAcc(false)
            const selectedOption = e.target.children.item(e.target.selectedIndex);
            if (e.target.value != "" && e.target.value != "-1" && selectedOption != null) { //if not a new account and not first option
                setAccount(selectedOption.innerHTML)
            }
        }
        setAccSelect(e.target.value);
    }

    function handleCategory(e: React.ChangeEvent<HTMLSelectElement>) {
        const correcting = pendingVendorCorrection.current;
        if (e.target.value === NEW_CATEGORY_OPTION) {
            setCategoryLocked(true);
            if (correcting) pendingVendorCorrection.current = true;
            startNewCategory();
            return;
        }
        setCategoryLocked(true);
        setCategoryHint('');
        pendingVendorCorrection.current = false;
        const nextCategory = e.target.value;
        setCatSelect(nextCategory);
        setCategory(nextCategory);
        if (correcting && nextCategory && nextCategory !== category) {
            upsertVendorRule(vendor, nextCategory);
        }
    }

    function startNewCategory() {
        setShowCat(true);
        setCategoryLocked(true);
        setNewCategory('');
    }

    function confirmNewCategory() {
        const name = reuseExistingCategory(newCategory, existingCategories);
        if (!name) return;
        setCategory(name);
        setCatSelect(name);
        setShowCat(false);
        setNewCategory('');
        setCategoryHint('');
    }

    function cancelNewCategory() {
        setShowCat(false);
        setNewCategory('');
    }

    function handleCheck(id: string, checked: boolean) {
        if (checked) {
            setCheckedExps([...checkedExps, id])
        } else {
            setCheckedExps(checkedExps.filter((ID) => ID != id))
        }
    }

    function handleCheckAll(checked: boolean) {
        if (checked) {
            setCheckedExps(expenses.map((expense) => expense._id.toString()))
        } else {
            setCheckedExps([])
        }
    }

    function handleCheckGroup(ids: string[], checked: boolean) {
        if (checked) {
            setCheckedExps((current) => {
                const next = new Set(current);
                for (const id of ids) next.add(id);
                return Array.from(next);
            });
            return;
        }
        const remove = new Set(ids);
        setCheckedExps((current) => current.filter((id) => !remove.has(id)));
    }

    function handleDbClickEdit(id: string) {
        setEditableExpenses(expenses);
        setEditId(id);
        resetEditCategoryAdd();
    }

    function confirmNewEditCategory(expense: Expense) {
        const name = reuseExistingCategory(editNewCategoryName, [...existingCategories, ...editPendingCategories]);
        if (!name) return;
        const alreadySaved = existingCategories.some((item) => item.toLowerCase() === name.toLowerCase());
        if (!alreadySaved) {
            setEditPendingCategories((current) => (
                current.some((item) => item.toLowerCase() === name.toLowerCase())
                    ? current
                    : [...current, name]
            ));
        }
        editCategory(expense, alreadySaved
            ? existingCategories.find((item) => item.toLowerCase() === name.toLowerCase()) || name
            : name);
        setEditAddingCategoryId(null);
        setEditNewCategoryName('');
    }

    function editDate(expense: Expense, d: string) {
        let day: Date = new Date(d);
        let updatedExpenses: Expense[] =
            editableExpenses.map((exp) => {
                if (exp._id === expense._id) {
                    return { ...exp, date: day };
                }
                return exp;
            });
        setEditableExpenses(updatedExpenses);
    }

    function editAccount(expense: Expense, a: string) {
        let updatedExpenses: Expense[] =
            editableExpenses.map((exp) => {
                if (exp._id === expense._id) {
                    return { ...exp, account: a };
                }
                return exp;
            });
        setEditableExpenses(updatedExpenses);
    }

    function editVendor(expense: Expense, v: string) {
        let updatedExpenses: Expense[] =
            editableExpenses.map((exp) => {
                if (exp._id === expense._id) {
                    return { ...exp, vendor: v };
                }
                return exp;
            });
        setEditableExpenses(updatedExpenses);
    }

    function editAmount(expense: Expense, a: number) {
        let updatedExpenses: Expense[] =
            editableExpenses.map((exp) => {
                if (exp._id === expense._id) {
                    return { ...exp, amount: a };
                }
                return exp;
            });
        setEditableExpenses(updatedExpenses);
    }

    function editCategory(expense: Expense, c: string) {
        let updatedExpenses: Expense[] =
            editableExpenses.map((exp) => {
                if (exp._id === expense._id) {
                    return { ...exp, category: c };
                }
                return exp;
            });
        setEditableExpenses(updatedExpenses);
    }

    function editNotes(expense: Expense, n: string) {
        let updatedExpenses: Expense[] =
            editableExpenses.map((exp) => {
                if (exp._id === expense._id) {
                    return { ...exp, notes: n };
                }
                return exp;
            });
        setEditableExpenses(updatedExpenses);
    }

    function editAssigned(expense: Expense, memberId: string | null) {
        const updatedExpenses: Expense[] =
            editableExpenses.map((exp) => {
                if (exp._id === expense._id) {
                    return { ...exp, assignedMemberId: memberId };
                }
                return exp;
            });
        setEditableExpenses(updatedExpenses);
    }

    function sortBy(sortByProp: ExpensePart, sort: "down" | "up" = "down") {
        const updatedExpenses = sortExpenseList(expenses, sortByProp, sort);
        setExpenses(updatedExpenses);
        if (editMode) {
            setEditableExpenses(sortExpenseList(editableExpenses, sortByProp, sort));
        }
    }

    function handleGroupBy(mode: ExpensePart) {
        setGroupMode(mode);
        if (mode === "none") {
            setExpanded(new Map());
        }
        showExpenses(expensesCopy, { grouping: mode, page: currentPage });
    }

    function toggleGroup(key: string) {
        const next = new Map(expanded);
        const isOpen = expanded.get(key) !== false;
        next.set(key, !isOpen);
        setExpanded(next);
    }

    function setAllExpanded(open: boolean) {
        const list = editMode ? editableExpenses : expenses;
        setExpanded(buildExpandedMap(list, groupMode, open));
    }

    function filterBySearch(filterBy: string, searchTerm: string, grouping: ExpensePart = groupMode) {
        showExpenses(expensesCopy, { filterBy, query: searchTerm, grouping });
    }

    function renderExpenseRow(expense: Expense, bg: boolean) {
        if (editMode) {
            return (
                <ExpenseEditableRow
                    key={`editable-${expense._id}`}
                    expense={expense}
                    checkedExps={checkedExps}
                    handleCheck={handleCheck}
                    bg={bg}
                    editDate={editDate}
                    editAccount={editAccount}
                    editVendor={editVendor}
                    editAmount={editAmount}
                    editCategory={editCategory}
                    editNotes={editNotes}
                    editAssigned={editAssigned}
                    people={peopleForAssign}
                    selfMemberId={activeProfile?.memberId}
                    categories={existingCategories}
                    pendingCategories={editPendingCategories}
                    isAddingCategory={editAddingCategoryId === expense._id}
                    newCategoryName={editNewCategoryName}
                    selectClassName={cn(selectClassName, "h-8")}
                    onStartAddCategory={() => { setEditAddingCategoryId(expense._id); setEditNewCategoryName(""); }}
                    onNewCategoryNameChange={setEditNewCategoryName}
                    onConfirmAddCategory={() => confirmNewEditCategory(expense)}
                    onCancelAddCategory={() => { setEditAddingCategoryId(null); setEditNewCategoryName(""); }}
                />
            );
        }

        if (editId === expense._id) {
            const exp = editableExpenses.find(e => e._id === expense._id) ?? expense;
            return (
                <ExpenseEditableRow
                    key={`editable-${exp._id}`}
                    expense={exp}
                    checkedExps={checkedExps}
                    handleCheck={handleCheck}
                    bg={bg}
                    editDate={editDate}
                    editAccount={editAccount}
                    editVendor={editVendor}
                    editAmount={editAmount}
                    editCategory={editCategory}
                    editNotes={editNotes}
                    editAssigned={editAssigned}
                    people={peopleForAssign}
                    selfMemberId={activeProfile?.memberId}
                    categories={existingCategories}
                    pendingCategories={editPendingCategories}
                    isAddingCategory={editAddingCategoryId === exp._id}
                    newCategoryName={editNewCategoryName}
                    selectClassName={cn(selectClassName, "h-8")}
                    onStartAddCategory={() => { setEditAddingCategoryId(exp._id); setEditNewCategoryName(""); }}
                    onNewCategoryNameChange={setEditNewCategoryName}
                    onConfirmAddCategory={() => confirmNewEditCategory(exp)}
                    onCancelAddCategory={() => { setEditAddingCategoryId(null); setEditNewCategoryName(""); }}
                />
            );
        }

        return (
            <ExpenseRow
                key={`row-${expense._id}`}
                expense={expense}
                checkedExps={checkedExps}
                handleCheck={handleCheck}
                handleDbClickEdit={canWrite ? handleDbClickEdit : () => {}}
                bg={bg}
                selectable={canWrite}
                assignedLabel={personName(expense)}
            />
        );
    }

    function renderTableBody() {
        const list = editMode ? editableExpenses : expenses;
        if (groupMode === "none") {
            return list.map((expense) => renderExpenseRow(expense, false));
        }

        const groups = groupExpenses(list, groupMode);
        return groups.map((group, index) => {
            const isOpen = expanded.get(group.key) !== false;
            const bg = index % 2 === 0;
            const countLabel = group.items.length === 1 ? "1 item" : `${group.items.length} items`;
            const groupIds = group.items.map((expense) => expense._id.toString());
            const selectedCount = groupIds.filter((id) => checkedExps.includes(id)).length;
            const allSelected = groupIds.length > 0 && selectedCount === groupIds.length;
            const someSelected = selectedCount > 0 && !allSelected;
            const groupLabel = groupMode === "person"
                ? (group.key === "split"
                    ? attributionLabel(null, people, activeProfile?.memberId)
                    : attributionLabel(group.key, people, activeProfile?.memberId))
                : (group.key || "(Blank)");
            return (
                <React.Fragment key={`group-${group.key}-${index}`}>
                    <TableRow className="cursor-pointer" onClick={() => toggleGroup(group.key)}>
                        {canWrite ? (
                        <TableCell
                            className={`${bg ? "bg-muted/40" : ""} w-10 text-center`}
                            onClick={(event) => event.stopPropagation()}
                        >
                            <Checkbox
                                checked={someSelected ? "indeterminate" : allSelected}
                                onCheckedChange={(checked) => handleCheckGroup(groupIds, checked === true)}
                                aria-label={`Select all in ${groupLabel}`}
                            />
                        </TableCell>
                        ) : null}
                        <TableCell className={`${bg ? "bg-muted/40" : ""} font-semibold`} colSpan={7}>
                            {groupLabel}{" "}
                            <span className="font-normal text-muted-foreground">({countLabel})</span>{" "}
                            {isOpen ? <ChevronUp className="inline h-4 w-4" /> : <ChevronRight className="inline h-4 w-4" />}
                        </TableCell>
                    </TableRow>
                    {isOpen ? group.items.map((expense) => renderExpenseRow(expense, bg)) : null}
                </React.Fragment>
            );
        });
    }

    const importCategoryStart = (importPage - 1) * IMPORT_CATEGORY_PAGE_SIZE;
    const importPageRowCount = Math.min(
        IMPORT_CATEGORY_PAGE_SIZE,
        Math.max(0, importDrafts.length - importCategoryStart),
    );
    const importSelectedCount = importSelected.filter(Boolean).length;
    const importAllSelected = importSelected.length > 0 && importSelectedCount === importSelected.length;
    const importDialogWide = Boolean(csvPreview) && importStep === "map";
    const importDialogPreview = importStep === "preview";
    const importDialogCategories = importStep === "categories";
    const importDialogTitle = importStep === "categories"
        ? "Assign categories"
        : importStep === "preview"
            ? "Review statement"
            : csvPreview
                ? "Import CSV"
                : "Import";
    const showImportUpload = importStep === "map" && !csvPreview && !importParsing;

    return (
        <div className="min-h-screen bg-background pb-20">
            <Header />
            <main className="space-y-6 px-8 py-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <h1 className="text-4xl font-semibold tracking-tight">Expenses</h1>
                    <div className="flex flex-wrap items-center gap-2">
                        {canWrite ? (
                        <>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv,.pdf,text/csv,application/pdf"
                            className="hidden"
                            onChange={handleImportFile}
                        />
                        <Button type="button" onClick={handleShow}>Add</Button>
                        <Button variant="outline" onClick={() => setShowImport(true)}>Import</Button>
                        {editMode || editId != null ? (
                            <>
                                <Button type="button" variant="outline" onClick={EditExpenses} disabled={editAddingCategoryId !== null}>Save</Button>
                                <Button type="button" variant="outline" onClick={() => { setEditMode(false); setEditId(null); setEditableExpenses(expenses); resetEditCategoryAdd(); }}>Cancel</Button>
                            </>
                        ) : (
                            <Button variant="outline" onClick={() => { setEditMode(true); setEditableExpenses(expenses); resetEditCategoryAdd(); }}>Edit</Button>
                        )}
                        <Button variant="destructive" onClick={DeleteExpenses}>Delete</Button>
                        </>
                        ) : (
                            <p className="text-sm text-muted-foreground">View only</p>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-muted-foreground">Group By:</span>
                        <Select value={groupMode} onValueChange={(value) => handleGroupBy(value as ExpensePart)}>
                            <SelectTrigger className="min-w-[8.5rem]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent position="popper">
                                <SelectItem value="none">None</SelectItem>
                                <SelectItem value="date">Date</SelectItem>
                                <SelectItem value="account">Account</SelectItem>
                                <SelectItem value="vendor">Vendor</SelectItem>
                                <SelectItem value="amount">Amount</SelectItem>
                                <SelectItem value="category">Category</SelectItem>
                                <SelectItem value="person">Person</SelectItem>
                            </SelectContent>
                        </Select>
                        <span className="text-sm text-muted-foreground">Date:</span>
                        <PeriodRangePicker
                            grain={dateGrain}
                            value={dateRange}
                            align="start"
                            onChange={handleDateRangeChange}
                            onGrainChange={handleDateGrainChange}
                            onClear={() => handleDateRangeChange(null)}
                        />
                        {groupMode !== "none" &&
                            <>
                                <Button variant="outline" onClick={() => setAllExpanded(true)}>Expand All</Button>
                                <Button variant="outline" onClick={() => setAllExpanded(false)}>Collapse All</Button>
                            </>
                        }
                    </div>
                    <div className="flex min-w-[280px] items-center gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                className="pl-8"
                                placeholder="Search"
                                aria-label="Search"
                                onChange={(e) => { setSearchByQuery(e.target.value); filterBySearch(searchBySelect, e.target.value) }}
                            />
                        </div>
                        <Select
                            value={searchBySelect}
                            onValueChange={(value) => {
                                setSearchBySelect(value);
                                filterBySearch(value, searchByQuery);
                            }}
                        >
                            <SelectTrigger className="min-w-[8.5rem]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent position="popper">
                                <SelectItem value="date">Date</SelectItem>
                                <SelectItem value="account">Account</SelectItem>
                                <SelectItem value="vendor">Vendor</SelectItem>
                                <SelectItem value="amount">Amount</SelectItem>
                                <SelectItem value="category">Category</SelectItem>
                                <SelectItem value="person">Person</SelectItem>
                                <SelectItem value="notes">Notes</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="rounded-xl border bg-card">
                    {expensesLoading ? (
                        <LoadingPanel message="Loading your expenses..." />
                    ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {canWrite ? (
                                <TableHead className="w-10 text-center">
                                    <Checkbox
                                        checked={expenses.length > 0 && checkedExps.length === expenses.length}
                                        onCheckedChange={(checked) => handleCheckAll(checked === true)}
                                    />
                                </TableHead>
                                ) : null}
                                <TableHead>
                                    <button className="inline-flex items-center gap-1" type="button" onClick={() => { sortBy("date", sortDate); setSortDate(sortDate === "down" ? "up" : "down") }}>
                                        {sortDate === "down" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}Date
                                    </button>
                                </TableHead>
                                <TableHead>
                                    <button className="inline-flex items-center gap-1" type="button" onClick={() => { sortBy("account", sortAccount); setSortAccount(sortAccount === "down" ? "up" : "down") }}>
                                        {sortAccount === "down" ? <ArrowUpAZ className="h-4 w-4" /> : <ArrowDownAZ className="h-4 w-4" />}Account
                                    </button>
                                </TableHead>
                                <TableHead>
                                    <button className="inline-flex items-center gap-1" type="button" onClick={() => { sortBy("vendor", sortVendor); setSortVendor(sortVendor === "down" ? "up" : "down") }}>
                                        {sortVendor === "down" ? <ArrowUpAZ className="h-4 w-4" /> : <ArrowDownAZ className="h-4 w-4" />}Vendor
                                    </button>
                                </TableHead>
                                <TableHead>
                                    <button className="inline-flex items-center gap-1" type="button" onClick={() => { sortBy("amount", sortAmount); setSortAmount(sortAmount === "down" ? "up" : "down") }}>
                                        {sortAmount === "down" ? <ArrowUp01 className="h-4 w-4" /> : <ArrowDown01 className="h-4 w-4" />}Amount
                                    </button>
                                </TableHead>
                                <TableHead className="w-[14rem] max-w-[14rem]">
                                    <button className="inline-flex items-center gap-1" type="button" onClick={() => { sortBy("category", sortCategory); setSortCategory(sortCategory === "down" ? "up" : "down") }}>
                                        {sortCategory === "down" ? <ArrowUpAZ className="h-4 w-4" /> : <ArrowDownAZ className="h-4 w-4" />}Category
                                    </button>
                                </TableHead>
                                <TableHead>
                                    Person
                                </TableHead>
                                <TableHead>
                                    <button className="inline-flex items-center gap-1" type="button" onClick={() => { sortBy("notes", sortNotes); setSortNotes(sortNotes === "down" ? "up" : "down") }}>
                                        {sortNotes === "down" ? <ArrowUpAZ className="h-4 w-4" /> : <ArrowDownAZ className="h-4 w-4" />}Notes
                                    </button>
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {renderTableBody()}
                        </TableBody>
                    </Table>
                    )}
                </div>

                {groupMode === "none" && !searchByQuery && !expensesLoading &&
                    <ExpensePagination
                        currentPage={currentPage}
                        perPage={perPage}
                        setCurrentPage={(page) => {
                            setCurrentPage(page);
                            showExpenses(expensesCopy, { page });
                        }}
                        totalExpenses={filteredTotal}
                    />
                }
            </main>

            <Dialog open={showForm} onOpenChange={(open) => { if (!open) handleClose(); }}>
                <DialogContent>
                    <form onSubmit={AddExpense}>
                        <DialogHeader>
                            <DialogTitle>Add An Expense</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-3 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="date">Date</Label>
                                <Input
                                    required
                                    id="date"
                                    value={formatDate(date)}
                                    type="date"
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDate(new Date(Date.parse(e.target.value)))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="account">Account</Label>
                                <select required className={selectClassName} id="account" onChange={handleAccount} value={accSelect}>
                                    <option value="">Select or Add an Account</option>
                                    {[...new Set(expenses?.map((expense: Expense) => expense.account))].map((account: string) => (
                                        <option key={account} value={accCounter++}>{account}</option>
                                    ))}
                                    <option value="-1">New Account</option>
                                </select>
                            </div>
                            {showAcc &&
                                <Input
                                    required
                                    type="text"
                                    value={newAccount}
                                    aria-label="newAccount"
                                    placeholder="New account name"
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setAccount(e.target.value); setNewAccount(e.target.value) }}
                                />
                            }
                            <div className="space-y-2">
                                <Label htmlFor="vendor">Vendor</Label>
                                <Input
                                    required
                                    id="vendor"
                                    type="text"
                                    value={vendor}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                        const value = e.target.value;
                                        setVendor(value);
                                        suggestCategoryFromVendor(value);
                                    }}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="amount">Amount</Label>
                                <Input
                                    required
                                    id="amount"
                                    type="number"
                                    value={amount != 0 ? amount : ""}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(Number(e.target.value))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="category">Category</Label>
                                <div className="flex items-center gap-1">
                                    {showCat ? (
                                        <Input
                                            required
                                            id="category"
                                            type="text"
                                            value={newCategory}
                                            autoFocus
                                            aria-label="New category name"
                                            placeholder="New category name"
                                            className="min-w-0 flex-1"
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCategory(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    confirmNewCategory();
                                                }
                                                if (e.key === "Escape") cancelNewCategory();
                                            }}
                                        />
                                    ) : (
                                        <select
                                            required
                                            className={cn(selectClassName, "min-w-0 flex-1")}
                                            id="category"
                                            onChange={handleCategory}
                                            value={catSelect}
                                        >
                                            <option value={NEW_CATEGORY_OPTION}>*New category*</option>
                                            <option value="">Select a category</option>
                                            {uniqueCategoryNames([...existingCategories, category]).map((name: string) => (
                                                <option key={name} value={name}>{name}</option>
                                            ))}
                                        </select>
                                    )}
                                    {showCat ? (
                                        <>
                                            <Button
                                                type="button"
                                                size="icon"
                                                variant="outline"
                                                className="shrink-0"
                                                disabled={!newCategory.trim()}
                                                onClick={confirmNewCategory}
                                                aria-label="Save category"
                                            >
                                                <Check />
                                            </Button>
                                            <Button
                                                type="button"
                                                size="icon"
                                                variant="outline"
                                                className="shrink-0"
                                                onClick={cancelNewCategory}
                                                aria-label="Cancel new category"
                                            >
                                                <X />
                                            </Button>
                                        </>
                                    ) : categoryHint ? (
                                        <SuggestionHint
                                            fingerprint={categoryHint}
                                            onThumbsDown={() => {
                                                pendingVendorCorrection.current = true;
                                                setCategoryLocked(true);
                                            }}
                                        />
                                    ) : null}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="assigned">For</Label>
                                <AttributionSelect
                                    id="assigned"
                                    className={selectClassName}
                                    value={assignedMemberId === SPLIT_VALUE ? null : assignedMemberId}
                                    people={peopleForAssign}
                                    selfMemberId={activeProfile?.memberId}
                                    onChange={(memberId) => setAssignedMemberId(memberId || SPLIT_VALUE)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="notes">Notes</Label>
                                <Textarea
                                    id="notes"
                                    value={notes}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                                />
                            </div>
                            {formError ? (
                                <p className="text-sm text-destructive" role="alert">{formError}</p>
                            ) : null}
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={handleClose}>Close</Button>
                            <Button type="submit">Add</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={showImport} onOpenChange={(open) => { if (!open) closeImport(); }}>
                <DialogContent
                    className={cn(
                        "flex flex-col overflow-hidden",
                        importDialogWide && "max-h-[90vh] w-[min(96vw,80rem)] sm:max-w-[80rem]",
                        importDialogPreview && "max-h-[90vh] w-[min(96vw,56rem)] sm:max-w-4xl",
                        importDialogCategories && "max-h-[90vh] w-[min(96vw,56rem)] sm:max-w-4xl",
                    )}
                >
                    <DialogHeader>
                        <DialogTitle>{importDialogTitle}</DialogTitle>
                    </DialogHeader>
                    <div className={cn("space-y-4", (csvPreview || importStep === "preview" || importStep === "categories") && "min-h-0 flex-1 overflow-y-auto")}>
                        {showImportUpload &&
                            <FileUpload
                                acceptedFileTypes={[".csv", ".pdf"]}
                                maxFileSize={12 * 1024 * 1024}
                                uploadDelay={0}
                                onUploadSuccess={(file) => {
                                    if (isPdfFile(file)) {
                                        void parsePdfStatement(file);
                                        return;
                                    }
                                    const reader = new FileReader();
                                    reader.onload = () => {
                                        try {
                                            loadCsvText(String(reader.result || ""));
                                        } catch (err) {
                                            reportError(err);
                                        }
                                    };
                                    reader.readAsText(file);
                                }}
                            />
                        }
                        {importParsing &&
                            <LoadingPanel
                                className="py-10"
                                message="Reading your statement..."
                                detail="This can take up to a minute."
                            />
                        }
                        {showImportUpload && importError && <p className="text-sm text-destructive">{importError}</p>}
                        {csvPreview && columnMapping && importStep === "map" &&
                            <>
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm text-muted-foreground">
                                        Choose what each column maps to. Scroll to review the file like a spreadsheet.
                                    </p>
                                    <div className="flex shrink-0 items-center gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={negateAmountColumn}
                                        >
                                            Multiply debits
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={resetImportFile}
                                        >
                                            Change file
                                        </Button>
                                    </div>
                                </div>
                                <CsvSpreadsheetMapper
                                    key={csvPreview.originalHeaders.join("|")}
                                    headers={csvPreview.originalHeaders}
                                    rows={csvPreview.rows}
                                    mapping={columnMapping}
                                    onChange={(next) => { setColumnMapping(next); setImportError(""); }}
                                />
                                {csvMappingError && <p className="text-sm text-destructive">{csvMappingError}</p>}
                                {csvResult &&
                                    <p className="text-sm text-muted-foreground">
                                        {csvResult.expenses.length} expense{csvResult.expenses.length === 1 ? "" : "s"} ready to import
                                        {csvResult.skipped > 0 ? ` (${csvResult.skipped} row${csvResult.skipped === 1 ? "" : "s"} skipped)` : ""}.
                                        {csvResult.hasCategory ? " Categories from the mapped column will be applied and can be edited next. New names are created when you import." : ""}
                                    </p>
                                }
                                {csvResult && !csvResult.hasAccount &&
                                    <div className="space-y-2">
                                        <Label htmlFor="importAccount">Account for imported rows</Label>
                                        <Input
                                            required
                                            id="importAccount"
                                            type="text"
                                            value={importAccount}
                                            placeholder="e.g. MBNA"
                                            onChange={(e) => setImportAccount(e.target.value)}
                                        />
                                    </div>
                                }
                                {importError && <p className="text-sm text-destructive">{importError}</p>}
                            </>
                        }
                        {importStep === "preview" &&
                            <>
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm text-muted-foreground">
                                        Review extracted transactions. Uncheck rows you do not want to import.
                                    </p>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={resetImportFile}
                                    >
                                        Change file
                                    </Button>
                                </div>
                                {importWarnings.map((warning) => (
                                    <p key={warning} className="text-sm text-amber-700 dark:text-amber-400">{warning}</p>
                                ))}
                                <div>
                                    <div className="rounded-md border">
                                    <Table className="table-fixed">
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-10 text-center">
                                                    <Checkbox
                                                        checked={importAllSelected}
                                                        onCheckedChange={(checked) => toggleImportSelectedAll(checked === true)}
                                                        aria-label="Select all transactions"
                                                    />
                                                </TableHead>
                                                <TableHead className="w-28">Date</TableHead>
                                                <TableHead>Account</TableHead>
                                                <TableHead>Vendor</TableHead>
                                                <TableHead className="w-24">Amount</TableHead>
                                                <TableHead>Notes</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {importDrafts.slice(importCategoryStart, importCategoryStart + IMPORT_CATEGORY_PAGE_SIZE).map((expense, index) => {
                                                const draftIndex = importCategoryStart + index;
                                                const included = importSelected[draftIndex] !== false;
                                                return (
                                                    <TableRow key={`import-preview-${draftIndex}`} className={included ? "" : "opacity-50"}>
                                                        <TableCell className="text-center">
                                                            <Checkbox
                                                                checked={included}
                                                                onCheckedChange={(checked) => toggleImportSelected(draftIndex, checked === true)}
                                                                aria-label={`Include ${expense.vendor}`}
                                                            />
                                                        </TableCell>
                                                        <TableCell>{formatDate(expense.date)}</TableCell>
                                                        <TableCell className="truncate" title={expense.account}>{expense.account}</TableCell>
                                                        <TableCell className="truncate" title={expense.vendor}>{expense.vendor}</TableCell>
                                                        <TableCell>{expense.amount}</TableCell>
                                                        <TableCell className="truncate" title={expense.notes}>{expense.notes}</TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                    </div>
                                    <ImportPageSpacer rowsOnPage={importPageRowCount} rowHeight="2.5rem" />
                                </div>
                                <ImportCategoryPager
                                    page={importPage}
                                    perPage={IMPORT_CATEGORY_PAGE_SIZE}
                                    total={importDrafts.length}
                                    onPage={setImportPage}
                                />
                                {!importHasAccount &&
                                    <div className="space-y-2">
                                        <Label htmlFor="importPdfAccount">Account for imported rows</Label>
                                        <Input
                                            required
                                            id="importPdfAccount"
                                            type="text"
                                            value={importAccount}
                                            placeholder="e.g. MBNA"
                                            onChange={(e) => setImportAccount(e.target.value)}
                                        />
                                    </div>
                                }
                                {importError && <p className="text-sm text-destructive">{importError}</p>}
                            </>
                        }
                        {importStep === "categories" &&
                            <>
                                <p className="text-sm text-muted-foreground">
                                    {importSource === "csv" && csvResult?.hasCategory
                                        ? "Categories from your file are applied. Edit any row before import; new names are created when you import."
                                        : "Set a category for each transaction. Uncheck rows you do not want to import."}
                                </p>
                                {importWarnings.map((warning) => (
                                    <p key={warning} className="text-sm text-amber-700 dark:text-amber-400">{warning}</p>
                                ))}
                                <div>
                                    <div className="rounded-md border">
                                    <Table className="table-fixed">
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-10 text-center">
                                                    <Checkbox
                                                        checked={importAllSelected}
                                                        onCheckedChange={(checked) => toggleImportSelectedAll(checked === true)}
                                                        aria-label="Select all transactions"
                                                    />
                                                </TableHead>
                                                <TableHead className="w-28">Date</TableHead>
                                                <TableHead>Account</TableHead>
                                                <TableHead>Vendor</TableHead>
                                                <TableHead className="w-24">Amount</TableHead>
                                                <TableHead className="w-[18rem]">Category</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {importDrafts.slice(importCategoryStart, importCategoryStart + IMPORT_CATEGORY_PAGE_SIZE).map((expense, index) => {
                                                const draftIndex = importCategoryStart + index;
                                                const included = importSelected[draftIndex] !== false;
                                                return (
                                                    <TableRow key={`import-cat-${draftIndex}`} className={included ? "" : "opacity-50"}>
                                                        <TableCell className="text-center">
                                                            <Checkbox
                                                                checked={included}
                                                                onCheckedChange={(checked) => toggleImportSelected(draftIndex, checked === true)}
                                                                aria-label={`Include ${expense.vendor}`}
                                                            />
                                                        </TableCell>
                                                        <TableCell>{formatDate(expense.date)}</TableCell>
                                                        <TableCell className="truncate" title={expense.account}>{expense.account}</TableCell>
                                                        <TableCell className="truncate" title={expense.vendor}>{expense.vendor}</TableCell>
                                                        <TableCell>{expense.amount}</TableCell>
                                                        <TableCell className="w-[18rem]">
                                                            <ImportCategorySelect
                                                                value={expense.category}
                                                                categories={importCategories}
                                                                pendingCategories={importPendingCategories}
                                                                isAdding={addingCategoryIndex === draftIndex}
                                                                newName={newImportCategory}
                                                                selectClassName={cn(selectClassName, "h-8")}
                                                                suggestion={importSuggested[draftIndex] ? vendorFingerprint(expense.vendor) : ""}
                                                                onChange={(category) => setDraftCategory(draftIndex, category, importCorrectingIndex === draftIndex)}
                                                                onThumbsDown={() => setImportCorrectingIndex(draftIndex)}
                                                                onStartAdd={() => { setAddingCategoryIndex(draftIndex); setNewImportCategory(""); }}
                                                                onNewNameChange={setNewImportCategory}
                                                                onConfirmAdd={() => confirmNewImportCategory(draftIndex)}
                                                                onCancelAdd={() => { setAddingCategoryIndex(null); setNewImportCategory(""); }}
                                                            />
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                    </div>
                                    <ImportPageSpacer rowsOnPage={importPageRowCount} rowHeight="3rem" />
                                </div>
                                <ImportCategoryPager
                                    page={importPage}
                                    perPage={IMPORT_CATEGORY_PAGE_SIZE}
                                    total={importDrafts.length}
                                    onPage={setImportPage}
                                />
                                {importError && <p className="text-sm text-destructive">{importError}</p>}
                            </>
                        }
                    </div>
                    <DialogFooter>
                        {importStep === "categories" ? (
                            <>
                                <Button variant="outline" disabled={importing} onClick={() => { setImportStep(importSource === "pdf" ? "preview" : "map"); setImportError(""); }}>Back</Button>
                                <Button disabled={importing || importSelectedCount === 0 || addingCategoryIndex !== null} type="button" onClick={ImportExpenses}>
                                    {importing ? "Importing..." : `Import${importSelectedCount ? ` (${importSelectedCount})` : ""}`}
                                </Button>
                            </>
                        ) : importStep === "preview" ? (
                            <>
                                <Button variant="outline" disabled={importParsing} onClick={closeImport}>Cancel</Button>
                                <Button
                                    disabled={importParsing || importDrafts.length === 0}
                                    type="button"
                                    onClick={continueToCategories}
                                >
                                    Continue
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button variant="outline" disabled={importing || importParsing} onClick={closeImport}>Cancel</Button>
                                {csvPreview &&
                                    <Button
                                        disabled={importing || Boolean(csvMappingError) || !csvResult?.expenses.length}
                                        type="button"
                                        onClick={continueToCategories}
                                    >
                                        Continue
                                    </Button>
                                }
                            </>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}


interface CsvSpreadsheetMapperProps {
    headers: string[];
    rows: string[][];
    mapping: ColumnMapping;
    onChange: (mapping: ColumnMapping) => void;
}

function CsvSpreadsheetMapper({ headers, rows, mapping, onChange }: CsvSpreadsheetMapperProps) {
    const [visibleColumns, setVisibleColumns] = useState(CSV_PAGE_SIZE);
    const [visibleRows, setVisibleRows] = useState(CSV_PAGE_SIZE);

    const columnField = useMemo(() => {
        const mapped = new Map<number, ColumnField>();
        for (const field of COLUMN_FIELDS) {
            if (mapping[field.key] >= 0) mapped.set(mapping[field.key], field.key);
        }
        return mapped;
    }, [mapping]);

    const shownHeaders = headers.slice(0, visibleColumns);
    const shownRows = rows.slice(0, visibleRows);
    const hiddenColumns = headers.length - shownHeaders.length;
    const hiddenRows = rows.length - shownRows.length;

    const cellClass = "border-r border-b border-border px-2 py-1.5 text-left text-xs";

    return (
        <div className="overflow-auto rounded-md border bg-background" style={{ maxHeight: "min(50vh, 28rem)" }}>
            <div className="min-w-max pb-5">
            <table className="border-separate border-spacing-0 text-sm">
                <thead className="sticky top-0 z-20 bg-muted">
                    <tr>
                        <th
                            className={cn(
                                cellClass,
                                "sticky left-0 z-30 w-12 min-w-12 bg-muted font-medium text-muted-foreground",
                            )}
                        />
                        {shownHeaders.map((_, index) => {
                            const field = columnField.get(index) ?? "";
                            return (
                                <th
                                    key={`map-${index}`}
                                    className={cn(
                                        cellClass,
                                        "min-w-[10.5rem] bg-muted p-1.5 font-normal",
                                        field && "bg-accent",
                                    )}
                                >
                                    <select
                                        aria-label={`Map ${headers[index] || `column ${index + 1}`}`}
                                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                                        value={field}
                                        onChange={(e) => onChange(assignColumnField(mapping, index, e.target.value as ColumnField | ""))}
                                    >
                                        <option value="">Don't use</option>
                                        {COLUMN_FIELDS.map((item) => (
                                            <option key={item.key} value={item.key}>
                                                {item.label}{item.required ? " *" : ""}
                                            </option>
                                        ))}
                                    </select>
                                </th>
                            );
                        })}
                        {hiddenColumns > 0 &&
                            <th className={cn(cellClass, "sticky right-0 z-20 min-w-[4.5rem] bg-muted p-1")}>
                                <button
                                    type="button"
                                    className="flex h-8 w-full items-center justify-center rounded-md hover:bg-background"
                                    onClick={() => setVisibleColumns((count) => count + CSV_PAGE_SIZE)}
                                    aria-label={`Show ${hiddenColumns} more columns`}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </th>
                        }
                    </tr>
                    <tr>
                        <th
                            className={cn(
                                cellClass,
                                "sticky left-0 z-30 bg-muted text-center text-[11px] font-medium text-muted-foreground",
                            )}
                        >
                            #
                        </th>
                        {shownHeaders.map((header, index) => (
                            <th
                                key={`header-${index}`}
                                className={cn(
                                    cellClass,
                                    "max-w-[14rem] truncate bg-muted text-[11px] font-semibold",
                                    columnField.has(index) && "bg-accent",
                                )}
                                title={header || `Column ${index + 1}`}
                            >
                                {header || `Column ${index + 1}`}
                            </th>
                        ))}
                        {hiddenColumns > 0 &&
                            <th className={cn(cellClass, "sticky right-0 bg-muted text-center text-[11px] font-medium text-muted-foreground")}>
                                +{hiddenColumns}
                            </th>
                        }
                    </tr>
                </thead>
                <tbody>
                    {shownRows.map((row, rowIndex) => (
                        <tr key={`row-${rowIndex}`} className="hover:bg-muted/40">
                            <th
                                className={cn(
                                    cellClass,
                                    "sticky left-0 z-10 bg-muted text-center font-medium tabular-nums text-muted-foreground",
                                )}
                            >
                                {rowIndex + 1}
                            </th>
                            {shownHeaders.map((_, index) => (
                                <td
                                    key={`cell-${rowIndex}-${index}`}
                                    className={cn(
                                        cellClass,
                                        "max-w-[14rem] truncate bg-background font-normal",
                                        columnField.has(index) && "bg-accent",
                                    )}
                                    title={row[index] || ""}
                                >
                                    {row[index] || ""}
                                </td>
                            ))}
                            {hiddenColumns > 0 &&
                                <td className={cn(cellClass, "sticky right-0 bg-muted text-center text-muted-foreground")}>
                                    …
                                </td>
                            }
                        </tr>
                    ))}
                    {hiddenRows > 0 &&
                        <tr>
                            <td
                                className={cn(cellClass, "bg-muted p-0")}
                                colSpan={shownHeaders.length + (hiddenColumns > 0 ? 2 : 1)}
                            >
                                <button
                                    type="button"
                                    className="flex w-full items-center justify-center gap-1 py-2 text-xs font-medium text-muted-foreground hover:bg-muted"
                                    onClick={() => setVisibleRows((count) => count + CSV_PAGE_SIZE)}
                                >
                                    <ChevronDown className="h-4 w-4" />
                                    Show {Math.min(hiddenRows, CSV_PAGE_SIZE)} more rows
                                    {hiddenRows > CSV_PAGE_SIZE ? ` (${hiddenRows} remaining)` : ""}
                                </button>
                            </td>
                        </tr>
                    }
                </tbody>
            </table>
            </div>
        </div>
    );
}

interface ImportCategorySelectProps {
    value: string;
    categories: string[];
    pendingCategories?: string[];
    isAdding: boolean;
    newName: string;
    selectClassName: string;
    suggestion?: string;
    onChange: (category: string) => void;
    onThumbsDown?: () => void;
    onStartAdd: () => void;
    onNewNameChange: (value: string) => void;
    onConfirmAdd: () => void;
    onCancelAdd: () => void;
    className?: string;
}

function HoverTip({ label, children }: { label: string; children: React.ReactElement }) {
    return (
        <Tooltip.Root>
            <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
            <Tooltip.Portal>
                <Tooltip.Content
                    side="top"
                    align="center"
                    sideOffset={6}
                    collisionPadding={12}
                    className="z-[100] max-w-[16rem] rounded-md bg-foreground px-2 py-1 text-center text-[11px] leading-snug text-background shadow-md"
                >
                    {label}
                </Tooltip.Content>
            </Tooltip.Portal>
        </Tooltip.Root>
    );
}

function SuggestionHint({ fingerprint, onThumbsDown }: { fingerprint: string; onThumbsDown: () => void }) {
    return (
        <Tooltip.Provider delayDuration={200}>
            <span className="flex shrink-0 items-center">
                <HoverTip label={`Suggested from ${fingerprint}`}>
                    <button
                        type="button"
                        className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        aria-label={`Suggested from ${fingerprint}`}
                    >
                        <CircleHelp className="size-3.5" />
                    </button>
                </HoverTip>
                <HoverTip label="This suggestion is wrong">
                    <button
                        type="button"
                        className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        aria-label="This suggestion is wrong"
                        onClick={onThumbsDown}
                    >
                        <ThumbsDown className="size-3.5" />
                    </button>
                </HoverTip>
            </span>
        </Tooltip.Provider>
    );
}

function ImportCategorySelect({
    value,
    categories,
    pendingCategories = [],
    isAdding,
    newName,
    selectClassName,
    suggestion,
    onChange,
    onThumbsDown,
    onStartAdd,
    onNewNameChange,
    onConfirmAdd,
    onCancelAdd,
    className,
}: ImportCategorySelectProps) {
    const options = uniqueCategoryNames([
        ...categories,
        ...pendingCategories,
        ...(value && !categories.includes(value) && !pendingCategories.includes(value) ? [value] : []),
    ]);

    return (
        <div className={cn("flex h-8 w-full min-w-0 items-center gap-1", className)}>
            {isAdding ? (
                <Input
                    className="h-8 min-w-0 flex-1"
                    value={newName}
                    autoFocus
                    placeholder="New category"
                    aria-label="New category name"
                    onChange={(e) => onNewNameChange(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") onConfirmAdd();
                        if (e.key === "Escape") onCancelAdd();
                    }}
                />
            ) : (
                <select
                    className={`${selectClassName} min-w-0 max-w-full flex-1 field-sizing-fixed`}
                    value={value}
                    aria-label="Category"
                    onChange={(e) => {
                        if (e.target.value === NEW_CATEGORY_OPTION) onStartAdd();
                        else onChange(e.target.value);
                    }}
                >
                    {options.map((category) => (
                        <option key={category} value={category}>{category}</option>
                    ))}
                    <option value={NEW_CATEGORY_OPTION}>New category</option>
                </select>
            )}
            {isAdding ? (
                <>
            <Button
                type="button"
                size="icon-sm"
                variant="outline"
                className="size-8 shrink-0"
                disabled={!newName.trim()}
                onClick={onConfirmAdd}
                aria-label="Save category"
            >
                <Check />
            </Button>
            <Button
                type="button"
                size="icon-sm"
                variant="outline"
                className="size-8 shrink-0"
                onClick={onCancelAdd}
                aria-label="Cancel new category"
            >
                <X />
            </Button>
                </>
            ) : suggestion && onThumbsDown ? (
                <SuggestionHint fingerprint={suggestion} onThumbsDown={onThumbsDown} />
            ) : null}
        </div>
    );
}

function uniqueCategoryNames(names: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const name of names) {
        const trimmed = String(name || "").replace(/\s+/g, " ").trim();
        if (!trimmed) continue;
        const key = trimmed.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(trimmed);
    }
    return out;
}

function LoadingPanel({
    message,
    detail,
    className,
}: {
    message: string;
    detail?: string;
    className?: string;
}) {
    return (
        <div
            className={cn("flex flex-col items-center justify-center gap-3 py-16 text-center", className)}
            role="status"
            aria-live="polite"
        >
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
            <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{message}</p>
                {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
            </div>
        </div>
    );
}

function ImportPageSpacer({ rowsOnPage, rowHeight }: { rowsOnPage: number; rowHeight: string }) {
    const empty = Math.max(0, IMPORT_CATEGORY_PAGE_SIZE - rowsOnPage);
    if (empty === 0) return null;
    return <div aria-hidden style={{ height: `calc(${empty} * ${rowHeight})` }} />;
}

function ImportCategoryPager({
    page,
    perPage,
    total,
    onPage,
}: {
    page: number;
    perPage: number;
    total: number;
    onPage: (page: number) => void;
}) {
    const totalPages = Math.max(1, Math.ceil(total / perPage) || 1);
    const start = total === 0 ? 0 : (page - 1) * perPage + 1;
    const end = Math.min(page * perPage, total);

    return (
        <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">{start}–{end} of {total}</p>
            <div className="flex items-center gap-1">
                <Button type="button" size="icon-sm" variant="outline" disabled={page === 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
                    <ChevronLeft />
                </Button>
                <Button type="button" size="icon-sm" variant="outline" disabled={page === totalPages} onClick={() => onPage(page + 1)} aria-label="Next page">
                    <ChevronRight />
                </Button>
            </div>
        </div>
    );
}

function AttributionSelect({
    id,
    className,
    value,
    people,
    selfMemberId,
    onChange,
}: {
    id?: string,
    className?: string,
    value: string | null,
    people: ProfileMember[],
    selfMemberId?: string | null,
    onChange: (memberId: string | null) => void,
}) {
    return (
        <select
            id={id}
            className={className}
            value={value || SPLIT_VALUE}
            onChange={(event) => {
                const next = event.target.value;
                onChange(next === SPLIT_VALUE ? null : next);
            }}
        >
            <option value={SPLIT_VALUE}>
                {people.length > 1 ? `Split (${people.length})` : "Split"}
            </option>
            {people.map((member) => (
                <option key={member.id} value={member.id}>
                    {personLabel(member, selfMemberId)}
                </option>
            ))}
        </select>
    );
}

interface EditableExpenseRowProps {
    expense: Expense,
    checkedExps: string[],
    handleCheck: (id: string, checked: boolean) => void,
    editDate: (expense: Expense, d: string) => void,
    editAccount: (expense: Expense, a: string) => void,
    editVendor: (expense: Expense, v: string) => void,
    editAmount: (expense: Expense, a: number) => void,
    editCategory: (expense: Expense, c: string) => void,
    editNotes: (expense: Expense, n: string) => void,
    editAssigned: (expense: Expense, memberId: string | null) => void,
    people: ProfileMember[],
    selfMemberId?: string | null,
    bg: boolean,
    categories: string[],
    pendingCategories: string[],
    isAddingCategory: boolean,
    newCategoryName: string,
    selectClassName: string,
    onStartAddCategory: () => void,
    onNewCategoryNameChange: (value: string) => void,
    onConfirmAddCategory: () => void,
    onCancelAddCategory: () => void,
}

function ExpenseEditableRow({
    expense,
    checkedExps,
    handleCheck,
    editDate,
    editAccount,
    editVendor,
    editAmount,
    editCategory,
    editNotes,
    editAssigned,
    people,
    selfMemberId,
    bg,
    categories,
    pendingCategories,
    isAddingCategory,
    newCategoryName,
    selectClassName,
    onStartAddCategory,
    onNewCategoryNameChange,
    onConfirmAddCategory,
    onCancelAddCategory,
}: EditableExpenseRowProps) {
    const bgClr = bg ? "bg-muted/40" : "";
    return (
        <TableRow key={expense._id.toString()} className={bgClr}>
            <TableCell>
                <Checkbox
                    checked={checkedExps.includes(expense._id.toString())}
                    onCheckedChange={(checked) => handleCheck(expense._id.toString(), checked === true)}
                />
            </TableCell>
            <TableCell><Input className="h-8" type="date" value={formatDate(expense.date)} onChange={(e) => { editDate(expense, e.target.value) }} /></TableCell>
            <TableCell><Input className="h-8" type="text" value={expense.account} onChange={(e) => { editAccount(expense, e.target.value) }} /></TableCell>
            <TableCell><Input className="h-8" type="text" value={expense.vendor} onChange={(e) => { editVendor(expense, e.target.value) }} /></TableCell>
            <TableCell><Input className="h-8" type="number" value={expense.amount} onChange={(e) => { editAmount(expense, Number(e.target.value)) }} /></TableCell>
            <TableCell className="w-[14rem] max-w-[14rem]">
                <ImportCategorySelect
                    value={expense.category}
                    categories={categories}
                    pendingCategories={pendingCategories}
                    isAdding={isAddingCategory}
                    newName={newCategoryName}
                    className="w-[14rem] max-w-[14rem]"
                    selectClassName={selectClassName}
                    onChange={(category) => editCategory(expense, category)}
                    onStartAdd={onStartAddCategory}
                    onNewNameChange={onNewCategoryNameChange}
                    onConfirmAdd={onConfirmAddCategory}
                    onCancelAdd={onCancelAddCategory}
                />
            </TableCell>
            <TableCell>
                <AttributionSelect
                    className={cn(selectClassName, "h-8")}
                    value={expense.assignedMemberId}
                    people={people}
                    selfMemberId={selfMemberId}
                    onChange={(memberId) => editAssigned(expense, memberId)}
                />
            </TableCell>
            <TableCell><Input className="h-8" type="text" value={expense.notes ? expense.notes : ""} onChange={(e) => { editNotes(expense, e.target.value) }} /></TableCell>
        </TableRow>
    )
}

interface ExpenseRowProps {
    expense: Expense,
    checkedExps: string[],
    handleCheck: (id: string, checked: boolean) => void,
    handleDbClickEdit: (id: string) => void,
    bg: boolean,
    selectable?: boolean,
    assignedLabel: string,
}

function ExpenseRow({ expense, checkedExps, handleCheck, handleDbClickEdit, bg, selectable = true, assignedLabel }: ExpenseRowProps) {
    const bgClr = bg ? "bg-muted/40" : "";
    return (
        <TableRow className={bgClr} onDoubleClick={() => { handleDbClickEdit(expense._id) }}>
            {selectable ? (
            <TableCell>
                <Checkbox
                    checked={checkedExps.includes(expense._id.toString())}
                    onCheckedChange={(checked) => handleCheck(expense._id.toString(), checked === true)}
                />
            </TableCell>
            ) : null}
            <TableCell>{formatDate(expense.date)}</TableCell>
            <TableCell>{expense.account}</TableCell>
            <TableCell>{expense.vendor}</TableCell>
            <TableCell>{expense.amount}</TableCell>
            <TableCell className="w-[14rem] max-w-[14rem]">
                <span className="block max-w-[14rem] truncate" title={expense.category}>{expense.category}</span>
            </TableCell>
            <TableCell>{assignedLabel}</TableCell>
            <TableCell>{expense.notes ? expense.notes : ""}</TableCell>
        </TableRow>
    )
}

interface ExpensePaginationProps {
    currentPage: number,
    setCurrentPage: (page: number) => void,
    perPage: number,
    totalExpenses: number,
}

function ExpensePagination({ currentPage, setCurrentPage, perPage, totalExpenses }: ExpensePaginationProps) {
    const totalPages = Math.ceil(totalExpenses / perPage);
    const pageNumbers: number[] = [];

    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            pageNumbers.push(i);
        }
    }

    if (pageNumbers.length <= 1) return null;

    return (
        <div className="fixed bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full border bg-card/95 p-1 shadow-lg backdrop-blur">
            <Button disabled={currentPage === 1} size="icon-sm" variant="ghost" onClick={() => setCurrentPage(1)}>
                <ChevronsLeft />
            </Button>
            <Button disabled={currentPage === 1} size="icon-sm" variant="ghost" onClick={() => setCurrentPage(currentPage - 1)}>
                <ChevronLeft />
            </Button>
            {pageNumbers.map((number, index) => (
                <React.Fragment key={number}>
                    {index > 0 && number - pageNumbers[index - 1] > 1 && <span className="px-1 text-muted-foreground">…</span>}
                    <Button
                        size="icon-sm"
                        variant={number === currentPage ? "default" : "ghost"}
                        onClick={() => setCurrentPage(number)}
                    >
                        {number}
                    </Button>
                </React.Fragment>
            ))}
            <Button disabled={currentPage === totalPages} size="icon-sm" variant="ghost" onClick={() => setCurrentPage(currentPage + 1)}>
                <ChevronRight />
            </Button>
            <Button disabled={currentPage === totalPages} size="icon-sm" variant="ghost" onClick={() => setCurrentPage(totalPages)}>
                <ChevronsRight />
            </Button>
        </div>
    );
}

export default Expenses



