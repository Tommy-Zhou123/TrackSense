import { useState } from "react"
import { Button, FloatingLabel } from "react-bootstrap";
import Form from 'react-bootstrap/Form';

function LoginPage() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")

    function handleLogin() {

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
                            controlId="floatingInput"
                            label="Email address"
                            className="mb-3 mt-2 text-secondary"
                        >
                            <Form.Control
                                autoFocus
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
                                type="text"
                                aria-label="password"
                                aria-describedby="password"
                                placeholder="Password"
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                            />
                        </FloatingLabel>
                        <div className="text-end">
                            <Button type="submit" className="btn btn-primary mb-1">Login</Button>
                        </div>
                    </Form>
                </div>
                <div className="card-footer text-muted">
                    <button className="btn btn-link text-primary text-decoration-none">Sign Up</button>
                </div>
            </div>
        </div >
    )
}

export default LoginPage