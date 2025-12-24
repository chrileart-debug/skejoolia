import { useCallback } from "react";

declare global {
  interface Window {
    fbq: (...args: unknown[]) => void;
  }
}

// Gera um event_id único para deduplicação entre client e server
export function generateEventId(userId?: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const userPart = userId ? userId.substring(0, 8) : "anon";
  return `${userPart}_${timestamp}_${random}`;
}

export function useFacebookPixel() {
  const trackCompleteRegistration = useCallback(
    (params: { userRole: string; eventId: string }) => {
      if (typeof window !== "undefined" && window.fbq) {
        window.fbq("track", "CompleteRegistration", {
          user_role: params.userRole,
          eventID: params.eventId,
        });
        console.log("[FB Pixel] CompleteRegistration tracked client-side:", params);
      } else {
        console.warn("[FB Pixel] fbq not available");
      }
    },
    []
  );

  const trackPageView = useCallback(() => {
    if (typeof window !== "undefined" && window.fbq) {
      window.fbq("track", "PageView");
    }
  }, []);

  const trackCustomEvent = useCallback(
    (eventName: string, params?: Record<string, unknown>, eventId?: string) => {
      if (typeof window !== "undefined" && window.fbq) {
        const eventParams = eventId ? { ...params, eventID: eventId } : params;
        window.fbq("track", eventName, eventParams);
        console.log(`[FB Pixel] ${eventName} tracked client-side:`, eventParams);
      }
    },
    []
  );

  return {
    trackCompleteRegistration,
    trackPageView,
    trackCustomEvent,
    generateEventId,
  };
}
