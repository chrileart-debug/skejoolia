import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { initFacebookPixelOnce, isInIframe } from "@/lib/facebookPixelInit";

// Cross-remount + cross-effect dedupe keys
const SESSION_KEY_NAV = "fb_last_pageview_nav";
const SESSION_KEY_PATH = "fb_last_pageview_path";
const SESSION_KEY_TS = "fb_last_pageview_ts";

// Fallback protection if a given navigation somehow reuses the same key
const SAME_PATH_TIMEOUT_MS = 5000;

/**
 * FacebookPixel component - handles SPA PageView tracking with robust deduplication.
 *
 * INITIALIZATION:
 * - Uses singleton pattern via initFacebookPixelOnce() to ensure pixel is loaded exactly once
 * - Safe across remounts, hot reloads, and iframe environments
 *
 * DEDUPE STRATEGY:
 * 1) Primary: dedupe by react-router `location.key` (1 per navigation)
 * 2) Secondary: dedupe by `pathname` within a short window (fallback)
 * 3) Optional: Skip PageView entirely in iframe (for dev previews)
 */
export function FacebookPixel() {
  const location = useLocation();
  const lastTrackedNavRef = useRef<string | null>(null);
  const isPixelInitialized = useRef(false);

  // Initialize pixel once on first render
  useEffect(() => {
    if (!isPixelInitialized.current) {
      initFacebookPixelOnce();
      isPixelInitialized.current = true;
    }
  }, []);

  useEffect(() => {
    // Skip PageView in iframe environments (Lovable preview, etc.)
    // This prevents the "activated 3 times" warning in dev
    if (isInIframe() && import.meta.env.DEV) {
      if (import.meta.env.DEV) {
        console.log("[FB Pixel] Skipping PageView in iframe (dev mode)");
      }
      return;
    }

    if (!window.fbq) {
      if (import.meta.env.DEV) {
        console.warn("[FB Pixel] fbq not available yet");
      }
      return;
    }

    const navKey = String((location as { key?: string }).key ?? "no-key");
    const currentPath = location.pathname;
    const now = Date.now();

    // 1) In-memory nav dedupe (same mount)
    if (lastTrackedNavRef.current === navKey) {
      if (import.meta.env.DEV) {
        console.log(`[FB Pixel] Blocked duplicate PageView (ref navKey): ${navKey} ${currentPath}`);
      }
      return;
    }

    // 2) sessionStorage nav dedupe (cross-remount)
    try {
      const storedNav = sessionStorage.getItem(SESSION_KEY_NAV);
      if (storedNav === navKey) {
        if (import.meta.env.DEV) {
          console.log(`[FB Pixel] Blocked duplicate PageView (session navKey): ${navKey} ${currentPath}`);
        }
        lastTrackedNavRef.current = navKey;
        return;
      }

      // Fallback: same path within a small window
      const storedPath = sessionStorage.getItem(SESSION_KEY_PATH);
      const storedTs = sessionStorage.getItem(SESSION_KEY_TS);
      if (storedPath === currentPath && storedTs) {
        const elapsed = now - parseInt(storedTs, 10);
        if (elapsed < SAME_PATH_TIMEOUT_MS) {
          if (import.meta.env.DEV) {
            console.log(`[FB Pixel] Blocked duplicate PageView (session path, ${elapsed}ms): ${currentPath}`);
          }
          lastTrackedNavRef.current = navKey;
          return;
        }
      }

      // Track PageView once per navigation
      window.fbq("track", "PageView");

      // Persist dedupe state
      lastTrackedNavRef.current = navKey;
      sessionStorage.setItem(SESSION_KEY_NAV, navKey);
      sessionStorage.setItem(SESSION_KEY_PATH, currentPath);
      sessionStorage.setItem(SESSION_KEY_TS, now.toString());

      if (import.meta.env.DEV) {
        console.log(`[FB Pixel] PageView tracked: ${navKey} ${currentPath}`);
      }
    } catch {
      // sessionStorage might be blocked; best-effort ref-only dedupe
      window.fbq("track", "PageView");
      lastTrackedNavRef.current = navKey;

      if (import.meta.env.DEV) {
        console.log(`[FB Pixel] PageView tracked (no session): ${navKey} ${currentPath}`);
      }
    }
  }, [(location as { key?: string }).key, location.pathname]);

  return null;
}
