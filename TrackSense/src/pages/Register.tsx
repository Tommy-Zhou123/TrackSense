import axios from "axios";
import { useEffect, useState } from "react"
import { Button, Col, FloatingLabel, Row } from "react-bootstrap";
import Form from 'react-bootstrap/Form';
import { useNavigate } from "react-router-dom";

interface User {
    firstName: string,
    lastName: string,
    email: string,
    password: string
}

const API_URL: string = import.meta.env.VITE_API_URL as string

function Register() {
    const [firstName, setFirstName] = useState("")
    const [lastName, setLastName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")

    const navigate = useNavigate();

    useEffect(() => {
        axios.get(`${API_URL}/api/user`)
            .then((res) => {
                if (res.status === 200) {
                    navigate("/expenses");
                }
            })
            .catch()
    }, [navigate]);

    function handleRegister(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        let user: User = { firstName, lastName, email, password }
        axios.post(`${API_URL}/api/register`, user)
            .then((res) => {
                if (res.data.message === "Successfully Registered") {
                    navigate("/expenses", { state: { newUser: true } });
                } else {
                    setError("*" + res.data.message.message);
                }
            })
            .catch((err) => {
                setError("*Error Registering User. Please Try Again Later.");
                console.error(err)
            })
    }


    return (
        <div className="min-vh-100 d-flex align-items-center justify-content-center">
            <div className="card" style={{ width: "25rem" }}>
                <div className="card-header">
                    <h3 className="card-title mt-3 pb-1 text-center">TrackSense</h3>
                </div>
                <div className="card-body">
                    <Form onSubmit={handleRegister}>
                        <Row className="gx-3 mt-2 mb-3">
                            <Col>
                                <FloatingLabel
                                    label="First Name"
                                    className="text-secondary"
                                >
                                    <Form.Control
                                        required
                                        value={firstName}
                                        type="text"
                                        aria-label="First Name"
                                        aria-describedby="First Name"
                                        placeholder="First Name"
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFirstName(e.target.value)}
                                    />
                                </FloatingLabel>
                            </Col>
                            <Col>
                                <FloatingLabel
                                    label="Last Name"
                                    className="text-secondary"
                                >
                                    <Form.Control
                                        required
                                        value={lastName}
                                        type="text"
                                        aria-label="Last Name"
                                        aria-describedby="Last Name"
                                        placeholder="Last Name"
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLastName(e.target.value)}
                                    />
                                </FloatingLabel>
                            </Col>
                        </Row>
                        <FloatingLabel
                            label="Email address"
                            className="mb-3 text-secondary"
                        >
                            <Form.Control
                                required
                                value={email}
                                type="email"
                                aria-label="email"
                                aria-describedby="email"
                                placeholder="Email address"
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                            />
                        </FloatingLabel>
                        <FloatingLabel
                            label="Password"
                            className="mb-3 text-secondary"
                        >
                            <Form.Control
                                required
                                className="mb-3"
                                value={password}
                                type="password"
                                aria-label="password"
                                aria-describedby="password"
                                placeholder="Password"
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                            />
                        </FloatingLabel>
                        <p className="text-danger ms-1">{error}</p>
                        <div className="text-end">
                            <Button type="submit" className="btn btn-success mb-1">Register</Button>
                        </div>
                    </Form>
                </div>
                <div className="card-footer text-muted py-3">
                    Already have an account?&nbsp;&nbsp;<a href="/login" className="text-decoration-none">Login</a>
                </div>
            </div>
        </div >
    )
}

export default Register