import { Show, SignIn, useAuth } from "@clerk/react";
import { Navigate } from "react-router-dom";
import BeamsBackground from "@/components/kokonutui/beams-background";

const LoginPage = () => {
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
                <SignIn
                    path="/login"
                    routing="path"
                    signUpUrl="/register"
                    fallbackRedirectUrl="/expenses"
                />
            </Show>
        </BeamsBackground>
    );
};

export default LoginPage;
