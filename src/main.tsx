import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Build version for debugging cache issues
const BUILD_VERSION = new Date().toISOString();
console.log(`[Build] Version: ${BUILD_VERSION}`);

// Register Service Worker with proper update handling
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", {
        updateViaCache: "none", // Force browser to check for SW updates
      });

      console.log("[SW] Service Worker registered successfully");

      // Check for updates immediately
      registration.update();

      // Check for updates every 30 minutes
      setInterval(() => {
        registration.update();
        console.log("[SW] Checking for updates...");
      }, 30 * 60 * 1000);

      // Handle updates
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        console.log("[SW] New version found, installing...");

        newWorker?.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            console.log("[SW] New version installed, reloading...");
            // Auto-reload when new version is ready
            window.location.reload();
          }
        });
      });

      // Listen for controller change (when new SW takes over)
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        console.log("[SW] Controller changed, reloading...");
        window.location.reload();
      });
    } catch (error) {
      console.error("[SW] Registration failed:", error);
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
