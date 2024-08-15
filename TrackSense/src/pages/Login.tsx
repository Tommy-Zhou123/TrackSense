import axios from "axios";
import { useState } from "react"
import { Button, FloatingLabel } from "react-bootstrap";
import Form from 'react-bootstrap/Form';
import { redirect } from "react-router-dom";

function LoginPage() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")

    function handleLogin(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        axios.post(`https://track-sense-backend.vercel.app/login`, { email, password })
            .then(() => {
                redirect('/expenses')
            })
            .catch((err) => {
                alert("Error logging in, please try again: " + err)
            })
    }

    return (
        <div className="min-vh-100 d-flex align-items-center justify-content-center">
            <div className="card" style={{ width: "25rem" }}>
                <div className="card-header">
                    <h4 className="card-title mt-3 pb-1 text-center">TrackSense</h4>
                </div>
                <div className="card-body">
                    <Form onSubmit={handleLogin}>
                        <FloatingLabel
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
                            label="Password"
                            className="mb-2 text-secondary"
                        >
                            <Form.Control
                                required
                                className="mb-1"
                                value={password}
                                type="text"
                                aria-label="password"
                                aria-describedby="password"
                                placeholder="Password"
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                            />
                        </FloatingLabel>
                        <div className="form-text text-danger mb-2">
                            *Incorrect username or password
                        </div>
                        <div className="text-end">
                            <Button type="submit" className="btn btn-primary mb-1">Login</Button>
                        </div>
                    </Form>
                </div>
                <div className="card-footer text-muted py-3">
                    Don't have an account?&nbsp;&nbsp;<a href="/register" className="text-decoration-none">Register</a>
                </div>
            </div >
        </div >
    )
}

export default LoginPage