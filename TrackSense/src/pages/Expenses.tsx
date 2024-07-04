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
import { Modal } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';


interface Expense {
    _id: string
    date: string, //TODO: CHANGE to DATE type
    account: string,
    vendor: string,
    category: string,
    amount: number,
    notes: string,
}

let catCounter = 1;

const generateCatID = () => {
    return `${catCounter++}`;
}

const Expenses = () => {
    let accCounter = 1;
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [checkedExps, setCheckedExps] = useState<string[]>([]);

    const [accSelect, setAccSelect] = useState('');
    const [newAccount, setNewAccount] = useState('');

    const [catSelect, setCatSelect] = useState('');
    const [newCategory, setNewCategory] = useState('');

    const [showForm, setShowForm] = useState(false);
    const [showCat, setShowCat] = useState(false);
    const [showAcc, setShowAcc] = useState(false);

    const [editMode, setEditMode] = useState(false);

    const [date, setDate] = useState('');
    const [account, setAccount] = useState('');
    const [vendor, setVendor] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('');
    const [notes, setNotes] = useState('');

    const [editedExpenses, setEditedxpenses] = useState<Expense[]>([])

    const handleClose = () => setShowForm(false);
    const handleShow = () => setShowForm(true);

    useEffect(() => {
        getExpenses()
    }, [expenses]) //TODO: CHECK IF THIS IS CORRECT

    function clearFormValues() {
        setDate('');
        setAccount('');
        setVendor('');
        setAmount('');
        setCategory('');
        setNotes('');
        setNewAccount('');
        setNewCategory('');
        setAccSelect('');
        setCatSelect('');
    }

    function getExpenses() {
        axios.get('http://localhost:3000/expenses')
            .then((response) => {
                setExpenses(response.data.expenses)
            })
            .catch((err) => {
                console.log(err);
                alert("Error retrieving expense data, please refresh.")
            })
    }

    function AddExpense(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        const data = {
            date, account, vendor, amount, category, notes
        }
        if (date != null && account != null && vendor != null && amount != null && category != null) {
            alert("Please fill out all required fields")
            axios.post('http://localhost:3000/expenses/add', data)
                .then(() => {
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
        const data = {
            date, account, vendor, amount, category, notes
        }
        checkedExps.forEach(expense => {
            // axios.put(`http://localhost:3000/expenses/${???}`, data) TO DO!!
            //     .then(() => {
            //     })
            //     .catch((err) => console.log(err))
        });
    }

    function DeleteExpenses() {
        checkedExps.forEach(expense => {
            axios.delete(`http://localhost:3000/expenses/${expense} `)
                .then(() => {
                    getExpenses()
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
        // Check if last option is selected, need to creat new category
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
            setCheckedExps(expenses.map((expense) => expense._id))
            // setCheckedExps(["123"]) // TODO: REMOVE, ONLY FOR TESTING PURPOSES
        } else {
            setCheckedExps([])
        }
    }

    function handleDateChange(e: React.ChangeEvent<HTMLInputElement>) {
        setDate(e.target.value)
        setExpenses([...expenses, { ...expense, date }]);
    }

    return (
        <>
            <Header />
            <Container fluid className="mt-4 px-5">
                <Row className='align-items-center'>
                    <Col className="fs-1" >
                        <div>Expenses</div>
                    </Col>
                    <Col className='ms-auto text-end'>
                        <Button className="me-2" onClick={handleShow} variant="outline-dark">Add</Button>
                        <Button variant="outline-dark me-2">Import</Button>
                        <Button className={editMode ? "d-none" : ""} variant="outline-dark me-2" onClick={() => { setEditMode(true) }}>Edit</Button>
                        <Button className={editMode ? "" : "d-none"} variant="outline-dark me-2" onClick={EditExpenses}>Save</Button>
                        <Button className={editMode ? "" : "d-none"} variant="outline-dark me-2" onClick={() => { setEditMode(false) }}>Cancel</Button>
                        <Button variant="outline-dark" onClick={DeleteExpenses}>Delete</Button>
                    </Col>
                </Row>
                <Row className='align-items-center mt-3 mb-4'>
                    <Col>
                        <Stack direction="horizontal">
                            <div className="me-3">Group By:</div>
                            <Dropdown data-bs-theme="light">
                                <Dropdown.Toggle id="groupBy" variant="outline-dark">
                                    Select An Account
                                </Dropdown.Toggle>
                                <Dropdown.Menu>
                                    <Dropdown.Item href="#/action-1">
                                        Action
                                    </Dropdown.Item>
                                    <Dropdown.Item href="#/action-2">Another action</Dropdown.Item>
                                    <Dropdown.Item href="#/action-3">Something else</Dropdown.Item>
                                    <Dropdown.Divider />
                                    <Dropdown.Item href="#/action-4">Separated link</Dropdown.Item>
                                </Dropdown.Menu>
                            </Dropdown>
                        </Stack>
                    </Col >
                    <Col className='ms-auto my-auto text-end'>
                        <InputGroup>
                            <InputGroup.Text id="basic-addon1">@</InputGroup.Text>
                            <Form.Control
                                placeholder="Search"
                                aria-label="Search"
                                aria-describedby="basic-addon1"
                            />
                        </InputGroup>
                    </Col>
                </Row>
                <Row>
                    <Form>
                        <Table bordered hover>
                            <thead>
                                <tr>
                                    <th className='text-center'><Form.Check onChange={handleCheckAll} /></th>
                                    <th>Date</th>
                                    <th>Account</th>
                                    <th>Vendor</th>
                                    <th>Amount</th>
                                    <th>Category</th>
                                    <th>Notes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* <tr>
                                    <td><Form.Check checked={checkedExps.includes("123")} id='123' className='text-center' onChange={handleCheck} /></td>
                                    <td>2021-10-10</td>
                                    <td>Bank of America</td>
                                    <td>Amazon</td>
                                    <td>100.00</td>
                                    <td>Shopping</td>
                                    <td>Amazon Purchase</td>
                                </tr> */}
                                {expenses?.map((expense: Expense) => {
                                    if (editMode) {
                                        return (<tr key={expense._id}>
                                            <td><Form.Check checked={checkedExps.includes(expense._id)} id={expense._id} className='text-center' onChange={handleCheck} /></td>
                                            <td><Form.Control type="text" size="sm" value={expense.date} onChange={handleDateChange} /></td>
                                            <td>{expense.account}</td>
                                            <td>{expense.vendor}</td>
                                            <td>{expense.amount}</td>
                                            <td>{expense.category}</td>
                                            <td>{expense.notes ? expense.notes : ""}</td>
                                        </tr>)
                                    } else {
                                        return (<tr key={expense._id}>
                                            <td><Form.Check checked={checkedExps.includes(expense._id)} id={expense._id} className='text-center' onChange={handleCheck} /></td>
                                            <td>{expense.date.substring(0, 10)}</td>
                                            <td>{expense.account}</td>
                                            <td>{expense.vendor}</td>
                                            <td>{expense.amount}</td>
                                            <td>{expense.category}</td>
                                            <td>{expense.notes ? expense.notes : ""}</td>
                                        </tr>)
                                    }
                                })}
                            </tbody>
                        </Table>
                    </Form>
                </Row>
            </Container >

            {/* Add Expense Form */}
            <Modal show={showForm} onHide={handleClose} centered>
                <Form onSubmit={AddExpense}>
                    <Modal.Header closeButton>
                        <Modal.Title>Add An Expense</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <InputGroup className="mb-3">
                            <InputGroup.Text id="date">Date</InputGroup.Text>
                            <Form.Control
                                required
                                value={date}
                                type="date"
                                aria-label="date"
                                aria-describedby="date"
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDate(e.target.value)}
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
                                value={amount}
                                aria-label="amount"
                                aria-describedby="amount"
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
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


export default Expenses
