import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

declare const __BUILD_ID__: string;

// Build version for debugging cache issues
const BUILD_ID = typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : new Date().toISOString();
console.log(`[Build] ID: ${BUILD_ID}`);

// ============================================
// AUTO-REPAIR: Clear old caches when BUILD_ID changes
// ============================================
const STORAGE_KEY = "skejool_last_build_id";

async function autoRepairIfNeeded(): Promise<boolean> {
  const lastBuildId = localStorage.getItem(STORAGE_KEY);
  
  // First visit or same build - just update storage
  if (!lastBuildId) {
    localStorage.setItem(STORAGE_KEY, BUILD_ID);
    return false;
  }
  
  // Same build - nothing to do
  if (lastBuildId === BUILD_ID) {
    return false;
  }
  
  console.log(`[Auto-Repair] Build changed: ${lastBuildId} → ${BUILD_ID}`);
  console.log("[Auto-Repair] Clearing Service Workers and caches...");
  
  try {
    // Unregister all Service Workers
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const reg of registrations) {
      await reg.unregister();
      console.log("[Auto-Repair] Unregistered SW:", reg.scope);
    }
    
    // Clear all caches
    const cacheNames = await caches.keys();
    for (const name of cacheNames) {
      await caches.delete(name);
      console.log("[Auto-Repair] Deleted cache:", name);
    }
    
    // Update stored BUILD_ID
    localStorage.setItem(STORAGE_KEY, BUILD_ID);
    
    console.log("[Auto-Repair] Done! Reloading...");
    window.location.reload();
    return true; // Will reload
  } catch (error) {
    console.error("[Auto-Repair] Failed:", error);
    localStorage.setItem(STORAGE_KEY, BUILD_ID);
    return false;
  }
}

// ============================================
// SERVICE WORKER REGISTRATION
// ============================================
async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  
  try {
    // Cache-bust the SW URL to avoid edge cache traps
    const swUrl = `/sw.js?build=${encodeURIComponent(BUILD_ID)}`;

    const registration = await navigator.serviceWorker.register(swUrl, {
      updateViaCache: "none",
    });

    console.log("[SW] Registered successfully");

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
          window.location.reload();
        }
      });
    });

    // Listen for controller change
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      console.log("[SW] Controller changed");
    });
  } catch (error) {
    console.error("[SW] Registration failed:", error);
  }
}

// ============================================
// BOOTSTRAP
// ============================================
(async () => {
  // First: check if we need to auto-repair (clears old SW/caches and reloads)
  const willReload = await autoRepairIfNeeded();
  if (willReload) return; // Page will reload, don't continue
  
  // Then: register service worker
  registerServiceWorker();
  
  // Finally: render app
  createRoot(document.getElementById("root")!).render(<App />);
})();
