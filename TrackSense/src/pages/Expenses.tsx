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
    date: string
    vendor: string
    amount: number
    category: string
    notes: string
}

function ExpensesRow(expense: Expense) {
    return (
        <tr key={expense._id}>
            <td>{expense.date.substring(0, 10)}</td>
            <td>{expense.vendor}</td>
            <td>{expense.amount}</td>
            <td>{expense.category}</td>
            <td>{expense.notes ? expense.notes : ""}</td>
        </tr>
    )
}

const Expenses = () => {
    const [expenses, setExpenses] = useState([])
    const [show, setShow] = useState(false);
    const [date, setDate] = useState('');
    const [vendor, setVendor] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('');
    const [notes, setNotes] = useState('');

    const handleClose = () => setShow(false);
    const handleShow = () => setShow(true);

    useEffect(() => {
        axios.get('http://localhost:3000/expenses')
            .then((response) => {
                setExpenses(response.data.expenses)
            })
            .catch((err) => console.log(err))
    }, [])

    const navigate = useNavigate();
    function AddExpense() {
        const data = {
            date, vendor, amount, category, notes
        }
        axios.post('http://localhost:3000/expenses/add', data)
            .then(() => {
                window.location.reload();
                handleClose()
            })
            .catch((err) => console.log(err))
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
                        <Button className="me-2" onClick={handleShow} variant="outline-dark" size="sm">Add</Button>
                        <Button variant="outline-dark" size="sm">Import</Button>
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
                    <Table bordered hover>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Vendor</th>
                                <th>Amount</th>
                                <th>Category</th>
                                <th>Notes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {expenses?.map((expense: Expense) => {
                                return <ExpensesRow key={expense._id} {...expense} />
                            })}
                        </tbody>
                    </Table>
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
                        <Form.Select onChange={(e: React.ChangeEvent<HTMLSelectElement>) => e.target.value != null ? setCategory(e.target.value) : ""}
                            aria-label="Default select example" className="mb-3">
                            <option>Select or Add a Category</option>
                            {expenses?.map((expense: Expense) => {
                                // TODO: NEED TO GET ALL CATEGORIES TO POPULATE SELECTION
                                return <option key={expense._id} value={expense.category}>{expense.category}</option>
                            })}
                            <option>New Category</option>
                        </Form.Select>
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
