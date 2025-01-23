import axios from "axios";
import { useEffect, useState } from "react"
import { Button, FloatingLabel } from "react-bootstrap";
import Form from 'react-bootstrap/Form';
import { useLocation, useNavigate } from "react-router-dom";


const API_URL: string = import.meta.env.VITE_API_URL as string


const LoginPage = () => {
    const { state } = useLocation();
    const newUser = state?.newUser;

    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")

    const navigate = useNavigate();

    function handleLogin(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        if (email != null && password != null) {
            const data = {
                email, password
            }
            axios.post(`${API_URL}/api/login`, data)
                .then((res) => {
                    if (res.status === 200) {
                        if (newUser) {
                            navigate("/expenses", { state: { newUser: true } });
                        } else {
                            navigate("/expenses");
                        }
                    }
                })
                .catch(() => {
                    setError("*Invalid Email or Password")
                })
        } else {
            alert("Please fill out all required fields")
        }
    }

    return (
        <div className="min-vh-100 d-flex align-items-center justify-content-center">
            <div className="card" style={{ width: "25rem" }}>
                <div className="card-header">
                    <h3 className="card-title mt-3 pb-1 text-center">TrackSense</h3>
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
                                type="password"
                                aria-label="password"
                                aria-describedby="password"
                                placeholder="Password"
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                            />
                        </FloatingLabel>

                        <p className="text-danger ms-1">{error}</p>

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