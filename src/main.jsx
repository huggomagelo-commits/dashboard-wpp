import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { observarSeloExterno } from "./lib/seloExterno.js";
import "./index.css";

observarSeloExterno();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
