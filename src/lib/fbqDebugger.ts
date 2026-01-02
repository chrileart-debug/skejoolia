/**
 * Facebook Pixel Debugger (DEV-ONLY)
 * Intercepts all fbq() calls and logs them with stack traces.
 * This helps identify exactly where duplicate events are being fired from.
 */

interface FbqCall {
  timestamp: number;
  method: string;
  args: unknown[];
  stack: string;
}

// Extend window with debugger properties (separate from main fbq declaration)
interface FbqDebuggerWindow {
  _fbq_original?: (...args: unknown[]) => void;
  _fbq_calls?: FbqCall[];
}

declare const window: Window & typeof globalThis & FbqDebuggerWindow & {
  fbq: ((...args: unknown[]) => void) & { queue?: unknown[] };
};

let isInstalled = false;

export function installFbqDebugger() {
  // Only run in dev mode
  if (!import.meta.env.DEV) return;
  
  // Prevent double-install
  if (isInstalled) return;
  isInstalled = true;

  // Wait for fbq to be available
  const install = () => {
    if (!window.fbq) {
      setTimeout(install, 100);
      return;
    }

    // Already wrapped?
    if (window._fbq_original) return;

    // Store original
    window._fbq_original = window.fbq;
    window._fbq_calls = [];

    // Create wrapper
    const wrapper = (...args: unknown[]) => {
      const method = String(args[0]);
      const eventName = args[1] ? String(args[1]) : "";
      const stack = new Error().stack || "";
      
      // Extract relevant stack frames (skip wrapper internals)
      const stackLines = stack.split("\n").slice(2, 6).join("\n");
      
      const call: FbqCall = {
        timestamp: Date.now(),
        method,
        args: args.slice(1),
        stack: stackLines,
      };
      
      window._fbq_calls!.push(call);

      // Color-coded logging
      const colors = {
        init: "background: #4267B2; color: white; padding: 2px 6px; border-radius: 3px;",
        track: "background: #42b883; color: white; padding: 2px 6px; border-radius: 3px;",
        trackCustom: "background: #f59e0b; color: white; padding: 2px 6px; border-radius: 3px;",
      };
      
      const colorKey = method as keyof typeof colors;
      const style = colors[colorKey] || colors.track;

      console.groupCollapsed(
        `%c FB Pixel %c ${method}(${eventName})`,
        style,
        "color: inherit"
      );
      console.log("Args:", args.slice(1));
      console.log("Stack:", stackLines);
      console.log("Total calls:", window._fbq_calls!.length);
      console.groupEnd();

      // Count duplicates for this event
      const sameEventCalls = window._fbq_calls!.filter(
        (c) => c.method === method && String(c.args[0]) === eventName
      );
      
      if (sameEventCalls.length > 1) {
        const timeDiff = call.timestamp - sameEventCalls[sameEventCalls.length - 2].timestamp;
        console.warn(
          `%c⚠️ DUPLICATE ${method}(${eventName}) - ${sameEventCalls.length}x total, ${timeDiff}ms since last`,
          "color: #f59e0b; font-weight: bold;"
        );
      }

      // Call original
      return window._fbq_original!(...args);
    };

    // Copy properties from original
    Object.assign(wrapper, window.fbq);
    
    // Replace global fbq
    window.fbq = wrapper as typeof window.fbq;

    console.log(
      "%c🔍 FB Pixel Debugger installed - all fbq() calls will be logged",
      "background: #4267B2; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;"
    );
  };

  install();
}

/**
 * Get all recorded fbq calls (for programmatic analysis)
 */
export function getFbqCalls(): FbqCall[] {
  return window._fbq_calls || [];
}

/**
 * Print a summary of all fbq calls grouped by event
 */
export function printFbqSummary() {
  if (!import.meta.env.DEV) return;
  
  const calls = getFbqCalls();
  const grouped = calls.reduce((acc, call) => {
    const key = `${call.method}(${call.args[0] || ""})`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(call);
    return acc;
  }, {} as Record<string, FbqCall[]>);

  console.group("📊 FB Pixel Call Summary");
  Object.entries(grouped).forEach(([key, calls]) => {
    const style = calls.length > 1 
      ? "color: #f59e0b; font-weight: bold;" 
      : "color: #42b883;";
    console.log(`%c${key}: ${calls.length}x`, style);
  });
  console.groupEnd();
}
