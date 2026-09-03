import Stack from "react-bootstrap/Stack";
import Nav from "react-bootstrap/Nav";
import Dropdown from "react-bootstrap/Dropdown";
import { useLocation, useNavigate } from "react-router-dom";
import { Show, UserButton, useUser } from "@clerk/react";

function DropDowns() {
    return (
        <Stack className="" direction="horizontal" gap={3}>
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
            </Dropdown>
        </Stack>
    );
}

export const Header = () => {
    const navigate = useNavigate();
    const { state } = useLocation();
    const newUser = state?.newUser;
    const { user } = useUser();

    return (
        <>
            <Stack className="ps-5 py-3 bg-black text-white" direction="horizontal" gap={4}>
                <div className="fs-2">TrackSense</div>
                <Nav className="fs-6 mt-2" activeKey="/home">
                    <Nav.Item>
                        <Nav.Link onClick={() => navigate("/expenses")}>Expenses</Nav.Link>
                    </Nav.Item>
                </Nav>
                <Nav className="fs-6 ms-auto me-4 mt-1 d-flex align-items-center">
                    <Show when="signed-in">
                        <UserButton />
                    </Show>
                </Nav>
            </Stack>
            <Stack className="bg-slate flex flex-col py-5 ps-5 gap={1}">
                <div className="fs-xl pb-1">{newUser ? "Welcome to TrackSense!" : "Welcome Back!"}</div>
                {user?.firstName ? (
                    <div className="fs-5 ms-1">Hello, {user.firstName} {user.lastName}</div>
                ) : null}
                <div className="flex flex-row gap-x-3 pt-4">
                    <DropDowns />
                </div>
            </Stack>
        </>
    );
};

const Home = () => {
    return <Header />;
};

export default Home;
