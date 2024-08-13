import axios from "axios";
import { useState } from "react"
import { Button, FloatingLabel, Stack } from "react-bootstrap";
import Form from 'react-bootstrap/Form';
import { redirect } from "react-router-dom";

interface User {
    firstName: string,
    lastName: string,
    email: string,
    password?: string
}

function RegistrationPage() {
    const [firstName, setFirstName] = useState("")
    const [lastName, setLastName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")

    function handleRegister() {
        let user: User = { firstName, lastName, email, password }
        axios.post(`http://localhost:3000/register/`, user)
            .then(() => {
                redirect('/login')
            })
            .catch((err) => {
                alert("Error registering, please try again: " + err)
            })
    }

    return (
        <div className="min-vh-100 d-flex align-items-center justify-content-center">
            <div className="card" style={{ width: "25rem" }}>
                <div className="card-header">
                    <h4 className="card-title mt-3 pb-1 text-center">TrackSense</h4>
                </div>
                <div className="card-body">
                    <Form onSubmit={handleRegister}>
                        <Stack className="mb-3 mt-2" direction="horizontal" gap={3}>
                            <FloatingLabel
                                controlId="floatingInput"
                                label="First name"
                                className="text-secondary"
                            >
                                <Form.Control
                                    autoFocus
                                    required
                                    value={firstName}
                                    type="text"
                                    aria-label="first name"
                                    aria-describedby="first name"
                                    placeholder="First Name"
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFirstName(e.target.value)}
                                />
                            </FloatingLabel>
                            <FloatingLabel
                                controlId="floatingInput"
                                label="Last name"
                                className="text-secondary"
                            >
                                <Form.Control
                                    required
                                    value={lastName}
                                    type="text"
                                    aria-label="last name"
                                    aria-describedby="last name"
                                    placeholder="Last Name"
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLastName(e.target.value)}
                                />
                            </FloatingLabel>
                        </Stack>

                        <FloatingLabel
                            controlId="floatingInput"
                            label="Email address"
                            className="mb-3 mt-2 text-secondary"
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
                            controlId="floatingInput2"
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

export default RegistrationPage