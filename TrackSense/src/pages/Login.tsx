import { Show, SignIn, SignUpButton, useAuth } from "@clerk/react";
import { Navigate } from "react-router-dom";

const LoginPage = () => {
    const { isLoaded, isSignedIn } = useAuth();

    if (!isLoaded) {
        return null;
    }

    if (isSignedIn) {
        return <Navigate to="/expenses" replace />;
    }

    return (
        <div className="min-vh-100 d-flex align-items-center justify-content-center">
            <div className="card" style={{ width: "25rem" }}>
                <div className="card-header">
                    <h3 className="card-title mt-3 pb-1 text-center">TrackSense</h3>
                </div>
                <div className="card-body d-flex justify-content-center">
                    <Show when="signed-out">
                        <SignIn
                            path="/login"
                            routing="path"
                            signUpUrl="/register"
                            fallbackRedirectUrl="/expenses"
                            appearance={{
                                elements: {
                                    rootBox: "w-100",
                                    card: "shadow-none bg-transparent p-0",
                                },
                            }}
                        />
                    </Show>
                </div>
                <div className="card-footer text-muted py-3 text-center">
                    Don't have an account?{" "}
                    <Show when="signed-out">
                        <SignUpButton>
                            <button className="btn btn-link p-0 align-baseline" type="button">
                                Register
                            </button>
                        </SignUpButton>
                    </Show>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
