import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import PublicPaymentApp from "./PublicPaymentApp";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PublicPaymentApp />
  </StrictMode>
);
