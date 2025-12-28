import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Simple app bootstrap - no Service Worker
createRoot(document.getElementById("root")!).render(<App />);
