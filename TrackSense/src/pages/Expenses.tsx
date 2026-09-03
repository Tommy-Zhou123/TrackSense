import React, { useState, useEffect, useRef } from 'react'
import { Header } from './Home';
import { api } from '../lib/api';
import { useNavigate } from 'react-router-dom';
import {
    ArrowDown,
    ArrowDownAZ,
    ArrowDown01,
    ArrowUp,
    ArrowUpAZ,
    ArrowUp01,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    ChevronsLeft,
    ChevronsRight,
    Search,
} from 'lucide-react';
import FileUpload from '@/components/kokonutui/file-upload';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { parseExpenseCsv, CsvParseResult } from '../utils/csvImport';

interface Expense {
    _id: string,
    date: Date,
    account: string,
    vendor: string,
    category: string,
    amount: number,
    notes: string,
}

type ExpensePart = "none" | "date" | "account" | "vendor" | "amount" | "category" | "notes";



const formatDate = (date: Date) => {
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

function buildExpandedMap(list: Expense[], mode: ExpensePart, open: boolean): Map<string, boolean> {
    const next = new Map<string, boolean>();
    for (const expense of list) {
        next.set(getGroupKey(expense, mode), open);
    }
    return next;
}


const Expenses = () => {
    let accCounter = 1;
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [expensesCopy, setExpensesCopy] = useState<Expense[]>([]);
    const [editableExpenses, setEditableExpenses] = useState<Expense[]>([]);
    const [checkedExps, setCheckedExps] = useState<string[]>([]);

    const [accSelect, setAccSelect] = useState('');
    const [newAccount, setNewAccount] = useState('');

    const [catSelect, setCatSelect] = useState('');
    const [newCategory, setNewCategory] = useState('');

    const [showForm, setShowForm] = useState(false);
    const [showCat, setShowCat] = useState(false);
    const [showAcc, setShowAcc] = useState(false);

    const [editMode, setEditMode] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);

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

    const [expanded, setExpanded] = useState<Map<string, boolean>>(new Map());

    const [showImport, setShowImport] = useState(false);
    const [csvResult, setCsvResult] = useState<CsvParseResult | null>(null);
    const [importAccount, setImportAccount] = useState('');
    const [importCategory, setImportCategory] = useState('Uncategorized');
    const [importing, setImporting] = useState(false);
    const [importError, setImportError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const navigate = useNavigate();

    const handleClose = () => setShowForm(false);
    const handleShow = () => setShowForm(true);

    useEffect(() => {
        getExpenses()
    }, [])

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
    }

    function getExpenses(sort: boolean = true, page: number = -1) {
        api.get(`/api/expenses`)
            .then((response) => {
                const expensesWithDates = response.data.expenses.map((expense: any) => ({
                    ...expense,
                    date: new Date(expense.date)
                }));
                if (sort) expensesWithDates.sort(function (a: Expense, b: Expense) { return b.date.getTime() - a.date.getTime() });
                console.log(expensesWithDates);
                if (page === -1) page = currentPage;
                setExpenses(expensesWithDates.slice((page - 1) * perPage, (page) * perPage));
                console.log(expensesWithDates.slice((page - 1) * perPage, (page) * perPage));
                console.log((page - 1) * perPage, (page) * perPage);
                setExpensesCopy(expensesWithDates);
            })
            .catch((err) => {
                setExpenses([]);
                setExpensesCopy([]);
                if (err?.response?.data?.message === "Not Logged In" || err?.response?.status === 401) {
                    navigate("/login");
                } else {
                    alert("Error retrieving expense data, please try again later.")
                }
            })
    }

    function AddExpense(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        if (date != null && account != null && vendor != null && amount != null && category != null) {
            const data = {
                date, account, vendor, amount, category, notes
            }
            api.post(`/api/expenses/add`, data)
                .then((res) => {
                    let updatedExpenses: Expense[] = [...expenses, { _id: res.data._id, ...data }];
                    setExpenses(updatedExpenses);
                    let updatedExpensesCopy: Expense[] = [...expensesCopy, { _id: res.data._id, ...data }];
                    setExpensesCopy(updatedExpensesCopy);
                    handleClose()
                    setShowAcc(false);
                    setShowCat(false);
                    clearFormValues()
                })
                .catch((err) => {
                    console.error(err);
                    alert("Error adding expense, please try again.")
                })
        } else {
            alert("Please fill out all required fields")
        }
    }

    function EditExpenses() {
        let updatedExpenses: Expense[] = [...expenses];
        let updatedExpensesCopy: Expense[] = [...expensesCopy];
        editableExpenses.forEach(expense => {
            api.put(`/api/expenses/${expense._id}`, expense)
                .then(() => {
                    updatedExpenses.forEach((exp, index) => {
                        if (exp._id === expense._id) {
                            updatedExpenses[index] = expense;
                        }
                    });
                    setExpenses(updatedExpenses);

                    updatedExpensesCopy.forEach((exp, index) => {
                        if (exp._id === expense._id) {
                            updatedExpensesCopy[index] = expense;
                        }
                    });
                    setExpensesCopy(updatedExpensesCopy);
                })
                .catch((err) => console.log(err))
        });
        setEditMode(false);
        setEditId(null);
    }

    function closeImport() {
        setShowImport(false);
        setCsvResult(null);
        setImportError('');
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }

    function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.name.toLowerCase().endsWith('.csv')) {
            alert('Please choose a .csv file.');
            e.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            try {
                const result = parseExpenseCsv(String(reader.result || ''));
                const accounts = [...new Set(expensesCopy.map((expense) => expense.account).filter(Boolean))];
                setCsvResult(result);
                setImportAccount(accounts[0] || '');
                setImportCategory('Uncategorized');
                setImportError('');
                setShowImport(true);
            } catch (err) {
                alert(err instanceof Error ? err.message : 'Could not read that CSV file.');
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.onerror = () => {
            alert('Could not read that CSV file.');
            if (fileInputRef.current) fileInputRef.current.value = '';
        };
        reader.readAsText(file);
    }

    function ImportExpenses() {
        if (!csvResult) return;
        const accountRequired = !csvResult.hasAccount && !importAccount.trim();
        if (accountRequired) {
            setImportError('Please enter an account name for these transactions.');
            return;
        }

        const expensesToImport = csvResult.expenses.map((expense) => ({
            date: expense.date,
            account: expense.account || importAccount.trim(),
            vendor: expense.vendor,
            amount: expense.amount,
            category: expense.category || importCategory.trim() || 'Uncategorized',
            notes: expense.notes,
        })).filter((expense) => expense.account);

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
                alert(`Imported ${res.data.count} expense${res.data.count === 1 ? '' : 's'}.`);
            })
            .catch((err) => {
                console.error(err);
                setImporting(false);
                setImportError(err?.response?.data?.message || 'Error importing expenses, please try again.');
            });
    }

    function DeleteExpenses() {
        checkedExps.forEach(expense => {
            api.delete(`/api/expenses/${expense}`)
                .then((res) => {
                    let updatedExpenses: Expense[] = [...expenses];
                    updatedExpenses = updatedExpenses.filter((exp: Expense) => exp._id != res.data._id);
                    setExpenses(updatedExpenses);
                    // console.log(updatedExpenses);

                    let updatedExpensesCopy: Expense[] = [...expensesCopy];
                    updatedExpensesCopy = updatedExpensesCopy.filter((exp: Expense) => exp._id != res.data._id);
                    setExpensesCopy(updatedExpensesCopy);
                })
                .catch((err) => {
                    console.error(err);
                    alert("Error deleting expense(s), please try again.")
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
        // Check if last option is selected, need to create new category
        if (e.target.selectedIndex == e.target.childElementCount - 1) {
            setShowCat(true)
            setCategory(newCategory)
        } else {
            setShowCat(false)
            const selectedOption = e.target.children.item(e.target.selectedIndex);
            if (e.target.value != "" && e.target.value != "1" && selectedOption != null) {
                setCategory(selectedOption.innerHTML)
            }
        }
        setCatSelect(e.target.value);
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

    function handleDbClickEdit(id: string) {
        setEditableExpenses(expenses);
        setEditId(id);
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

    function sortBy(sortByProp: ExpensePart, sort: "down" | "up" = "down") {
        const updatedExpenses = sortExpenseList(expenses, sortByProp, sort);
        setExpenses(updatedExpenses);
        if (editMode) {
            setEditableExpenses(sortExpenseList(editableExpenses, sortByProp, sort));
        }
    }

    function handleGroupBy(mode: ExpensePart) {
        if (mode === "none") {
            setGroupMode("none");
            setExpanded(new Map());
            if (searchByQuery) {
                filterBySearch(searchBySelect, searchByQuery);
            } else {
                setExpenses(expensesCopy.slice((currentPage - 1) * perPage, currentPage * perPage));
            }
            return;
        }

        const source = searchByQuery ? expenses : (expensesCopy.length ? expensesCopy : expenses);
        const sorted = sortExpenseList(source, mode, "down");
        setExpenses(sorted);
        if (editMode) {
            setEditableExpenses(sorted);
        }
        setGroupMode(mode);
        setExpanded(buildExpandedMap(sorted, mode, true));
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

    function filterBySearch(filterBy: string, searchTerm: string) {
        if (searchTerm === "" || searchTerm === null) {
            setExpenses(expensesCopy);
        } else {
            let updatedExpenses: Expense[] = [...expensesCopy];
            if (filterBy === "date") {
                updatedExpenses = updatedExpenses.filter(expense => { return formatDate(expense.date).toLowerCase().includes(searchTerm.toLowerCase()) });
            } else if (filterBy === "account") {
                updatedExpenses = updatedExpenses.filter(expense => { return expense.account.toLowerCase().includes(searchTerm.toLowerCase()) });
            } else if (filterBy === "vendor") {
                updatedExpenses = updatedExpenses.filter(expense => { return expense.vendor.toLowerCase().includes(searchTerm.toLowerCase()) });
            } else if (filterBy === "category") {
                updatedExpenses = updatedExpenses.filter(expense => { return expense.category.toLowerCase().includes(searchTerm.toLowerCase()) });
            } else if (filterBy === "amount") {
                updatedExpenses = updatedExpenses.filter(expense => { return expense.amount.toString().includes(searchTerm) });
            } else if (filterBy === "notes") {
                updatedExpenses = updatedExpenses.filter(expense => { return expense.notes.toLowerCase().includes(searchTerm.toLowerCase()) });
            }
            setExpenses(updatedExpenses); //don't update copy to keep original data
        }
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
                />
            );
        }

        return (
            <ExpenseRow
                key={`row-${expense._id}`}
                expense={expense}
                checkedExps={checkedExps}
                handleCheck={handleCheck}
                handleDbClickEdit={handleDbClickEdit}
                bg={bg}
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
            return (
                <React.Fragment key={`group-${group.key}-${index}`}>
                    <TableRow className="cursor-pointer" onClick={() => toggleGroup(group.key)}>
                        <TableCell className={`${bg ? "bg-muted/40" : ""} font-semibold`} colSpan={7}>
                            {group.key || "(Blank)"}{" "}
                            <span className="font-normal text-muted-foreground">({countLabel})</span>{" "}
                            {isOpen ? <ChevronUp className="inline h-4 w-4" /> : <ChevronRight className="inline h-4 w-4" />}
                        </TableCell>
                    </TableRow>
                    {isOpen ? group.items.map((expense) => renderExpenseRow(expense, bg)) : null}
                </React.Fragment>
            );
        });
    }

    const selectClassName = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

    return (
        <div className="min-h-screen bg-background pb-20">
            <Header />
            <main className="space-y-6 px-8 py-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <h1 className="text-4xl font-semibold tracking-tight">Expenses</h1>
                    <div className="flex flex-wrap items-center gap-2">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv,text/csv"
                            className="hidden"
                            onChange={handleCsvFile}
                        />
                        <Button type="button" onClick={handleShow}>Add</Button>
                        <Button variant="outline" onClick={() => setShowImport(true)}>Import</Button>
                        {editMode || editId != null ? (
                            <>
                                <Button variant="outline" onClick={EditExpenses}>Save</Button>
                                <Button variant="outline" onClick={() => { setEditMode(false); setEditId(null); setEditableExpenses(expenses); }}>Cancel</Button>
                            </>
                        ) : (
                            <Button variant="outline" onClick={() => { setEditMode(true); setEditableExpenses(expenses); }}>Edit</Button>
                        )}
                        <Button variant="destructive" onClick={DeleteExpenses}>Delete</Button>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-muted-foreground">Group By:</span>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline">
                                    {groupMode[0].toUpperCase() + groupMode.slice(1)}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuItem onClick={() => handleGroupBy("none")}>None</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleGroupBy("date")}>Date</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleGroupBy("account")}>Account</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleGroupBy("vendor")}>Vendor</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleGroupBy("amount")}>Amount</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleGroupBy("category")}>Category</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
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
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline">
                                    {searchBySelect[0].toUpperCase() + searchBySelect.slice(1)}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuItem onClick={() => { setSearchBySelect("date"); filterBySearch("date", searchByQuery) }}>Date</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setSearchBySelect("account"); filterBySearch("account", searchByQuery) }}>Account</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setSearchBySelect("vendor"); filterBySearch("vendor", searchByQuery) }}>Vendor</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setSearchBySelect("amount"); filterBySearch("amount", searchByQuery) }}>Amount</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setSearchBySelect("category"); filterBySearch("category", searchByQuery) }}>Category</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setSearchBySelect("notes"); filterBySearch("notes", searchByQuery) }}>Notes</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                <div className="rounded-xl border bg-card">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-10 text-center">
                                    <Checkbox
                                        checked={expenses.length > 0 && checkedExps.length === expenses.length}
                                        onCheckedChange={(checked) => handleCheckAll(checked === true)}
                                    />
                                </TableHead>
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
                                <TableHead>
                                    <button className="inline-flex items-center gap-1" type="button" onClick={() => { sortBy("category", sortCategory); setSortCategory(sortCategory === "down" ? "up" : "down") }}>
                                        {sortCategory === "down" ? <ArrowUpAZ className="h-4 w-4" /> : <ArrowDownAZ className="h-4 w-4" />}Category
                                    </button>
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
                </div>

                {groupMode === "none" &&
                    <ExpensePagination
                        currentPage={currentPage}
                        perPage={perPage}
                        setCurrentPage={setCurrentPage}
                        totalExpenses={expensesCopy.length}
                        getExpenses={getExpenses} />
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
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVendor(e.target.value)}
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
                                <select required className={selectClassName} id="category" onChange={handleCategory} value={catSelect}>
                                    <option value="">Select or Add a Category</option>
                                    {[...new Set(expenses?.map((expense: Expense) => expense.category))].map((category: string) => (
                                        <option key={category} value={category}>{category}</option>
                                    ))}
                                    <option value="-1">*New Category*</option>
                                </select>
                            </div>
                            {showCat &&
                                <Input
                                    required
                                    type="text"
                                    value={newCategory}
                                    aria-label="newCategory"
                                    placeholder="New category name"
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setCategory(e.target.value); setNewCategory(e.target.value) }}
                                />
                            }
                            <div className="space-y-2">
                                <Label htmlFor="notes">Notes</Label>
                                <Textarea
                                    id="notes"
                                    value={notes}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={handleClose}>Close</Button>
                            <Button type="submit">Add</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={showImport} onOpenChange={(open) => { if (!open) closeImport(); }}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Import CSV</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        {!csvResult &&
                            <FileUpload
                                acceptedFileTypes={[".csv", "text/csv"]}
                                uploadDelay={0}
                                onUploadSuccess={(file) => {
                                    const reader = new FileReader();
                                    reader.onload = () => {
                                        try {
                                            const result = parseExpenseCsv(String(reader.result || ""));
                                            const accounts = [...new Set(expensesCopy.map((expense) => expense.account).filter(Boolean))];
                                            setCsvResult(result);
                                            setImportAccount(accounts[0] || "");
                                            setImportCategory("Uncategorized");
                                            setImportError("");
                                        } catch (err) {
                                            alert(err instanceof Error ? err.message : "Could not read that CSV file.");
                                        }
                                    };
                                    reader.readAsText(file);
                                }}
                            />
                        }
                        {csvResult &&
                            <>
                                <p className="text-sm text-muted-foreground">
                                    Found {csvResult.expenses.length} expense{csvResult.expenses.length === 1 ? "" : "s"}
                                    {csvResult.skipped > 0 ? ` (${csvResult.skipped} row${csvResult.skipped === 1 ? "" : "s"} skipped)` : ""}.
                                </p>
                                {!csvResult.hasAccount &&
                                    <div className="space-y-2">
                                        <Label htmlFor="importAccount">Account</Label>
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
                                {!csvResult.hasCategory &&
                                    <div className="space-y-2">
                                        <Label htmlFor="importCategory">Category</Label>
                                        <Input
                                            id="importCategory"
                                            type="text"
                                            value={importCategory}
                                            onChange={(e) => setImportCategory(e.target.value)}
                                        />
                                    </div>
                                }
                                <div className="max-h-80 overflow-auto rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Date</TableHead>
                                                <TableHead>Account</TableHead>
                                                <TableHead>Vendor</TableHead>
                                                <TableHead>Amount</TableHead>
                                                <TableHead>Category</TableHead>
                                                <TableHead>Notes</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {csvResult.expenses.slice(0, 8).map((expense, index) => (
                                                <TableRow key={`preview-${index}`}>
                                                    <TableCell>{formatDate(expense.date)}</TableCell>
                                                    <TableCell>{expense.account || importAccount || "—"}</TableCell>
                                                    <TableCell>{expense.vendor}</TableCell>
                                                    <TableCell>{expense.amount}</TableCell>
                                                    <TableCell>{expense.category || importCategory || "—"}</TableCell>
                                                    <TableCell>{expense.notes || ""}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                                {csvResult.expenses.length > 8 &&
                                    <p className="text-sm text-muted-foreground">Showing the first 8 of {csvResult.expenses.length} rows.</p>
                                }
                                {importError && <p className="text-sm text-destructive">{importError}</p>}
                            </>
                        }
                    </div>
                    <DialogFooter>
                        <Button variant="outline" disabled={importing} onClick={closeImport}>Cancel</Button>
                        {csvResult &&
                            <Button disabled={importing} type="button" onClick={ImportExpenses}>
                                {importing ? "Importing..." : "Import"}
                            </Button>
                        }
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
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
    bg: boolean
}

function ExpenseEditableRow({ expense, checkedExps, handleCheck, editDate, editAccount, editVendor, editAmount, editCategory, editNotes, bg }: EditableExpenseRowProps) {
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
            <TableCell><Input className="h-8" type="text" value={expense.category} onChange={(e) => { editCategory(expense, e.target.value) }} /></TableCell>
            <TableCell><Input className="h-8" type="text" value={expense.notes ? expense.notes : ""} onChange={(e) => { editNotes(expense, e.target.value) }} /></TableCell>
        </TableRow>
    )
}

interface ExpenseRowProps {
    expense: Expense,
    checkedExps: string[],
    handleCheck: (id: string, checked: boolean) => void,
    handleDbClickEdit: (id: string) => void,
    bg: boolean
}

function ExpenseRow({ expense, checkedExps, handleCheck, handleDbClickEdit, bg }: ExpenseRowProps) {
    const bgClr = bg ? "bg-muted/40" : "";
    return (
        <TableRow className={bgClr} onDoubleClick={() => { handleDbClickEdit(expense._id) }}>
            <TableCell>
                <Checkbox
                    checked={checkedExps.includes(expense._id.toString())}
                    onCheckedChange={(checked) => handleCheck(expense._id.toString(), checked === true)}
                />
            </TableCell>
            <TableCell>{formatDate(expense.date)}</TableCell>
            <TableCell>{expense.account}</TableCell>
            <TableCell>{expense.vendor}</TableCell>
            <TableCell>{expense.amount}</TableCell>
            <TableCell>{expense.category}</TableCell>
            <TableCell>{expense.notes ? expense.notes : ""}</TableCell>
        </TableRow>
    )
}

interface ExpensePaginationProps {
    currentPage: number,
    setCurrentPage: (page: number) => void,
    perPage: number,
    totalExpenses: number,
    getExpenses: (sort?: boolean, page?: number) => void
}

function ExpensePagination({ currentPage, setCurrentPage, perPage, totalExpenses, getExpenses }: ExpensePaginationProps) {
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
            <Button disabled={currentPage === 1} size="icon-sm" variant="ghost" onClick={() => { setCurrentPage(1); getExpenses(true, 1) }}>
                <ChevronsLeft />
            </Button>
            <Button disabled={currentPage === 1} size="icon-sm" variant="ghost" onClick={() => { setCurrentPage(currentPage - 1); getExpenses(true, currentPage - 1) }}>
                <ChevronLeft />
            </Button>
            {pageNumbers.map((number, index) => (
                <React.Fragment key={number}>
                    {index > 0 && number - pageNumbers[index - 1] > 1 && <span className="px-1 text-muted-foreground">…</span>}
                    <Button
                        size="icon-sm"
                        variant={number === currentPage ? "default" : "ghost"}
                        onClick={() => { setCurrentPage(number); getExpenses(true, number) }}
                    >
                        {number}
                    </Button>
                </React.Fragment>
            ))}
            <Button disabled={currentPage === totalPages} size="icon-sm" variant="ghost" onClick={() => { setCurrentPage(currentPage + 1); getExpenses(true, currentPage + 1) }}>
                <ChevronRight />
            </Button>
            <Button disabled={currentPage === totalPages} size="icon-sm" variant="ghost" onClick={() => { setCurrentPage(totalPages); getExpenses(true, totalPages) }}>
                <ChevronsRight />
            </Button>
        </div>
    );
}

export default Expenses



