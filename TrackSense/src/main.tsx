import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import { BrowserRouter } from "react-router-dom";
import { ClerkProvider } from "@clerk/react";
import { AxiosAuthBridge } from "./components/AxiosAuthBridge";

import "./index.css";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Add VITE_CLERK_PUBLISHABLE_KEY to TrackSense/.env.local");
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ClerkProvider
    publishableKey={PUBLISHABLE_KEY}
    afterSignOutUrl="/login"
    signInUrl="/login"
    signUpUrl="/register"
  >
    <BrowserRouter>
      <AxiosAuthBridge>
        <App />
      </AxiosAuthBridge>
    </BrowserRouter>
  </ClerkProvider>
);
