import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

declare global {
  interface Window {
    fbq: (...args: unknown[]) => void;
  }
}

const DEDUPE_TIMEOUT_MS = 500; // Ignore duplicate PageView for same path within this window
const SESSION_KEY_PATH = "fb_last_pageview_path";
const SESSION_KEY_TS = "fb_last_pageview_ts";

/**
 * FacebookPixel component - handles SPA PageView tracking with robust deduplication.
 * 
 * ARCHITECTURE:
 * - Pixel init happens ONCE in index.html (never here)
 * - This component tracks PageView for SPA route changes
 * - Deduplication uses 2 layers:
 *   1. In-memory ref (prevents duplicate within same mount)
 *   2. sessionStorage (prevents duplicate across rapid remounts)
 */
export function FacebookPixel() {
  const location = useLocation();
  const lastTrackedPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!window.fbq) {
      console.warn("[FB Pixel] fbq not available");
      return;
    }

    const currentPath = location.pathname;
    const now = Date.now();

    // Layer 1: In-memory check (same mount)
    if (lastTrackedPathRef.current === currentPath) {
      if (import.meta.env.DEV) {
        console.log(`[FB Pixel] Blocked duplicate PageView (ref): ${currentPath}`);
      }
      return;
    }

    // Layer 2: sessionStorage check (cross-remount protection)
    try {
      const storedPath = sessionStorage.getItem(SESSION_KEY_PATH);
      const storedTs = sessionStorage.getItem(SESSION_KEY_TS);

      if (storedPath === currentPath && storedTs) {
        const elapsed = now - parseInt(storedTs, 10);
        if (elapsed < DEDUPE_TIMEOUT_MS) {
          if (import.meta.env.DEV) {
            console.log(`[FB Pixel] Blocked duplicate PageView (session, ${elapsed}ms ago): ${currentPath}`);
          }
          // Still update ref to prevent future in-memory duplicates
          lastTrackedPathRef.current = currentPath;
          return;
        }
      }

      // Track PageView
      window.fbq("track", "PageView");
      
      // Update both layers
      lastTrackedPathRef.current = currentPath;
      sessionStorage.setItem(SESSION_KEY_PATH, currentPath);
      sessionStorage.setItem(SESSION_KEY_TS, now.toString());

      if (import.meta.env.DEV) {
        console.log(`[FB Pixel] PageView tracked: ${currentPath}`);
      }
    } catch (e) {
      // sessionStorage might be blocked in some browsers/modes
      // Fall back to ref-only deduplication
      window.fbq("track", "PageView");
      lastTrackedPathRef.current = currentPath;
      
      if (import.meta.env.DEV) {
        console.log(`[FB Pixel] PageView tracked (no session): ${currentPath}`);
      }
    }
  }, [location.pathname]);

  return null;
}
