import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

declare global {
  interface Window {
    fbq: (...args: unknown[]) => void;
  }
}

/**
 * FacebookPixel component - handles SPA PageView tracking ONLY.
 * 
 * ARCHITECTURE:
 * - Pixel init happens ONCE in index.html (never here)
 * - This component tracks PageView for SPA route changes
 * - First PageView is tracked on mount (since index.html no longer tracks it)
 * - Subsequent PageViews are tracked on route changes
 */
export function FacebookPixel() {
  const location = useLocation();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (!window.fbq) {
      console.warn("[FB Pixel] fbq not available");
      return;
    }

    window.fbq("track", "PageView");
    isFirstRender.current = false;
  }, [location.pathname]);

  return null;
}
