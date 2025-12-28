import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const FB_PIXEL_ID = "916021168260117";

declare global {
  interface Window {
    fbq: (...args: unknown[]) => void;
  }
}

/**
 * FacebookPixel component - handles SPA route tracking and Advanced Matching.
 * The base Pixel script is loaded in index.html (not here).
 */
export function FacebookPixel() {
  const location = useLocation();
  const { user } = useAuth();
  const lastUserEmail = useRef<string | null>(null);
  const hasTrackedInitial = useRef(false);

  // Reinitialize with user data for Advanced Matching when user logs in/out
  useEffect(() => {
    if (!window.fbq) return;

    const userEmail = user?.email;
    if (userEmail !== lastUserEmail.current) {
      lastUserEmail.current = userEmail || null;

      if (userEmail) {
        window.fbq("init", FB_PIXEL_ID, {
          em: userEmail.toLowerCase().trim(),
          ph: user?.user_metadata?.phone?.replace(/\D/g, ""),
        });
        console.log("[FB Pixel] Reinitialized with user data (Advanced Matching)");
      }
    }
  }, [user?.email, user?.user_metadata?.phone]);

  // Track PageView on SPA route changes (skip initial - already tracked in index.html)
  useEffect(() => {
    if (!window.fbq) return;

    if (!hasTrackedInitial.current) {
      hasTrackedInitial.current = true;
      return; // Skip first render - index.html already fired PageView
    }

    window.fbq("track", "PageView");
    console.log(`[FB Pixel] SPA PageView: ${location.pathname}`);
  }, [location.pathname]);

  return null;
}
