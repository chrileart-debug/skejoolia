/**
 * Facebook Pixel Singleton Initialization
 * 
 * This module ensures the Facebook Pixel is initialized exactly ONCE,
 * preventing duplicate PageView events caused by:
 * - Multiple script loads in index.html
 * - React component remounts
 * - Iframe previews (Lovable, etc.)
 * - HMR (Hot Module Replacement) in development
 */

const PIXEL_ID = "916021168260117";
const FB_SCRIPT_SRC = "https://connect.facebook.net/en_US/fbevents.js";

// Extended fbq type for internal use
interface FbqFunction {
  (...args: unknown[]): void;
  loaded?: boolean;
  queue?: unknown[];
  push?: (...args: unknown[]) => void;
  version?: string;
  callMethod?: (...args: unknown[]) => void;
}

// Global state interface (persists across HMR/module reloads)
interface FbPixelState {
  initialized: boolean;
  scriptInjected: boolean;
  pixelIdsInitialized: Set<string>;
}

// Get or create global state on window (survives HMR)
const getGlobalState = (): FbPixelState => {
  const win = window as unknown as { __fbPixelState?: FbPixelState };
  if (!win.__fbPixelState) {
    win.__fbPixelState = {
      initialized: false,
      scriptInjected: false,
      pixelIdsInitialized: new Set<string>(),
    };
  }
  return win.__fbPixelState;
};

// Use type assertion for window properties
const getWindowFbq = (): FbqFunction | undefined => {
  return (window as unknown as { fbq?: FbqFunction }).fbq;
};

const setWindowFbq = (fbq: FbqFunction): void => {
  (window as unknown as { fbq: FbqFunction; _fbq: FbqFunction }).fbq = fbq;
  (window as unknown as { fbq: FbqFunction; _fbq: FbqFunction })._fbq = fbq;
};

// Check if fbevents.js script already exists in the DOM
const isScriptAlreadyInjected = (): boolean => {
  return !!document.querySelector(`script[src="${FB_SCRIPT_SRC}"]`);
};

/**
 * Initialize Facebook Pixel exactly once.
 * Safe to call multiple times - subsequent calls are no-ops.
 * Uses window-level state to survive HMR and module reloads.
 */
export function initFacebookPixelOnce(): boolean {
  const state = getGlobalState();

  // Already fully initialized
  if (state.initialized) {
    if (import.meta.env.DEV) {
      console.log("[FB Pixel Init] Already initialized (window state), skipping");
    }
    return false;
  }

  const existingFbq = getWindowFbq();

  // Already initialized elsewhere (e.g., fbq.loaded is true)
  if (existingFbq?.loaded) {
    state.initialized = true;
    state.pixelIdsInitialized.add(PIXEL_ID);
    if (import.meta.env.DEV) {
      console.log("[FB Pixel Init] fbq.loaded=true, marking as initialized");
    }
    return false;
  }

  // Initialize fbq function if not present
  if (!existingFbq) {
    const fbq: FbqFunction = function (...args: unknown[]) {
      if (fbq.callMethod) {
        fbq.callMethod(...args);
      } else {
        fbq.queue?.push(args);
      }
    };

    fbq.push = fbq;
    fbq.loaded = false;
    fbq.version = "2.0";
    fbq.queue = [];

    setWindowFbq(fbq);
  }

  // Inject the fbevents.js script only if not already injected
  if (!state.scriptInjected && !isScriptAlreadyInjected()) {
    // Mark as injected immediately to prevent race conditions
    state.scriptInjected = true;

    const script = document.createElement("script");
    script.async = true;
    script.src = FB_SCRIPT_SRC;
    
    script.onload = () => {
      if (import.meta.env.DEV) {
        console.log("[FB Pixel Init] fbevents.js loaded successfully");
      }
    };

    script.onerror = () => {
      console.error("[FB Pixel Init] Failed to load fbevents.js");
      // Reset flag so it can retry
      state.scriptInjected = false;
    };

    // Insert script into head
    const firstScript = document.getElementsByTagName("script")[0];
    if (firstScript?.parentNode) {
      firstScript.parentNode.insertBefore(script, firstScript);
    } else {
      document.head.appendChild(script);
    }
  } else if (import.meta.env.DEV) {
    console.log("[FB Pixel Init] Script already injected, skipping injection");
  }

  // Initialize with Pixel ID only if not already done for this ID
  if (!state.pixelIdsInitialized.has(PIXEL_ID)) {
    const fbq = getWindowFbq();
    if (fbq) {
      fbq("init", PIXEL_ID);
      state.pixelIdsInitialized.add(PIXEL_ID);
      if (import.meta.env.DEV) {
        console.log(`[FB Pixel Init] Initialized Pixel ID: ${PIXEL_ID}`);
      }
    }
  } else if (import.meta.env.DEV) {
    console.log(`[FB Pixel Init] Pixel ID ${PIXEL_ID} already initialized, skipping`);
  }
  
  state.initialized = true;

  return true;
}

/**
 * Check if we're running inside an iframe (e.g., Lovable preview)
 */
export function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    // If we can't access window.top due to cross-origin, we're in an iframe
    return true;
  }
}

/**
 * Get the Pixel ID
 */
export function getPixelId(): string {
  return PIXEL_ID;
}
