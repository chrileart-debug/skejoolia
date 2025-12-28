import { useCallback } from "react";

declare global {
  interface Window {
    fbq: (...args: unknown[]) => void;
  }
}

// Gera um event_id único para deduplicação entre client e server (CAPI)
export function generateEventId(userId?: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const userPart = userId ? userId.substring(0, 8) : "anon";
  return `${userPart}_${timestamp}_${random}`;
}

export function useFacebookPixel() {
  // Evento CompleteRegistration com event_id para deduplicação
  const trackCompleteRegistration = useCallback(
    (params: { userRole: string; eventId: string }) => {
      if (typeof window !== "undefined" && window.fbq) {
        window.fbq("track", "CompleteRegistration", {
          user_role: params.userRole,
          eventID: params.eventId,
        });
        console.log("[FB Pixel] CompleteRegistration tracked client-side:", params);
      } else {
        console.warn("[FB Pixel] fbq not available for CompleteRegistration");
      }
    },
    []
  );

  // Evento Purchase com event_id para deduplicação
  const trackPurchase = useCallback(
    (params: {
      value: number;
      currency?: string;
      contentName?: string;
      contentType?: string;
      eventId: string;
    }) => {
      if (typeof window !== "undefined" && window.fbq) {
        window.fbq("track", "Purchase", {
          value: params.value,
          currency: params.currency || "BRL",
          content_name: params.contentName,
          content_type: params.contentType || "subscription",
          eventID: params.eventId,
        });
        console.log("[FB Pixel] Purchase tracked client-side:", params);
      } else {
        console.warn("[FB Pixel] fbq not available for Purchase");
      }
    },
    []
  );

  // Evento InitiateCheckout (início do checkout)
  const trackInitiateCheckout = useCallback(
    (params: {
      value?: number;
      currency?: string;
      contentName?: string;
      eventId?: string;
    }) => {
      if (typeof window !== "undefined" && window.fbq) {
        const eventParams: Record<string, unknown> = {
          value: params.value,
          currency: params.currency || "BRL",
          content_name: params.contentName,
        };
        if (params.eventId) {
          eventParams.eventID = params.eventId;
        }
        window.fbq("track", "InitiateCheckout", eventParams);
        console.log("[FB Pixel] InitiateCheckout tracked client-side:", eventParams);
      }
    },
    []
  );

  // Evento Lead (captura de lead)
  const trackLead = useCallback(
    (params?: { contentName?: string; eventId?: string }) => {
      if (typeof window !== "undefined" && window.fbq) {
        const eventParams: Record<string, unknown> = {};
        if (params?.contentName) eventParams.content_name = params.contentName;
        if (params?.eventId) eventParams.eventID = params.eventId;
        
        window.fbq("track", "Lead", eventParams);
        console.log("[FB Pixel] Lead tracked client-side:", eventParams);
      }
    },
    []
  );

  // trackPageView removido - agora é automático via index.html + FacebookPixel.tsx

  // Evento customizado genérico
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
    trackPurchase,
    trackInitiateCheckout,
    trackLead,
    trackCustomEvent,
    generateEventId,
  };
}
