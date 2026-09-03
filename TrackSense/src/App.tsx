import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@clerk/react";
import Expenses from "./pages/Expenses.tsx";
import LoginPage from "./pages/Login.tsx";
import RegistrationPage from "./pages/Register.tsx";
import { ProtectedRoute } from "./components/ProtectedRoute";

function RootRedirect() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return null;
  return <Navigate to={isSignedIn ? "/expenses" : "/login"} replace />;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route
        path="/expenses"
        element={
          <ProtectedRoute>
            <Expenses />
          </ProtectedRoute>
        }
      />
      <Route path="/login/*" element={<LoginPage />} />
      <Route path="/register/*" element={<RegistrationPage />} />
    </Routes>
  );
}

export default App;
