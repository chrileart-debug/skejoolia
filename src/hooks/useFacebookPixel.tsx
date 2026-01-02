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

interface PurchaseParams {
  value: number;
  currency?: string;
  contentName?: string;
  contentType?: string;
  eventId: string;
}

interface LeadParams {
  contentName?: string;
  eventId?: string;
  email?: string;
  phone?: string;
  name?: string;
}

interface InitiateCheckoutParams {
  value?: number;
  currency?: string;
  contentName?: string;
  eventId?: string;
}

export function useFacebookPixel() {
  // Guards to prevent duplicate event firing
  const hasFiredRegistration = useRef(false);
  const hasFiredLead = useRef(false);
  const hasFiredCheckout = useRef(false);
  const lastCheckoutEventId = useRef<string | null>(null);

  /**
   * Tracks CompleteRegistration event on BOTH browser and CAPI with proper deduplication.
   * This is the ONLY place CompleteRegistration should be called from.
   */
  const trackCompleteRegistration = useCallback(
    async (params: CompleteRegistrationParams) => {
      if (hasFiredRegistration.current) {
        console.log("[FB Pixel] CompleteRegistration already fired, skipping");
        return;
      }
      hasFiredRegistration.current = true;

      const { eventId, userRole = "owner", email, phone, name, userId } = params;

      // Browser event
      if (typeof window !== "undefined" && window.fbq) {
        window.fbq("track", "CompleteRegistration", {
          content_name: userRole,
          eventID: eventId,
        });
        console.log("[FB Pixel] CompleteRegistration (browser):", eventId);
      }

      // CAPI event
      try {
        const { error } = await supabase.functions.invoke("fb-conversions", {
          body: {
            event_name: "CompleteRegistration",
            event_id: eventId,
            role: userRole,
            user_id: userId,
            email,
            phone,
            name,
          },
        });

        if (error) {
          console.error("[FB Pixel] CAPI CompleteRegistration error:", error);
        } else {
          console.log("[FB Pixel] CompleteRegistration (CAPI):", eventId);
        }
      } catch (err) {
        console.error("[FB Pixel] CAPI CompleteRegistration exception:", err);
      }
    },
    []
  );

  /**
   * Reset the registration guard
   */
  const resetRegistrationGuard = useCallback(() => {
    hasFiredRegistration.current = false;
  }, []);

  /**
   * Tracks Purchase event on BOTH browser and CAPI with proper deduplication.
   */
  const trackPurchaseWithCAPI = useCallback(
    async (params: PurchaseParams) => {
      const { value, currency = "BRL", contentName, contentType = "subscription", eventId } = params;

      // Browser event
      if (typeof window !== "undefined" && window.fbq) {
        window.fbq("track", "Purchase", {
          value,
          currency,
          content_name: contentName,
          content_type: contentType,
          eventID: eventId,
        });
        console.log("[FB Pixel] Purchase (browser):", { eventId, value });
      }

      // CAPI event
      try {
        const { error } = await supabase.functions.invoke("fb-conversions", {
          body: {
            event_name: "Purchase",
            event_id: eventId,
            value,
            currency,
            content_name: contentName,
            content_type: contentType,
          },
        });

        if (error) {
          console.error("[FB Pixel] CAPI Purchase error:", error);
        } else {
          console.log("[FB Pixel] Purchase (CAPI):", eventId);
        }
      } catch (err) {
        console.error("[FB Pixel] CAPI Purchase exception:", err);
      }
    },
    []
  );

  /**
   * Browser-only Purchase (legacy compatibility)
   */
  const trackPurchase = useCallback(
    (params: PurchaseParams) => {
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

  /**
   * Tracks Lead event on BOTH browser and CAPI with proper deduplication.
   */
  const trackLeadWithCAPI = useCallback(
    async (params: LeadParams = {}) => {
      if (hasFiredLead.current) {
        console.log("[FB Pixel] Lead already fired, skipping");
        return;
      }
      hasFiredLead.current = true;

      const eventId = params.eventId || generateEventId();

      // Browser event
      if (typeof window !== "undefined" && window.fbq) {
        const eventParams: Record<string, unknown> = { eventID: eventId };
        if (params.contentName) eventParams.content_name = params.contentName;
        window.fbq("track", "Lead", eventParams);
        console.log("[FB Pixel] Lead (browser):", eventId);
      }

      // CAPI event
      try {
        const { error } = await supabase.functions.invoke("fb-conversions", {
          body: {
            event_name: "Lead",
            event_id: eventId,
            content_name: params.contentName,
            email: params.email,
            phone: params.phone,
            name: params.name,
          },
        });

        if (error) {
          console.error("[FB Pixel] CAPI Lead error:", error);
        } else {
          console.log("[FB Pixel] Lead (CAPI):", eventId);
        }
      } catch (err) {
        console.error("[FB Pixel] CAPI Lead exception:", err);
      }
    },
    []
  );

  /**
   * Browser-only Lead (legacy compatibility)
   */
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

  /**
   * Reset Lead guard (e.g., after navigation or new checkout flow)
   */
  const resetLeadGuard = useCallback(() => {
    hasFiredLead.current = false;
  }, []);

  /**
   * Tracks InitiateCheckout event on BOTH browser and CAPI with proper deduplication.
   * Allows re-firing if a new eventId is provided.
   */
  const trackInitiateCheckoutWithCAPI = useCallback(
    async (params: InitiateCheckoutParams = {}) => {
      const eventId = params.eventId || generateEventId();

      // Allow re-fire if different eventId (new checkout attempt)
      if (hasFiredCheckout.current && lastCheckoutEventId.current === eventId) {
        console.log("[FB Pixel] InitiateCheckout already fired for this eventId, skipping");
        return;
      }
      
      hasFiredCheckout.current = true;
      lastCheckoutEventId.current = eventId;

      // Browser event
      if (typeof window !== "undefined" && window.fbq) {
        const eventParams: Record<string, unknown> = { eventID: eventId };
        if (params.value !== undefined) eventParams.value = params.value;
        if (params.currency) eventParams.currency = params.currency;
        if (params.contentName) eventParams.content_name = params.contentName;
        window.fbq("track", "InitiateCheckout", eventParams);
        console.log("[FB Pixel] InitiateCheckout (browser):", { eventId, value: params.value });
      }

      // CAPI event
      try {
        const { error } = await supabase.functions.invoke("fb-conversions", {
          body: {
            event_name: "InitiateCheckout",
            event_id: eventId,
            value: params.value,
            currency: params.currency || "BRL",
            content_name: params.contentName,
          },
        });

        if (error) {
          console.error("[FB Pixel] CAPI InitiateCheckout error:", error);
        } else {
          console.log("[FB Pixel] InitiateCheckout (CAPI):", eventId);
        }
      } catch (err) {
        console.error("[FB Pixel] CAPI InitiateCheckout exception:", err);
      }
    },
    []
  );

  /**
   * Browser-only InitiateCheckout (legacy compatibility)
   */
  const trackInitiateCheckout = useCallback(
    (params: InitiateCheckoutParams = {}) => {
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

  /**
   * Reset InitiateCheckout guard
   */
  const resetCheckoutGuard = useCallback(() => {
    hasFiredCheckout.current = false;
    lastCheckoutEventId.current = null;
  }, []);

  /**
   * Track custom event (browser only)
   */
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
    // Registration
    trackCompleteRegistration,
    resetRegistrationGuard,
    // Purchase
    trackPurchase,
    trackPurchaseWithCAPI,
    // Lead
    trackLead,
    trackLeadWithCAPI,
    resetLeadGuard,
    // Checkout
    trackInitiateCheckout,
    trackInitiateCheckoutWithCAPI,
    resetCheckoutGuard,
    // Custom
    trackCustomEvent,
    // Utils
    generateEventId,
  };
}
