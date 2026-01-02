import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    fbq: (...args: unknown[]) => void;
  }
}

/**
 * Generates a unique event_id for Facebook deduplication between browser and CAPI.
 * Format: {userPart}_{timestamp}_{random}
 */
export function generateEventId(userId?: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const userPart = userId ? userId.substring(0, 8) : "anon";
  return `${userPart}_${timestamp}_${random}`;
}

interface CompleteRegistrationParams {
  eventId: string;
  userRole?: string;
  email?: string;
  phone?: string;
  name?: string;
  userId?: string;
}

export function useFacebookPixel() {
  // Guard to prevent duplicate event firing
  const hasFiredRegistration = useRef(false);

  /**
   * Tracks CompleteRegistration event on BOTH browser and CAPI with proper deduplication.
   * This is the ONLY place CompleteRegistration should be called from.
   * 
   * @param params - Event parameters including eventId for deduplication
   */
  const trackCompleteRegistration = useCallback(
    async (params: CompleteRegistrationParams) => {
      if (hasFiredRegistration.current) {
        return;
      }
      hasFiredRegistration.current = true;

      const { eventId, userRole = "owner", email, phone, name, userId } = params;

      if (typeof window !== "undefined" && window.fbq) {
        window.fbq("track", "CompleteRegistration", {
          content_name: userRole,
          eventID: eventId,
        });
      }

      try {
        const { error } = await supabase.functions.invoke("fb-conversions", {
          body: {
            event_id: eventId,
            role: userRole,
            user_id: userId,
            email: email,
            phone: phone,
            name: name,
          },
        });

        if (error) {
          console.error("[FB Pixel] CAPI CompleteRegistration error:", error);
        }
      } catch (err) {
        console.error("[FB Pixel] CAPI CompleteRegistration exception:", err);
      }
    },
    []
  );

  /**
   * Reset the guard (useful for testing or if user logs out and registers again)
   */
  const resetRegistrationGuard = useCallback(() => {
    hasFiredRegistration.current = false;
  }, []);

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
      }
    },
    []
  );

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
      }
    },
    []
  );

  const trackLead = useCallback(
    (params?: { contentName?: string; eventId?: string }) => {
      if (typeof window !== "undefined" && window.fbq) {
        const eventParams: Record<string, unknown> = {};
        if (params?.contentName) eventParams.content_name = params.contentName;
        if (params?.eventId) eventParams.eventID = params.eventId;
        
        window.fbq("track", "Lead", eventParams);
      }
    },
    []
  );

  const trackCustomEvent = useCallback(
    (eventName: string, params?: Record<string, unknown>, eventId?: string) => {
      if (typeof window !== "undefined" && window.fbq) {
        const eventParams = eventId ? { ...params, eventID: eventId } : params;
        window.fbq("track", eventName, eventParams);
      }
    },
    []
  );

  return {
    trackCompleteRegistration,
    resetRegistrationGuard,
    trackPurchase,
    trackInitiateCheckout,
    trackLead,
    trackCustomEvent,
    generateEventId,
  };
}
