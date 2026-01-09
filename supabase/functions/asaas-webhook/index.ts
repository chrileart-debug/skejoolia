import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
}

// Parse externalReference no formato: skejool_userId_barbershopId_planSlug_subscriptionId_eventId_checkoutType_timestamp
function parseExternalReference(ref: string | undefined): ExternalReference | null {
  if (!ref) return null;

  // Primeiro tenta JSON (compatibilidade com formato antigo)
  try {
    const parsed = JSON.parse(ref);
    if (parsed.user_id) return parsed;
  } catch {
    // Não é JSON, continua para formato pipe
  }

  // Formato: skejool_userId_barbershopId_planSlug_subscriptionId_eventId_checkoutType_timestamp
  if (ref.startsWith("skejool_")) {
    const parts = ref.split("_");
    // skejool[0]_userId[1]_barbershopId[2]_planSlug[3]_subscriptionId[4]_eventId[5]_checkoutType[6]_timestamp[7+]
    if (parts.length >= 7) {
      return {
        user_id: parts[1],
        barbershop_id: parts[2],
        plan_slug: parts[3],
        subscription_id: parts[4] !== 'new' ? parts[4] : undefined,
        event_id: parts[5] !== 'none' ? parts[5] : undefined,
        checkout_type: parts[6],
      };
    }
  }

  console.error("Failed to parse externalReference:", ref);
  return null;
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
    console.log("Asaas webhook received:", JSON.stringify(payload));

    const { event } = payload;

    switch (event) {
      // ========== CHECKOUT EVENTS ==========
      case "CHECKOUT_CREATED":
      case "CHECKOUT_VIEWED":
        console.log(`Checkout event ${event} - logging only`);
        break;

      case "CHECKOUT_EXPIRED": {
        console.log("Processing CHECKOUT_EXPIRED");
        const checkoutId = payload.checkoutSession?.id;
        
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
        if (!ref) {
          console.log("No valid externalReference, skipping");
          break;
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
        } else {
          console.log("Payment record created:", payment.id);
        }
        break;
      }

      case "PAYMENT_CONFIRMED":
      case "PAYMENT_RECEIVED": {
        console.log(`Processing ${event}`);
        const payment = payload.payment;
        if (!payment) break;

        const ref = parseExternalReference(payment.externalReference);
        if (!ref) {
          console.log("No valid externalReference, skipping");
          break;
        }

        // 1. Update or insert payment record
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

        // 2. Update subscription status to active
        if (ref.subscription_id) {
          const { error: subError } = await supabase
            .from("subscriptions")
            .update({
              status: "active",
              plan_slug: ref.plan_slug,
              current_period_start: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", ref.subscription_id);

          if (subError) {
            console.error("Error updating subscription:", subError);
          } else {
            console.log("Subscription activated:", ref.subscription_id);
          }
        } else {
          // Try to find subscription by user_id and barbershop_id
          const { error: subError } = await supabase
            .from("subscriptions")
            .update({
              status: "active",
              plan_slug: ref.plan_slug,
              current_period_start: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", ref.user_id)
            .eq("barbershop_id", ref.barbershop_id);

          if (subError) {
            console.error("Error updating subscription by user:", subError);
          } else {
            console.log("Subscription activated by user_id:", ref.user_id);
          }
        }

        // 3. Update session_checkout to COMPLETED
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

        break;
      }

      case "PAYMENT_OVERDUE": {
        console.log("Processing PAYMENT_OVERDUE");
        const payment = payload.payment;
        if (!payment) break;

        const ref = parseExternalReference(payment.externalReference);
        if (!ref) break;

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
        if (!ref) break;

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
        break;
      }

      default:
        console.log(`Unhandled event type: ${event}`);
    }

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
