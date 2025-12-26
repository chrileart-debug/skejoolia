import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const FB_PIXEL_ID = "916021168260117";
const FB_SCRIPT_ID = "fb-pixel-script";

declare global {
  interface Window {
    fbq: (...args: unknown[]) => void;
    _fbq: unknown;
  }
}

// Check if the FB script is already in the DOM
function isScriptLoaded(): boolean {
  return !!document.getElementById(FB_SCRIPT_ID);
}

// Dynamically load the Facebook Pixel script
function loadFacebookScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isScriptLoaded()) {
      console.log("[FB Pixel] Script already in DOM");
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.id = FB_SCRIPT_ID;
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";

    script.onload = () => {
      console.log("[FB Pixel] fbevents.js loaded successfully");
      resolve();
    };

    script.onerror = () => {
      console.error("[FB Pixel] fbevents.js failed to load (AdBlock/CSP/DNS?)");
      reject(new Error("Failed to load FB Pixel script"));
    };

    document.head.appendChild(script);
  });
}

// Initialize the fbq function before script loads
function initFbqFunction() {
  if (window.fbq) return;

  const n = (window.fbq = function (...args: unknown[]) {
    if ((n as any).callMethod) {
      (n as any).callMethod.apply(n, args);
    } else {
      (n as any).queue.push(args);
    }
  }) as any;

  if (!window._fbq) window._fbq = n;
  n.push = n;
  n.loaded = true;
  n.version = "2.0";
  n.queue = [];
}

// Initialize Pixel with optional user data for advanced matching
function initPixelWithUserData(userData?: { email?: string; phone?: string }) {
  if (!window.fbq) {
    console.warn("[FB Pixel] fbq not available for init");
    return;
  }

  if (userData?.email || userData?.phone) {
    window.fbq("init", FB_PIXEL_ID, {
      em: userData.email?.toLowerCase().trim(),
      ph: userData.phone?.replace(/\D/g, ""),
    });
    console.log("[FB Pixel] Initialized WITH user data (advanced matching)");
  } else {
    window.fbq("init", FB_PIXEL_ID);
    console.log("[FB Pixel] Initialized WITHOUT user data");
  }
}

// Track PageView
function trackPageView(route: string) {
  if (typeof window !== "undefined" && window.fbq) {
    window.fbq("track", "PageView");
    console.log(`[FB Pixel] PageView tracked on route: ${route}`);
  } else {
    console.warn("[FB Pixel] fbq not available for PageView");
  }
}

export function FacebookPixel() {
  const location = useLocation();
  const { user } = useAuth();
  const isInitialized = useRef(false);
  const lastUserEmail = useRef<string | null>(null);
  const initAttempts = useRef(0);

  // Initialize Pixel on mount
  useEffect(() => {
    if (isInitialized.current) return;

    const initPixel = async () => {
      try {
        initAttempts.current++;
        console.log(`[FB Pixel] Initialization attempt #${initAttempts.current}`);

        // Setup fbq function first
        initFbqFunction();

        // Load the script
        await loadFacebookScript();

        // Initialize with user data if available
        initPixelWithUserData({
          email: user?.email,
          phone: user?.user_metadata?.phone,
        });

        // Track initial PageView
        trackPageView(location.pathname);

        isInitialized.current = true;
        lastUserEmail.current = user?.email || null;
      } catch (error) {
        console.error("[FB Pixel] Initialization failed:", error);
        
        // Retry once after 2 seconds
        if (initAttempts.current < 2) {
          setTimeout(initPixel, 2000);
        }
      }
    };

    initPixel();
  }, []);

  // Reinitialize with user data when user logs in/out
  useEffect(() => {
    if (!isInitialized.current) return;

    const userEmail = user?.email;

    if (userEmail !== lastUserEmail.current) {
      lastUserEmail.current = userEmail || null;

      if (userEmail) {
        initPixelWithUserData({
          email: userEmail,
          phone: user?.user_metadata?.phone,
        });
      } else {
        initPixelWithUserData();
      }
    }
  }, [user?.email, user?.user_metadata?.phone]);

  // Track PageView on route change
  useEffect(() => {
    if (!isInitialized.current) {
      console.log("[FB Pixel] Skipping PageView - not initialized yet");
      return;
    }

    // Check if fbq is still available (could be blocked mid-session)
    if (!window.fbq) {
      console.warn("[FB Pixel] fbq lost - attempting reinit");
      initFbqFunction();
      
      // Try to reload script if it's gone
      if (!isScriptLoaded()) {
        loadFacebookScript().then(() => {
          initPixelWithUserData({
            email: user?.email,
            phone: user?.user_metadata?.phone,
          });
          trackPageView(location.pathname);
        }).catch(() => {
          console.error("[FB Pixel] Could not recover script");
        });
        return;
      }
    }

    trackPageView(location.pathname);
  }, [location.pathname]);

  return null;
}
