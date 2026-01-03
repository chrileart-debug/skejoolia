import { supabase } from "@/integrations/supabase/client";

/**
 * Centralized webhook utility with JWT authentication
 * All external webhook calls should use this utility to ensure
 * proper authentication headers are included
 */

export const WEBHOOK_ENDPOINTS = {
  WHATSAPP_INTEGRATION: "https://webhook.lernow.com/webhook/integracao_whatsapp",
  WHATSAPP_STATUS: "https://webhook.lernow.com/webhook/integracao_whatsapp_status",
  CRIAR_AGENTE_IA: "https://webhook.lernow.com/webhook/criar-agente-skejool",
  NEW_USER_REGISTRATION: "https://webhook.lernow.com/webhook/novo-usuario-skejool",
} as const;

interface WebhookOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: Record<string, unknown>;
  requireAuth?: boolean;
}

interface WebhookResponse<T = unknown> {
  data: T | null;
  error: string | null;
}

/**
 * Get the current user's JWT token for authentication
 */
async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

/**
 * Make an authenticated webhook request
 * Includes JWT token in Authorization header for server-side validation
 */
export async function webhookRequest<T = unknown>(
  url: string,
  options: WebhookOptions = {}
): Promise<WebhookResponse<T>> {
  const { method = "POST", body, requireAuth = true } = options;

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (requireAuth) {
      const token = await getAuthToken();
      if (!token) {
        return { data: null, error: "Usuário não autenticado" };
      }
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      return { data: null, error: `Erro na requisição: ${response.status}` };
    }

    const data = await response.json();
    return { data: data as T, error: null };
  } catch (error) {
    console.error("Webhook request error:", error);
    return { 
      data: null, 
      error: error instanceof Error ? error.message : "Erro de conexão" 
    };
  }
}

// Typed helper functions for specific webhooks

export interface CheckoutResponse {
  link?: string;
  checkout_url?: string;
  checkout_id?: string;
  session_id?: string;
  is_existing?: boolean;
  error?: string;
}

export interface WhatsAppCreateResponse {
  instance?: {
    instanceId?: string;
  };
  qrcode?: {
    base64?: string;
  };
  error?: string;
}

export interface WhatsAppStatusResponse {
  instance?: {
    state?: string;
  };
  state?: string;
  error?: string;
}

/**
 * Create checkout session via Supabase Edge Function (NOT N8N)
 * This calls the asaas-checkout edge function directly
 */
export async function createCheckoutSession(payload: {
  action: string;
  user_id: string;
  plan_slug: string;
  price: number;
  subscription_id: string;
  barbershop_id: string;
  event_id?: string;
  churn_survey?: Record<string, unknown>;
  origin?: string;
}): Promise<WebhookResponse<CheckoutResponse>> {
  try {
    // Map old action names to checkout_type
    const checkoutType = payload.action === "subscribe" ? "subscribe" : 
                         payload.action === "upgrade" ? "upgrade" : 
                         payload.action === "renew" ? "renew" : "subscribe";

    // Usa origin do payload ou detecta automaticamente do browser
    const origin = payload.origin || (typeof window !== "undefined" ? window.location.origin : undefined);

    const { data, error } = await supabase.functions.invoke("asaas-checkout", {
      body: {
        action: "create_checkout",
        user_id: payload.user_id,
        barbershop_id: payload.barbershop_id,
        plan_slug: payload.plan_slug,
        subscription_id: payload.subscription_id,
        event_id: payload.event_id,
        checkout_type: checkoutType,
        origin,
      },
    });

    if (error) {
      console.error("Edge function error:", error);
      return { data: null, error: error.message || "Erro ao criar checkout" };
    }

    if (data?.error) {
      return { data: null, error: data.error };
    }

    return { data: data as CheckoutResponse, error: null };
  } catch (error) {
    console.error("Checkout session error:", error);
    return { 
      data: null, 
      error: error instanceof Error ? error.message : "Erro de conexão" 
    };
  }
}

export async function createWhatsAppInstance(payload: {
  event: string;
  instancia: string;
}): Promise<WebhookResponse<WhatsAppCreateResponse>> {
  return webhookRequest<WhatsAppCreateResponse>(WEBHOOK_ENDPOINTS.WHATSAPP_INTEGRATION, {
    body: payload,
  });
}

export async function connectWhatsAppInstance(payload: {
  event: string;
  instancia: string;
}): Promise<WebhookResponse<WhatsAppCreateResponse>> {
  return webhookRequest<WhatsAppCreateResponse>(WEBHOOK_ENDPOINTS.WHATSAPP_INTEGRATION, {
    body: payload,
  });
}

export async function checkWhatsAppStatus(payload: {
  event: string;
  instancia: string;
}): Promise<WebhookResponse<WhatsAppStatusResponse>> {
  return webhookRequest<WhatsAppStatusResponse>(WEBHOOK_ENDPOINTS.WHATSAPP_STATUS, {
    body: payload,
  });
}

export async function disconnectWhatsAppInstance(payload: {
  event: string;
  instancia: string;
}): Promise<WebhookResponse<unknown>> {
  return webhookRequest(WEBHOOK_ENDPOINTS.WHATSAPP_INTEGRATION, {
    body: payload,
  });
}

export async function deleteWhatsAppInstance(payload: {
  event: string;
  instancia: string;
}): Promise<WebhookResponse<unknown>> {
  return webhookRequest(WEBHOOK_ENDPOINTS.WHATSAPP_INTEGRATION, {
    body: payload,
  });
}

export interface CriarAgenteIAResponse {
  success?: boolean;
  error?: string;
}

export async function criarAgenteAutomatico(payload: {
  event: string;
  user_id: string;
  prompt: string;
}): Promise<WebhookResponse<CriarAgenteIAResponse>> {
  return webhookRequest<CriarAgenteIAResponse>(WEBHOOK_ENDPOINTS.CRIAR_AGENTE_IA, {
    body: payload,
  });
}

// Webhook para novo usuário cadastrado
export interface NewUserWebhookPayload {
  nome: string;
  numero: string;
  email: string;
  plano?: string;
  origem: "formulario" | "google";
  barbershop_id: string;
}

export async function sendNewUserWebhook(
  payload: NewUserWebhookPayload
): Promise<WebhookResponse<unknown>> {
  return webhookRequest(WEBHOOK_ENDPOINTS.NEW_USER_REGISTRATION, {
    body: payload as unknown as Record<string, unknown>,
    requireAuth: false, // Não requer auth pois pode ser chamado no momento do signup
  });
}

/**
 * Cancel subscription via Supabase Edge Function
 */
export async function cancelSubscription(payload: {
  user_id: string;
  subscription_id: string;
  asaas_subscription_id?: string | null;
  churn_survey?: Record<string, unknown>;
}): Promise<WebhookResponse<{ success: boolean }>> {
  try {
    const { data, error } = await supabase.functions.invoke("asaas-subscription-actions", {
      body: {
        action: "cancel",
        ...payload,
      },
    });

    if (error) {
      console.error("Cancel subscription error:", error);
      return { data: null, error: error.message || "Erro ao cancelar assinatura" };
    }

    if (data?.error) {
      return { data: null, error: data.error };
    }

    return { data: { success: true }, error: null };
  } catch (error) {
    console.error("Cancel subscription error:", error);
    return { 
      data: null, 
      error: error instanceof Error ? error.message : "Erro de conexão" 
    };
  }
}
