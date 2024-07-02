import axios from 'axios'
import { useState, useEffect } from 'react'
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

const Expenses = () => {
    const [expenses, setExpenses] = useState<Expense[]>([])
    const [selectedExps, setSelectedExps] = useState<string[]>([]);
    const [show, setShow] = useState(false);
    const [showCat, setShowCat] = useState(false);
    const [showAcc, setShowAcc] = useState(false);

    const [date, setDate] = useState('');
    const [account, setAccount] = useState('');
    const [vendor, setVendor] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('');
    const [notes, setNotes] = useState('');

    const handleClose = () => setShow(false);
    const handleShow = () => setShow(true);

    useEffect(() => {
        getExpenses()
    }, [])

    function getExpenses() {
        axios.get('http://localhost:3000/expenses')
            .then((response) => {
                setExpenses(response.data.expenses)
            })
            .catch((err) => console.log(err))
    }

    function AddExpense() {
        const data = {
            date, account, vendor, amount, category, notes
        }
        axios.post('http://localhost:3000/expenses/add', data)
            .then(() => {
                getExpenses()
                handleClose()
            })
            .catch((err) => console.log(err))
    }

    function EditExpenses() {
        const data = {
            date, account, vendor, amount, category, notes
        }
        selectedExps.forEach(expense => {
            // axios.put(`http://localhost:3000/expenses/${???}`, data) TO DO!!
            //     .then(() => {
            //         getExpenses()
            //     })
            //     .catch((err) => console.log(err))
        });
    }

    function DeleteExpenses() {
        selectedExps.forEach(expense => {
            axios.delete(`http://localhost:3000/expenses/${expense} `)
                .then(() => {
                    getExpenses()
                })
                .catch((err) => console.log(err))
        });
    }

    function handleCategory(e: React.ChangeEvent<HTMLSelectElement>) {
        // Check if last option is selected, need to creat new category
        if (e.target.selectedIndex == e.target.childElementCount - 1) {
            setShowCat(true)
        } else {
            setShowCat(false)
            if (e.target.value != null && e.target.value != "") {
                setCategory(e.target.value)
            }
        }
    }

    function handleAccount(e: React.ChangeEvent<HTMLSelectElement>) {
        // Check if last option is selected, need to creat new account
        if (e.target.selectedIndex == e.target.childElementCount - 1) {
            setShowAcc(true)
        } else {
            setShowAcc(false)
            if (e.target.value != null && e.target.value != "") {
                setAccount(e.target.value)
            }
        }
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
                        <Button variant="outline-dark" onClick={EditExpenses}>Edit</Button>
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
                                    <th></th>
                                    <th>Date</th>
                                    <th>Account</th>
                                    <th>Vendor</th>
                                    <th>Amount</th>
                                    <th>Category</th>
                                    <th>Notes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {expenses?.map((expense: Expense) => {
                                    return (<tr key={expense._id}>
                                        <td><Form.Check onClick={() => { setSelectedExps([...selectedExps, expense._id]) }} /></td>
                                        <td>{expense.date.substring(0, 10)}</td>
                                        <td>{expense.account}</td>
                                        <td>{expense.vendor}</td>
                                        <td>{expense.amount}</td>
                                        <td>{expense.category}</td>
                                        <td>{expense.notes ? expense.notes : ""}</td>
                                    </tr>)
                                })}
                            </tbody>
                        </Table>
                    </Form>
                </Row>
            </Container >

            {/* Add Expense Form */}
            <Modal show={show} onHide={handleClose} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Add An Expense</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form>
                        <InputGroup className="mb-3">
                            <InputGroup.Text id="date">Date</InputGroup.Text>
                            <Form.Control
                                type="date"
                                aria-label="date"
                                aria-describedby="date"
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDate(e.target.value)}
                            />
                        </InputGroup>
                        <Form.Select onChange={handleAccount}
                            aria-label="Default select example" className="mb-3">
                            <option value="">Select or Add an Account</option>
                            {/* {expenses?.map((expense: Expense) => {
                                // TODO: NEED TO ADD ACCOUNTS
                                return <option key={expense._id} value={expense.category}>{expense.category}</option>
                            })} */}
                            <option value="">New Account</option>
                        </Form.Select>
                        <InputGroup className={showAcc ? "mb-3" : "mb-3 d-none"}>
                            <InputGroup.Text id="amount">Account</InputGroup.Text>
                            <Form.Control
                                aria-label="newAccount"
                                aria-describedby="newAccount"
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAccount(e.target.value)}
                            />
                        </InputGroup>
                        <InputGroup className="mb-3">
                            <InputGroup.Text id="vendor">Vendor</InputGroup.Text>
                            <Form.Control
                                aria-label="vendor"
                                aria-describedby="vendor"
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVendor(e.target.value)}
                            />
                        </InputGroup>
                        <InputGroup className="mb-3">
                            <InputGroup.Text id="amount">Amount</InputGroup.Text>
                            <Form.Control
                                aria-label="amount"
                                aria-describedby="amount"
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
                            />
                        </InputGroup>
                        <Form.Select onChange={handleCategory}
                            aria-label="Default select example" className="mb-3">
                            <option value="">Select or Add a Category</option>
                            {expenses?.map((expense: Expense) => {
                                // TODO: NEED TO GET ALL CATEGORIES TO POPULATE SELECTION
                                return <option key={expense._id} value={expense.category}>{expense.category}</option>
                            })}
                            <option value="">New Category</option>
                        </Form.Select>
                        <InputGroup className={showCat ? "mb-3" : "mb-3 d-none"}>
                            <InputGroup.Text id="amount">Category</InputGroup.Text>
                            <Form.Control
                                aria-label="newCategory"
                                aria-describedby="newCategory"
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCategory(e.target.value)}
                            />
                        </InputGroup>
                        <InputGroup className="mb-3">
                            <InputGroup.Text>Notes</InputGroup.Text>
                            <Form.Control as="textarea" aria-label="textarea"
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNotes(e.target.value)}
                            />
                        </InputGroup>
                    </Form>
                </Modal.Body >
                <Modal.Footer>
                    <Button variant="outline-dark" onClick={handleClose}>
                        Close
                    </Button>
                    <Button variant="dark" onClick={AddExpense}>
                        Add
                    </Button>
                </Modal.Footer>
            </Modal >
        </>
    )
}


export default Expenses
