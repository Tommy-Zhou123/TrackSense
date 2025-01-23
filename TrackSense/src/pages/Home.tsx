import Stack from 'react-bootstrap/Stack';
import Nav from 'react-bootstrap/Nav';
import Dropdown from 'react-bootstrap/Dropdown';
import axios from 'axios';
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from 'react-bootstrap';
import { useEffect, useState } from 'react';


const API_URL: string = import.meta.env.VITE_API_URL as string


function DropDowns() {
    return (
        <Stack className='' direction="horizontal" gap={3}>
            <Dropdown data-bs-theme="dark">
                <Dropdown.Toggle id="dropdown-button-dark-example1" variant="dark">
                    Select An Account
                </Dropdown.Toggle>
                <Dropdown.Menu>
                    <Dropdown.Item href="#/action-1" active>
                        Action
                    </Dropdown.Item>
                    <Dropdown.Item href="#/action-2">Another action</Dropdown.Item>
                    <Dropdown.Item href="#/action-3">Something else</Dropdown.Item>
                    <Dropdown.Divider />
                    <Dropdown.Item href="#/action-4">Separated link</Dropdown.Item>
                </Dropdown.Menu>
            </Dropdown>
            <Dropdown data-bs-theme="dark">
                <Dropdown.Toggle id="Date" variant="dark">
                    Date Range
                </Dropdown.Toggle>

                <Dropdown.Menu>
                    <Dropdown.Item href="#/action-1" active>
                        Action
                    </Dropdown.Item>
                    <Dropdown.Item href="#/action-2">Another action</Dropdown.Item>
                    <Dropdown.Item href="#/action-3">Something else</Dropdown.Item>
                    <Dropdown.Divider />
                    <Dropdown.Item href="#/action-4">Separated link</Dropdown.Item>
                </Dropdown.Menu>
            </Dropdown >
        </Stack>
    )
}


export const Header = () => {
    const navigate = useNavigate();
    const { state } = useLocation();
    const newUser = state?.newUser;

    const [userInfo, setUserInfo] = useState({ id: "", firstName: "", lastName: "", email: "" })

    useEffect(() => {
        axios.get(`${API_URL}/api/user`)
            .then((res) => {
                if (res.status === 200) {
                    setUserInfo(res.data);
                    console.log(userInfo);
                }
            })
            .catch((e) => {
                console.error(e);
                navigate("/login");
            })
    }, [])

    function handleLogout() {
        axios.post(`${API_URL}/api/logout`)
            .then((res) => {
                if (res.status === 200) {
                    navigate("/login");
                }
            })
            .catch((e) => {
                console.error(e);
                navigate("/login");
            })
    }
    return (
        <>
            <Stack className='ps-5 py-3 bg-black text-white' direction="horizontal" gap={4}>
                <div className='fs-2'>TrackSense</div>
                <Nav className="fs-6 mt-2" activeKey="/home">
                    <Nav.Item>
                        <Nav.Link href="/home">Expenses</Nav.Link>
                    </Nav.Item>
                    {/* <Nav.Item>
                        <Nav.Link eventKey="link-1">Expenses</Nav.Link>
                    </Nav.Item>
                    <Nav.Item>
                        <Nav.Link eventKey="link-2">Link</Nav.Link>
                    </Nav.Item>
                    <Nav.Item>
                        <Nav.Link className="disabled" eventKey="disabled" disabled>
                            Disabled
                        </Nav.Link>
                    </Nav.Item>
                    <Nav.Item>
                        <Nav.Link href="/login" eventKey="login">Login</Nav.Link>
                    </Nav.Item> */}
                </Nav>
                <Nav className="fs-6 ms-auto me-4 mt-1">
                    <Nav.Link onClick={handleLogout}>
                        Logout
                    </Nav.Link>
                </Nav>

            </Stack>
            <Stack className="bg-slate flex flex-col py-5 ps-5 gap={1}">
                <div className='fs-xl pb-1'>{newUser ? "Welcome to TrackSense!" : "Welcome Back!"}</div>
                {userInfo !== null ? (<div className='fs-5 pb-4 ms-1'>Hello, {userInfo?.firstName} {userInfo.lastName}</div>) : null}
                <div className="flex flex-row gap-x-3">
                    <DropDowns />
                </div>
            </Stack>
        </>
    )
}

const Home = () => {
    return <Header />
}

export default Home
