import { type ReactNode } from "react";
import { useAuth } from "@clerk/react";
import { Navigate } from "react-router-dom";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return null;
  }

  if (!isSignedIn) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
