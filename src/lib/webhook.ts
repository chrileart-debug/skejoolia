import { supabase } from "@/integrations/supabase/client";

/**
 * Centralized webhook utility with JWT authentication
 * All external webhook calls should use this utility to ensure
 * proper authentication headers are included
 */

export const WEBHOOK_ENDPOINTS = {
  WHATSAPP_INTEGRATION: "https://webhook.lernow.com/webhook/integracao_whatsapp",
  WHATSAPP_STATUS: "https://webhook.lernow.com/webhook/integracao_whatsapp_status",
  ASAAS_CHECKOUT: "https://webhook.lernow.com/webhook/asaas-checkout-skejool",
  CRIAR_AGENTE_IA: "https://webhook.lernow.com/webhook/criar-agente-skejool",
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

  console.log("=== webhookRequest iniciado ===");
  console.log("URL:", url);
  console.log("Body:", body);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Add authentication header if required
    if (requireAuth) {
      const token = await getAuthToken();
      console.log("Token obtido:", token ? "Sim" : "Não");
      if (!token) {
        return { data: null, error: "Usuário não autenticado" };
      }
      headers["Authorization"] = `Bearer ${token}`;
    }

    console.log("Enviando requisição fetch...");
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    console.log("Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Webhook error response:", errorText);
      return { data: null, error: `Erro na requisição: ${response.status}` };
    }

    const data = await response.json();
    console.log("Response data:", data);
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

export async function createCheckoutSession(payload: {
  action: string;
  user_id: string;
  plan_slug: string;
  price: number;
  subscription_id: string;
  churn_survey?: Record<string, unknown>;
}): Promise<WebhookResponse<CheckoutResponse>> {
  return webhookRequest<CheckoutResponse>(WEBHOOK_ENDPOINTS.ASAAS_CHECKOUT, {
    body: payload,
  });
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
  user_id: string;
  prompt: string;
}): Promise<WebhookResponse<CriarAgenteIAResponse>> {
  return webhookRequest<CriarAgenteIAResponse>(WEBHOOK_ENDPOINTS.CRIAR_AGENTE_IA, {
    body: payload,
  });
}
