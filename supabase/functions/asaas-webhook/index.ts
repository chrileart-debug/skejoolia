// Asaas Webhook Handler - v2.0.0 (Audit Complete)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ASAAS_API_URL = "https://www.asaas.com/api/v3";

// Helper para chamar API do Asaas
async function callAsaas(method: string, endpoint: string, body: unknown | null = null): Promise<Response> {
  const apiKey = Deno.env.get("ASAAS_API_KEY");
  
  if (!apiKey) {
    throw new Error("ASAAS_API_KEY não configurada");
  }

  const url = `${ASAAS_API_URL}${endpoint}`;
  console.log(`Asaas API: ${method} ${url}`);

  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "access_token": apiKey,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  return response;
}

interface AsaasWebhookPayload {
  event: string;
  payment?: {
    id: string;
    customer: string;
    value: number;
    status: string;
    billingType: string;
    subscription?: string;
    externalReference?: string;
    invoiceUrl?: string;
    dueDate?: string;
    paymentDate?: string;
  };
  subscription?: {
    id: string;
    customer: string;
    value: number;
    status: string;
    externalReference?: string;
  };
  checkout?: {
    id: string;
    status: string;
    externalReference?: string;
  };
  checkoutSession?: {
    id: string;
    status: string;
    externalReference?: string;
  };
}

interface ExternalReference {
  user_id: string;
  barbershop_id: string;
  plan_slug: string;
  subscription_id?: string;
  event_id?: string;
  checkout_type?: string;
  old_asaas_subscription_id?: string;
}

// Parse externalReference no formato: skejool_userId_barbershopId_planSlug_subscriptionId_eventId_checkoutType_oldAsaasSubId_timestamp
function parseExternalReference(ref: string | undefined): ExternalReference | null {
  if (!ref) return null;

  // Primeiro tenta JSON (compatibilidade com formato antigo)
  try {
    const parsed = JSON.parse(ref);
    if (parsed.user_id) return parsed;
  } catch {
    // Não é JSON, continua para formato underscore
  }

  // Formato: skejool_userId_barbershopId_planSlug_subscriptionId_eventId_checkoutType_oldAsaasSubId_timestamp
  if (ref.startsWith("skejool_")) {
    const parts = ref.split("_");
    // skejool[0]_userId[1]_barbershopId[2]_planSlug[3]_subscriptionId[4]_eventId[5]_checkoutType[6]_oldAsaasSubId[7]_timestamp[8+]
    if (parts.length >= 7) {
      return {
        user_id: parts[1],
        barbershop_id: parts[2],
        plan_slug: parts[3],
        subscription_id: parts[4] !== 'new' ? parts[4] : undefined,
        event_id: parts[5] !== 'none' ? parts[5] : undefined,
        checkout_type: parts[6],
        old_asaas_subscription_id: parts.length >= 8 && parts[7] !== 'none' ? parts[7] : undefined,
      };
    }
  }

  console.error("Failed to parse externalReference:", ref);
  return null;
}

// Função para log de auditoria (apenas console para evitar problemas de tipo)
function logAudit(
  event: string,
  ref: ExternalReference | null,
  customerId: string | null | undefined,
  asaasPaymentId: string | null | undefined,
  asaasSubscriptionId: string | null | undefined,
  success: boolean,
  errorMessage: string | null = null
) {
  console.log(`[AUDIT] Event: ${event} | User: ${ref?.user_id} | Barbershop: ${ref?.barbershop_id} | Customer: ${customerId ?? 'N/A'} | Payment: ${asaasPaymentId ?? 'N/A'} | Sub: ${asaasSubscriptionId ?? 'N/A'} | Success: ${success}`);
  if (errorMessage) {
    console.error(`[AUDIT ERROR] ${errorMessage}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ========== TOKEN VERIFICATION ==========
  const webhookSecret = Deno.env.get("ASAAS_WEBHOOK_SECRET");
  const url = new URL(req.url);
  const tokenParam = url.searchParams.get("token");

  if (!webhookSecret) {
    console.error("ASAAS_WEBHOOK_SECRET not configured");
    return new Response(
      JSON.stringify({ error: "Webhook not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!tokenParam || tokenParam !== webhookSecret) {
    console.error("Invalid or missing webhook token");
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  // ========================================

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const payload: AsaasWebhookPayload = await req.json();
    console.log("=== ASAAS WEBHOOK v2.0 ===");
    console.log("Event:", payload.event);
    console.log("Full payload:", JSON.stringify(payload));

    const { event } = payload;

    switch (event) {
      // ========== CHECKOUT EVENTS ==========
      case "CHECKOUT_CREATED":
      case "CHECKOUT_VIEWED":
        console.log(`Checkout event ${event} - logging only`);
        break;

      case "CHECKOUT_EXPIRED": {
        console.log("Processing CHECKOUT_EXPIRED");
        const checkout = payload.checkoutSession || payload.checkout;
        const checkoutId = checkout?.id;
        
        if (checkoutId) {
          const { error } = await supabase
            .from("session_checkout")
            .update({ status: "EXPIRED", updated_at: new Date().toISOString() })
            .eq("asaas_checkout_id", checkoutId);

          if (error) {
            console.error("Error updating session_checkout:", error);
          } else {
            console.log("session_checkout marked as EXPIRED:", checkoutId);
          }
        }
        break;
      }

      // ========== PAYMENT EVENTS ==========
      case "PAYMENT_CREATED": {
        console.log("Processing PAYMENT_CREATED");
        const payment = payload.payment;
        if (!payment) break;

        const ref = parseExternalReference(payment.externalReference);
        const customerId = payment.customer;

        console.log("Customer ID from payment:", customerId);
        console.log("Parsed reference:", ref);

        if (!ref) {
          console.log("No valid externalReference, skipping");
          logAudit(event, null, customerId, payment.id, null, false, "No valid externalReference");
          break;
        }

        // Salvar asaas_customer_id na barbearia se ainda não tiver
        if (customerId && ref.barbershop_id) {
          const { data: barbershop } = await supabase
            .from("barbershops")
            .select("asaas_customer_id")
            .eq("id", ref.barbershop_id)
            .single();

          if (!barbershop?.asaas_customer_id) {
            const { error: updateError } = await supabase
              .from("barbershops")
              .update({ asaas_customer_id: customerId })
              .eq("id", ref.barbershop_id);

            if (updateError) {
              console.error("Error saving asaas_customer_id:", updateError);
            } else {
              console.log("asaas_customer_id saved to barbershop:", customerId);
            }
          }
        }

        // Insert payment record with pending status
        const { error } = await supabase.from("payments").insert({
          user_id: ref.user_id,
          barbershop_id: ref.barbershop_id,
          asaas_payment_id: payment.id,
          amount: payment.value,
          status: "pending",
          method: payment.billingType,
          due_date: payment.dueDate,
          invoice_url: payment.invoiceUrl,
          subscription_id: ref.subscription_id,
          raw: payload,
        });

        if (error) {
          console.error("Error inserting payment:", error);
          logAudit(event, ref, customerId, payment.id, null, false, error.message);
        } else {
          console.log("Payment record created:", payment.id);
          logAudit(event, ref, customerId, payment.id, null, true);
        }
        break;
      }

      case "PAYMENT_CONFIRMED":
      case "PAYMENT_RECEIVED": {
        console.log(`Processing ${event}`);
        const payment = payload.payment;
        if (!payment) break;

        const ref = parseExternalReference(payment.externalReference);
        const customerId = payment.customer;
        const asaasSubscriptionId = payment.subscription;

        console.log("Customer ID:", customerId);
        console.log("Asaas Subscription ID:", asaasSubscriptionId);
        console.log("Parsed reference:", ref);

        if (!ref) {
          console.log("No valid externalReference, skipping");
          logAudit(event, null, customerId, payment.id, asaasSubscriptionId, false, "No valid externalReference");
          break;
        }

        // ==========================================
        // 1. SALVAR CUSTOMER ID NA BARBEARIA
        // ==========================================
        if (customerId && ref.barbershop_id) {
          const { data: barbershop } = await supabase
            .from("barbershops")
            .select("asaas_customer_id")
            .eq("id", ref.barbershop_id)
            .single();

          if (!barbershop?.asaas_customer_id) {
            const { error: updateError } = await supabase
              .from("barbershops")
              .update({ asaas_customer_id: customerId })
              .eq("id", ref.barbershop_id);

            if (updateError) {
              console.error("Error saving asaas_customer_id:", updateError);
            } else {
              console.log("asaas_customer_id SAVED to barbershop:", customerId);
            }
          } else {
            console.log("asaas_customer_id already exists:", barbershop.asaas_customer_id);
          }
        }

        // ==========================================
        // 2. ATUALIZAR OU INSERIR PAGAMENTO
        // ==========================================
        const { data: existingPayment } = await supabase
          .from("payments")
          .select("id")
          .eq("asaas_payment_id", payment.id)
          .single();

        if (existingPayment) {
          await supabase
            .from("payments")
            .update({
              status: "paid",
              paid_at: payment.paymentDate || new Date().toISOString(),
              raw: payload,
            })
            .eq("asaas_payment_id", payment.id);
          console.log("Payment updated to paid:", payment.id);
        } else {
          await supabase.from("payments").insert({
            user_id: ref.user_id,
            barbershop_id: ref.barbershop_id,
            asaas_payment_id: payment.id,
            amount: payment.value,
            status: "paid",
            method: payment.billingType,
            paid_at: payment.paymentDate || new Date().toISOString(),
            due_date: payment.dueDate,
            invoice_url: payment.invoiceUrl,
            subscription_id: ref.subscription_id,
            raw: payload,
          });
          console.log("Payment record inserted as paid:", payment.id);
        }

        // ==========================================
        // 3. ATIVAR ASSINATURA E SALVAR ASAAS_SUBSCRIPTION_ID
        // ==========================================
        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        const subscriptionUpdate = {
          status: "active",
          plan_slug: ref.plan_slug,
          asaas_subscription_id: asaasSubscriptionId || undefined,
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          updated_at: now.toISOString(),
        };

        // Remove undefined values
        Object.keys(subscriptionUpdate).forEach(key => {
          if (subscriptionUpdate[key as keyof typeof subscriptionUpdate] === undefined) {
            delete subscriptionUpdate[key as keyof typeof subscriptionUpdate];
          }
        });

        if (ref.subscription_id) {
          const { error: subError } = await supabase
            .from("subscriptions")
            .update(subscriptionUpdate)
            .eq("id", ref.subscription_id);

          if (subError) {
            console.error("Error updating subscription:", subError);
          } else {
            console.log("Subscription activated:", ref.subscription_id);
          }
        } else {
          const { error: subError } = await supabase
            .from("subscriptions")
            .update(subscriptionUpdate)
            .eq("user_id", ref.user_id)
            .eq("barbershop_id", ref.barbershop_id);

          if (subError) {
            console.error("Error updating subscription by user:", subError);
          } else {
            console.log("Subscription activated by user_id:", ref.user_id);
          }
        }

        // ==========================================
        // 4. CANCELAR ASSINATURA ANTIGA NO ASAAS (SE UPGRADE)
        // ==========================================
        if (ref.checkout_type === "upgrade" && ref.old_asaas_subscription_id) {
          console.log("Upgrade detected - canceling old subscription:", ref.old_asaas_subscription_id);
          
          try {
            const deleteResponse = await callAsaas("DELETE", `/subscriptions/${ref.old_asaas_subscription_id}`);
            const deleteText = await deleteResponse.text();
            
            if (deleteResponse.ok) {
              console.log("Old Asaas subscription CANCELED successfully:", ref.old_asaas_subscription_id);
            } else {
              console.error("Failed to cancel old subscription:", deleteResponse.status, deleteText);
            }
          } catch (err) {
            console.error("Error canceling old subscription:", err);
          }
        }

        // ==========================================
        // 5. ATUALIZAR SESSION_CHECKOUT PARA COMPLETED
        // ==========================================
        const { error: sessionError } = await supabase
          .from("session_checkout")
          .update({ status: "COMPLETED", updated_at: new Date().toISOString() })
          .eq("user_id", ref.user_id)
          .eq("barbershop_id", ref.barbershop_id)
          .eq("status", "pending");

        if (sessionError) {
          console.error("Error updating session_checkout:", sessionError);
        } else {
          console.log("session_checkout marked as COMPLETED");
        }

        logAudit(event, ref, customerId, payment.id, asaasSubscriptionId, true);
        break;
      }

      case "PAYMENT_OVERDUE": {
        console.log("Processing PAYMENT_OVERDUE");
        const payment = payload.payment;
        if (!payment) break;

        const ref = parseExternalReference(payment.externalReference);
        if (!ref) {
          logAudit(event, null, payment.customer, payment.id, null, false, "No valid externalReference");
          break;
        }

        // Update payment status
        await supabase
          .from("payments")
          .update({ status: "overdue", raw: payload })
          .eq("asaas_payment_id", payment.id);

        // Update subscription status to past_due
        if (ref.subscription_id) {
          await supabase
            .from("subscriptions")
            .update({ status: "past_due", updated_at: new Date().toISOString() })
            .eq("id", ref.subscription_id);
        } else {
          await supabase
            .from("subscriptions")
            .update({ status: "past_due", updated_at: new Date().toISOString() })
            .eq("user_id", ref.user_id)
            .eq("barbershop_id", ref.barbershop_id);
        }

        console.log("Payment and subscription marked as overdue/past_due");
        logAudit(event, ref, payment.customer, payment.id, null, true);
        break;
      }

      case "PAYMENT_DELETED":
      case "PAYMENT_REFUNDED": {
        console.log(`Processing ${event}`);
        const payment = payload.payment;
        if (!payment) break;

        const status = event === "PAYMENT_DELETED" ? "deleted" : "refunded";
        await supabase
          .from("payments")
          .update({ status, raw: payload })
          .eq("asaas_payment_id", payment.id);

        console.log(`Payment marked as ${status}:`, payment.id);
        break;
      }

      // ========== SUBSCRIPTION EVENTS ==========
      case "SUBSCRIPTION_CREATED": {
        console.log("Processing SUBSCRIPTION_CREATED");
        const subscription = payload.subscription;
        if (!subscription) break;

        const ref = parseExternalReference(subscription.externalReference);
        const customerId = subscription.customer;

        console.log("Subscription customer ID:", customerId);
        console.log("Subscription Asaas ID:", subscription.id);

        if (!ref) {
          console.log("No valid externalReference for SUBSCRIPTION_CREATED");
          logAudit(event, null, customerId, null, subscription.id, false, "No valid externalReference");
          break;
        }

        // Salvar asaas_customer_id na barbearia
        if (customerId && ref.barbershop_id) {
          const { data: barbershop } = await supabase
            .from("barbershops")
            .select("asaas_customer_id")
            .eq("id", ref.barbershop_id)
            .single();

          if (!barbershop?.asaas_customer_id) {
            await supabase
              .from("barbershops")
              .update({ asaas_customer_id: customerId })
              .eq("id", ref.barbershop_id);
            console.log("asaas_customer_id saved from SUBSCRIPTION_CREATED:", customerId);
          }
        }

        // Update subscription with Asaas subscription ID
        if (ref.subscription_id) {
          await supabase
            .from("subscriptions")
            .update({
              asaas_subscription_id: subscription.id,
              updated_at: new Date().toISOString(),
            })
            .eq("id", ref.subscription_id);
        } else {
          await supabase
            .from("subscriptions")
            .update({
              asaas_subscription_id: subscription.id,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", ref.user_id)
            .eq("barbershop_id", ref.barbershop_id);
        }

        console.log("Subscription linked to Asaas:", subscription.id);
        logAudit(event, ref, customerId, null, subscription.id, true);
        break;
      }

      case "SUBSCRIPTION_UPDATED": {
        console.log("Processing SUBSCRIPTION_UPDATED");
        const subscription = payload.subscription;
        if (!subscription) break;

        const ref = parseExternalReference(subscription.externalReference);

        if (ref) {
          // Atualizar dados da assinatura se necessário
          await supabase
            .from("subscriptions")
            .update({
              updated_at: new Date().toISOString(),
            })
            .eq("asaas_subscription_id", subscription.id);

          console.log("Subscription updated:", subscription.id);
        }
        break;
      }

      case "SUBSCRIPTION_DELETED":
      case "SUBSCRIPTION_INACTIVATED": {
        console.log(`Processing ${event}`);
        const subscription = payload.subscription;
        if (!subscription) break;

        const ref = parseExternalReference(subscription.externalReference);

        // Update subscription status to canceled
        if (ref?.subscription_id) {
          await supabase
            .from("subscriptions")
            .update({ status: "canceled", updated_at: new Date().toISOString() })
            .eq("id", ref.subscription_id);
        } else if (subscription.id) {
          await supabase
            .from("subscriptions")
            .update({ status: "canceled", updated_at: new Date().toISOString() })
            .eq("asaas_subscription_id", subscription.id);
        }

        console.log("Subscription canceled:", subscription.id);
        logAudit(event, ref, subscription.customer, null, subscription.id, true);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event}`);
    }

    console.log("=== WEBHOOK PROCESSED SUCCESSFULLY ===");
    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Webhook processing error:", error);
    const message = error instanceof Error ? error.message : "Internal error";
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
