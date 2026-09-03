import { Show, SignUp, useAuth } from "@clerk/react";
import { Navigate } from "react-router-dom";
import BeamsBackground from "@/components/kokonutui/beams-background";

function Register() {
    const { isLoaded, isSignedIn } = useAuth();

    if (!isLoaded) {
        return null;
    }

    if (isSignedIn) {
        return <Navigate to="/expenses" replace />;
    }

    return (
        <BeamsBackground intensity="subtle">
            <Show when="signed-out">
                <SignUp
                    path="/register"
                    routing="path"
                    signInUrl="/login"
                    fallbackRedirectUrl="/expenses"
                />
            </Show>
        </BeamsBackground>
    );
}

export default Register;
