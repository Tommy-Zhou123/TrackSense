import { Show, SignInButton, SignUp, useAuth } from "@clerk/react";
import { Navigate } from "react-router-dom";

function Register() {
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
                        <SignUp
                            path="/register"
                            routing="path"
                            signInUrl="/login"
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
                    Already have an account?{" "}
                    <Show when="signed-out">
                        <SignInButton>
                            <button className="btn btn-link p-0 align-baseline" type="button">
                                Login
                            </button>
                        </SignInButton>
                    </Show>
                </div>
            </div>
        </div>
    );
}

export default Register;
