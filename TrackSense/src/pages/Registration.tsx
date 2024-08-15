import axios from "axios";
import { useState } from "react"
import { Button, FloatingLabel, Stack } from "react-bootstrap";
import Form from 'react-bootstrap/Form';
import { useNavigate } from "react-router-dom";

interface User {
    username: string,
    email: string,
    password: string
}

function RegistrationPage() {
    const [username, setusername] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")

    const navigate = useNavigate();

    function handleRegister(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        let user: User = { username, email, password }
        axios.post(`https://track-sense-backend.vercel.app/register`, user)
            .then(() => {
                navigate("/expenses");
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
                        <FloatingLabel
                            label="username"
                            className="mb-3 text-secondary"
                        >
                            <Form.Control
                                required
                                value={username}
                                type="text"
                                aria-label="username"
                                aria-describedby="username"
                                placeholder="username"
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setusername(e.target.value)}
                            />
                        </FloatingLabel>

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