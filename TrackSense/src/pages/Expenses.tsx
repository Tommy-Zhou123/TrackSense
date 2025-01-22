import axios from 'axios'
import React, { useState, useEffect } from 'react'
import { Header } from './Home';
import Dropdown from 'react-bootstrap/Dropdown';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Stack from 'react-bootstrap/Stack';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import InputGroup from 'react-bootstrap/InputGroup';
import Table from 'react-bootstrap/Table';
import { FormControlProps, Modal } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';

import { SortAlphaDown, SortNumericDown, SortDown, SortUp, SortAlphaUp, SortNumericUp, Search, ChevronRight, ChevronUp, ChevronDown } from 'react-bootstrap-icons';

const API_URL: string = import.meta.env.VITE_API_URL

interface Expense {
    _id: number,
    date: Date,
    account: string,
    vendor: string,
    category: string,
    amount: number,
    notes: string,
}

type ExpensePart = "none" | "date" | "account" | "vendor" | "amount" | "category" | "notes";



let groupCounter: number = 1;

let expenseParts: ExpensePart[] = ["none", "date", "account", "vendor", "amount", "category", "notes"];


const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
};


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
    const [editId, setEditId] = useState(-1);

    const [date, setDate] = useState<Date>(new Date());
    const [account, setAccount] = useState('');
    const [vendor, setVendor] = useState('');
    const [amount, setAmount] = useState(0);
    const [category, setCategory] = useState('');
    const [notes, setNotes] = useState('');

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

    let prevGroup = "";
    let lightBg = true;

    const handleClose = () => setShowForm(false);
    const handleShow = () => setShowForm(true);

    useEffect(() => {
        getExpenses()
        lightBg = false;
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

    function getExpenses(sort: boolean = true) {
        axios.get(`${API_URL}/api/expenses`)
            .then((response) => {
                const expensesWithDates = response.data.expenses.map((expense: any) => ({
                    ...expense,
                    date: new Date(expense.date)
                }));
                if (sort) expensesWithDates.sort(function (a: Expense, b: Expense) { return a.date.getTime() - b.date.getTime() });
                setExpenses(expensesWithDates);
                setExpensesCopy(expensesWithDates);
            })
            .catch((err) => {
                let expensesWithDates = [{ _id: 0, date: new Date(), account: "Account", vendor: "Vendor", amount: 0, category: "Category", notes: "Notes" }];
                if (sort) expensesWithDates.sort(function (a: Expense, b: Expense) { return a.date.getTime() - b.date.getTime() });
                setExpenses(expensesWithDates);
                setExpensesCopy(expensesWithDates);
                console.log(err);
                alert("Error retrieving expense data, please refresh.")
            })
    }

    function AddExpense(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        if (date != null && account != null && vendor != null && amount != null && category != null) {
            const data = {
                date, account, vendor, amount, category, notes
            }
            axios.post(`${API_URL}/api/expenses/add`, data)
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
                    console.log(err);
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
            axios.put(`${API_URL}/api/expenses/${expense._id}`, expense)
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
        setEditId(-1);
    }

    function DeleteExpenses() {
        checkedExps.forEach(expense => {
            axios.delete(`${API_URL}/api/expenses/${expense}`)
                .then((res) => {
                    let updatedExpenses: Expense[] = [...expenses];
                    updatedExpenses = updatedExpenses.filter((exp: Expense) => exp._id != res.data._id);
                    setExpenses(updatedExpenses);
                    console.log(updatedExpenses);

                    let updatedExpensesCopy: Expense[] = [...expensesCopy];
                    updatedExpensesCopy = updatedExpensesCopy.filter((exp: Expense) => exp._id != res.data._id);
                    setExpensesCopy(updatedExpensesCopy);
                })
                .catch((err) => {
                    console.log(err);
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

    function handleCheck(e: React.ChangeEvent<HTMLInputElement>) {
        const { id, checked } = e.target;
        if (checked) {
            setCheckedExps([...checkedExps, id])
        } else {
            setCheckedExps(checkedExps.filter((ID) => ID != id))
        }
    }

    function handleCheckAll(e: React.ChangeEvent<HTMLInputElement>) {
        const { checked } = e.target;
        if (checked) {
            setCheckedExps(expenses.map((expense) => expense._id.toString()))
            // setCheckedExps(["123"]) // TODO: REMOVE, ONLY FOR TESTING PURPOSES
        } else {
            setCheckedExps([])
        }
    }

    function handleDbClickEdit(id: number) {
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
        let updatedExpenses: Expense[] = [...expenses];
        if (sortByProp === "date") {
            if (sort === "down")
                updatedExpenses.sort(function (a, b) { return a.date.getTime() - b.date.getTime() });
            else
                updatedExpenses.sort(function (a, b) { return b.date.getTime() - a.date.getTime() });
        } else if (sortByProp === "account" || sortByProp === "vendor" || sortByProp === "category" || sortByProp === "notes") {
            if (sort === "down")
                updatedExpenses.sort(function (a, b) { return a.account.localeCompare(b.account) });
            else
                updatedExpenses.sort(function (a, b) { return b.account.localeCompare(a.account) });
        } else if (sortByProp === "amount") {
            if (sort === "down")
                updatedExpenses.sort(function (a, b) { return a.amount - b.amount });
            else
                updatedExpenses.sort(function (a, b) { return b.amount - a.amount });
        }

        setExpenses(updatedExpenses);
        setExpensesCopy(updatedExpenses);
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

    function populateExpanded(): void {
        let uniqueExps: Expense[] = [... new Set(expenses)];
        let expMap: Map<string, boolean> = new Map();
        uniqueExps.forEach(exp => {
            expMap.set(exp._id.toString(), true);
        });
        setExpanded(expMap);
    }

    function updateExpanded(id: number): void {
        let expandedCopy = new Map(expanded);
        if (id === 1) {
            expandedCopy.forEach((value, key) => {
                expandedCopy.set(key, true);
            });
        } else if (id === -1) {
            expandedCopy.forEach((value, key) => {
                expandedCopy.set(key, false);
            });
        } else {
            expandedCopy.set(id.toString(), !expanded.get(id.toString()));
        }
        setExpanded(expandedCopy);
    }

    return (
        <>
            <Header />
            <Container fluid className="mt-4 px-5">
                <Row className='align-items-center'>
                    <Col className="fs-1" >
                        <div>Expenses</div>
                    </Col>
                    <Col className='d-flex flex-nowrap justify-content-end'>
                        <Button className="me-2" onClick={handleShow} variant="outline-dark">Add</Button>
                        <Button variant="outline-dark me-2">Import</Button>
                        <Button className={editMode || editId != -1 ? "d-none" : ""} variant="outline-dark me-2" onClick={() => { setEditMode(true); setEditableExpenses(expenses); }}>Edit</Button>
                        <Button className={editMode || editId != -1 ? "" : "d-none"} variant="outline-dark me-2" onClick={EditExpenses}>Save</Button>
                        <Button className={editMode || editId != -1 ? "" : "d-none"} variant="outline-dark me-2" onClick={() => { setEditMode(false); setEditId(-1); setEditableExpenses(expenses); }}>Cancel</Button>
                        <Button variant="outline-dark" onClick={DeleteExpenses}>Delete</Button>
                    </Col>
                </Row>
                <Row className='align-items-center mt-3 mb-4'>
                    <Col>
                        <Stack direction="horizontal">
                            <div className="me-2">Group By:</div>
                            <Dropdown className="me-3" data-bs-theme="light">
                                <Dropdown.Toggle id="groupBy" variant="outline-dark">
                                    {groupMode[0].toUpperCase() + groupMode.slice(1)}
                                </Dropdown.Toggle>
                                <Dropdown.Menu>
                                    <Dropdown.Item onClick={() => { getExpenses(); setGroupMode("none"); setExpanded(new Map) }}>None</Dropdown.Item>
                                    <Dropdown.Item onClick={() => { sortBy("date"); setGroupMode("date"); populateExpanded(); }}>Date</Dropdown.Item>
                                    <Dropdown.Item onClick={() => { sortBy("account"); setGroupMode("account"); populateExpanded(); }}>Account</Dropdown.Item>
                                    <Dropdown.Item onClick={() => { sortBy("vendor"); setGroupMode("vendor"); populateExpanded(); }}>Vendor</Dropdown.Item>
                                    <Dropdown.Item onClick={() => { sortBy("amount"); setGroupMode("amount"); populateExpanded(); }}>Amount</Dropdown.Item>
                                    <Dropdown.Item onClick={() => { sortBy("category"); setGroupMode("category"); populateExpanded(); }}>Category</Dropdown.Item>
                                </Dropdown.Menu>
                            </Dropdown>
                            {groupMode !== "none" ?
                                <>
                                    <Button className="me-2" variant="outline-dark" onClick={() => { updateExpanded(1) }}>Expand All</Button>
                                    <Button variant="outline-dark" onClick={() => { updateExpanded(-1) }}>Collapse All</Button>
                                </>
                                : ""
                            }

                        </Stack>
                    </Col >
                    <Col className='ms-auto my-auto text-end'>
                        <InputGroup>
                            <InputGroup.Text id="searchIcon"><Search /></InputGroup.Text>
                            <Form.Control
                                placeholder="Search"
                                aria-label="Search"
                                aria-describedby="searchIcon"
                                onChange={(e) => { setSearchByQuery(e.target.value); filterBySearch(searchBySelect, e.target.value) }}
                            />
                            <Dropdown data-bs-theme="light">
                                <Dropdown.Toggle id="searchBy" variant="outline-secondary">
                                    {searchBySelect[0].toUpperCase() + searchBySelect.slice(1)}
                                </Dropdown.Toggle>
                                <Dropdown.Menu>
                                    <Dropdown.Item onClick={() => { setSearchBySelect("date"); filterBySearch("date", searchByQuery) }}>Date</Dropdown.Item>
                                    <Dropdown.Item onClick={() => { setSearchBySelect("account"); filterBySearch("account", searchByQuery) }}>Account</Dropdown.Item>
                                    <Dropdown.Item onClick={() => { setSearchBySelect("vendor"); filterBySearch("vendor", searchByQuery) }}>Vendor</Dropdown.Item>
                                    <Dropdown.Item onClick={() => { setSearchBySelect("amount"); filterBySearch("amount", searchByQuery) }}>Amount</Dropdown.Item>
                                    <Dropdown.Item onClick={() => { setSearchBySelect("category"); filterBySearch("category", searchByQuery) }}>Category</Dropdown.Item>
                                    <Dropdown.Item onClick={() => { setSearchBySelect("notes"); filterBySearch("notes", searchByQuery) }}>Notes</Dropdown.Item>
                                </Dropdown.Menu>
                            </Dropdown>
                        </InputGroup>
                    </Col>
                </Row>
                <Row>
                    <Form>
                        <Table bordered hover>
                            <thead>
                                <tr>
                                    <th className='text-center bg-light'><Form.Check onChange={handleCheckAll} /></th>
                                    <th className='bg-light'>{sortDate == "down" ? <SortUp onClick={() => { sortBy("date", sortDate); setSortDate("up") }} /> : <SortDown onClick={() => { sortBy("date", sortDate); setSortDate("down") }} />}Date</th>
                                    <th className='bg-light'>{sortAccount == "down" ? <SortAlphaUp onClick={() => { sortBy("account", sortAccount); setSortAccount("up") }} /> : <SortAlphaDown onClick={() => { sortBy("account", sortAccount); setSortAccount("down") }} />}Account</th>
                                    <th className='bg-light'>{sortVendor == "down" ? <SortAlphaUp onClick={() => { sortBy("vendor", sortVendor); setSortVendor("up") }} /> : <SortAlphaDown onClick={() => { sortBy("vendor", sortVendor); setSortVendor("down") }} />}Vendor</th>
                                    <th className='bg-light'>{sortAmount == "down" ? <SortAlphaUp onClick={() => { sortBy("amount", sortAmount); setSortAmount("up") }} /> : <SortAlphaDown onClick={() => { sortBy("amount", sortAmount); setSortAmount("down") }} />}Amount</th>
                                    <th className='bg-light'>{sortCategory == "down" ? <SortNumericUp onClick={() => { sortBy("category", sortCategory); setSortCategory("up") }} /> : <SortNumericDown onClick={() => { sortBy("category", sortCategory); setSortCategory("down") }} />}Category</th>
                                    <th className='bg-light'>{sortNotes == "down" ? <SortAlphaUp onClick={() => { sortBy("notes", sortNotes); setSortNotes("up") }} /> : <SortAlphaDown onClick={() => { sortBy("notes", sortNotes); setSortNotes("down") }} />}Notes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {
                                    editMode ? (
                                        editableExpenses?.map((expense: Expense, index) => {
                                            if (groupMode === "none") lightBg = false;

                                            const generateGroupRow = (label: string) => (
                                                <React.Fragment key={`group-${label}-${index}`}>
                                                    <tr>
                                                        <td onClick={() => { updateExpanded(expense._id) }} className={lightBg ? "bg-light" : ""} colSpan={7}>
                                                            {label}&nbsp;
                                                            {expanded.get(expense._id.toString()) ? <ChevronUp /> : <ChevronDown />}
                                                        </td>
                                                    </tr>
                                                    {expanded.get(expense._id.toString()) ? renderRow() : ""}
                                                </React.Fragment>
                                            );

                                            const renderGroup = (currentGroup: string) => {
                                                if (prevGroup !== currentGroup) {
                                                    prevGroup = currentGroup;
                                                    lightBg = !lightBg;
                                                    return true;
                                                }
                                                return false;
                                            };

                                            const renderRow = () => (
                                                <ExpenseEditableRow
                                                    key={`editable-${expense._id}`}
                                                    expense={expense}
                                                    checkedExps={checkedExps}
                                                    handleCheck={handleCheck}
                                                    bg={lightBg}
                                                    editDate={editDate}
                                                    editAccount={editAccount}
                                                    editVendor={editVendor}
                                                    editAmount={editAmount}
                                                    editCategory={editCategory}
                                                    editNotes={editNotes}
                                                />
                                            );

                                            if (groupMode === "date" && renderGroup(formatDate(expense.date))) {
                                                return generateGroupRow(formatDate(expense.date));
                                            } else if (groupMode === "account" && renderGroup(expense.account)) {
                                                return generateGroupRow(expense.account);
                                            } else if (groupMode === "vendor" && renderGroup(expense.vendor)) {
                                                return generateGroupRow(expense.vendor);
                                            } else if (groupMode === "amount" && renderGroup(expense.amount.toString())) {
                                                return generateGroupRow(expense.amount.toString());
                                            } else if (groupMode === "category" && renderGroup(expense.category)) {
                                                return generateGroupRow(expense.category);
                                            } else {
                                                return renderRow();
                                            }
                                        })
                                    ) : (
                                        expenses?.map((expense: Expense, index) => {
                                            let exp: undefined | Expense;
                                            if (groupMode === "none") lightBg = false;

                                            if (editId === expense._id) {
                                                exp = editableExpenses.find(e => e._id === expense._id);
                                            }

                                            const renderRow = () => (
                                                exp && editId === expense._id ? (
                                                    <ExpenseEditableRow
                                                        key={`editable-${exp._id}`}
                                                        expense={exp}
                                                        checkedExps={checkedExps}
                                                        handleCheck={handleCheck}
                                                        bg={lightBg}
                                                        editDate={editDate}
                                                        editAccount={editAccount}
                                                        editVendor={editVendor}
                                                        editAmount={editAmount}
                                                        editCategory={editCategory}
                                                        editNotes={editNotes}
                                                    />
                                                ) : (
                                                    <ExpenseRow
                                                        key={`row-${expense._id}`}
                                                        expense={expense}
                                                        checkedExps={checkedExps}
                                                        handleCheck={handleCheck}
                                                        handleDbClickEdit={handleDbClickEdit}
                                                        bg={lightBg}
                                                    />
                                                )
                                            );

                                            const generateGroupRow = (label: string) => (
                                                <React.Fragment key={`group-${label}-${index}`}>
                                                    <tr>
                                                        <td onClick={() => { updateExpanded(expense._id) }} className={lightBg ? "bg-light" : ""} colSpan={7}>
                                                            {label}&nbsp;
                                                            {expanded.get(expense._id.toString()) ? <ChevronUp /> : <ChevronDown />}
                                                        </td>
                                                    </tr>
                                                    {expanded.get(expense._id.toString()) ? renderRow() : ""}
                                                </React.Fragment>
                                            );

                                            const renderGroup = (currentGroup: string) => {
                                                if (prevGroup !== currentGroup) {
                                                    prevGroup = currentGroup;
                                                    lightBg = !lightBg;
                                                    return true;
                                                }
                                                return false;
                                            };

                                            if (groupMode === "date" && renderGroup(formatDate(expense.date))) {
                                                return generateGroupRow(formatDate(expense.date));
                                            } else if (groupMode === "account" && renderGroup(expense.account)) {
                                                return generateGroupRow(expense.account);
                                            } else if (groupMode === "vendor" && renderGroup(expense.vendor)) {
                                                return generateGroupRow(expense.vendor);
                                            } else if (groupMode === "amount" && renderGroup(expense.amount.toString())) {
                                                return generateGroupRow(expense.amount.toString());
                                            } else if (groupMode === "category" && renderGroup(expense.category)) {
                                                return generateGroupRow(expense.category);
                                            } else {
                                                return renderRow();
                                            }
                                        })
                                    )
                                }
                            </tbody >
                        </Table>
                    </Form>
                </Row>
            </Container >

            {/* Add Expense Form */}
            < Modal show={showForm} onHide={handleClose} centered >
                <Form onSubmit={AddExpense}>
                    <Modal.Header closeButton>
                        <Modal.Title>Add An Expense</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <InputGroup className="mb-3">
                            <InputGroup.Text id="date">Date</InputGroup.Text>
                            <Form.Control
                                required
                                value={formatDate(date)}
                                type="date"
                                aria-label="date"
                                aria-describedby="date"
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDate(new Date(Date.parse(e.target.value)))}
                            />
                        </InputGroup>
                        <Form.Select required onChange={handleAccount} value={accSelect}
                            aria-label="Default select example" className="mb-3">
                            <option value="">Select or Add an Account</option>
                            {[...new Set(expenses?.map((expense: Expense) => expense.account))].map((account: string) => (
                                <option key={account} value={accCounter++} > {account}</option>
                            ))}
                            <option value="-1">New Account</option>
                        </Form.Select>
                        <InputGroup className={showAcc ? "mb-3" : "mb-3 d-none"}>
                            <InputGroup.Text id="account">Account</InputGroup.Text>
                            <Form.Control
                                required={showAcc}
                                type="text"
                                value={newAccount}
                                aria-label="newAccount"
                                aria-describedby="newAccount"
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setAccount(e.target.value); setNewAccount(e.target.value) }}
                            />
                        </InputGroup>
                        <InputGroup className="mb-3">
                            <InputGroup.Text id="vendor">Vendor</InputGroup.Text>
                            <Form.Control
                                required
                                type="text"
                                value={vendor}
                                aria-label="vendor"
                                aria-describedby="vendor"
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVendor(e.target.value)}
                            />
                        </InputGroup>
                        <InputGroup className="mb-3">
                            <InputGroup.Text id="amount">Amount</InputGroup.Text>
                            <Form.Control
                                required
                                type="number"
                                value={amount != 0 ? amount : ""}
                                aria-label="amount"
                                aria-describedby="amount"
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(Number(e.target.value))}
                            />
                        </InputGroup>
                        <Form.Select required onChange={handleCategory} value={catSelect}
                            aria-label="Default select example" className="mb-3">
                            <option value="">Select or Add a Category</option>
                            {[...new Set(expenses?.map((expense: Expense) => expense.category))].map((category: string) => (
                                <option key={category} value={category}>{category}</option>
                            ))}
                            <option value="-1">*New Category*</option>
                        </Form.Select>
                        <InputGroup className={showCat ? "mb-3" : "mb-3 d-none"}>
                            <InputGroup.Text id="category">Category</InputGroup.Text>
                            <Form.Control
                                required={showCat}
                                type="text"
                                value={newCategory}
                                aria-label="newCategory"
                                aria-describedby="newCategory"
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setCategory(e.target.value); setNewCategory(e.target.value) }}
                            />
                        </InputGroup>
                        <InputGroup className="mb-3">
                            <InputGroup.Text>Notes</InputGroup.Text>
                            <Form.Control as="textarea" aria-label="textarea"
                                value={notes}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNotes(e.target.value)}
                            />
                        </InputGroup>
                    </Modal.Body >
                    <Modal.Footer>
                        <Button variant="outline-dark" onClick={handleClose}>
                            Close
                        </Button>
                        <Button variant="dark" type="submit">
                            Add
                        </Button>
                    </Modal.Footer>
                </Form>
            </Modal >
        </>
    )
}


// editable expense table row component
function ExpenseEditableRow({ expense, checkedExps, handleCheck, editDate, editAccount, editVendor, editAmount, editCategory, editNotes, bg }: any) {
    let bgClr = bg ? "bg-light" : "";
    return (<tr key={expense._id.toString()}>
        <td className={bgClr}><Form.Check checked={checkedExps.includes(expense._id.toString())} id={expense._id.toString()} className='text-center' onChange={handleCheck} /></td>
        <td className={bgClr}><Form.Control type="date" size="sm" value={formatDate(expense.date)} onChange={(e) => { editDate(expense, e.target.value) }} /></td>
        <td className={bgClr}><Form.Control type="text" size="sm" value={expense.account} onChange={(e) => { editAccount(expense, e.target.value) }} /></td>
        <td className={bgClr}><Form.Control type="text" size="sm" value={expense.vendor} onChange={(e) => { editVendor(expense, e.target.value) }} /></td>
        <td className={bgClr}><Form.Control type="number" size="sm" value={expense.amount} onChange={(e) => { editAmount(expense, Number(e.target.value)) }} /></td>
        <td className={bgClr}><Form.Control type="text" size="sm" value={expense.category} onChange={(e) => { editCategory(expense, e.target.value) }} /></td>
        <td className={bgClr}><Form.Control type="text" size="sm" value={expense.notes ? expense.notes : ""} onChange={(e) => { editNotes(expense, e.target.value) }} /></td>
    </tr>)
}

function ExpenseRow({ expense, checkedExps, handleCheck, handleDbClickEdit, bg }: any) {
    let bgClr = bg ? "bg-light" : "";
    return (<tr key={expense._id.toString()} onDoubleClick={() => { handleDbClickEdit(expense._id) }} >
        <td className={bgClr}><Form.Check checked={checkedExps.includes(expense._id.toString())} id={expense._id.toString()} className='text-center' onChange={handleCheck} /></td>
        <td className={bgClr}>{formatDate(expense.date)}</td>
        <td className={bgClr}>{expense.account}</td>
        <td className={bgClr}>{expense.vendor}</td>
        <td className={bgClr}>{expense.amount}</td>
        <td className={bgClr}>{expense.category}</td>
        <td className={bgClr}>{expense.notes ? expense.notes : ""}</td>
    </tr>)
}

export default Expenses



