import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ASAAS_API_URL = "https://api.asaas.com/v3";

interface CheckoutRequest {
  action: string;
  user_id: string;
  barbershop_id: string;
  plan_slug: string;
  event_id?: string;
  subscription_id?: string;
}

interface Plan {
  id: string;
  name: string;
  slug: string;
  price: number;
}

interface Barbershop {
  id: string;
  name: string;
  asaas_customer_id: string | null;
}

interface UserSettings {
  nome: string | null;
  email: string | null;
  numero: string | null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
    if (!ASAAS_API_KEY) {
      console.error("ASAAS_API_KEY not configured");
      throw new Error("ASAAS_API_KEY não configurada");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: CheckoutRequest = await req.json();
    console.log("Checkout request received:", JSON.stringify(body));

    const { action, user_id, barbershop_id, plan_slug, event_id, subscription_id } = body;

    if (action !== "create_checkout") {
      throw new Error("Ação inválida");
    }

    if (!user_id || !barbershop_id || !plan_slug) {
      throw new Error("Dados obrigatórios faltando: user_id, barbershop_id, plan_slug");
    }

    // 1. Check for existing valid session_checkout
    const { data: existingSession, error: sessionError } = await supabase
      .from("session_checkout")
      .select("*")
      .eq("user_id", user_id)
      .eq("barbershop_id", barbershop_id)
      .neq("status", "EXPIRED")
      .neq("status", "COMPLETED")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (existingSession && !sessionError) {
      console.log("Existing valid session found:", existingSession.id);
      return new Response(
        JSON.stringify({
          checkout_url: existingSession.asaas_checkout_link,
          checkout_id: existingSession.asaas_checkout_id,
          session_id: existingSession.id,
          is_existing: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Get plan details
    const { data: plan, error: planError } = await supabase
      .from("plans")
      .select("*")
      .eq("slug", plan_slug)
      .eq("is_active", true)
      .single();

    if (planError || !plan) {
      console.error("Plan not found:", planError);
      throw new Error("Plano não encontrado");
    }

    console.log("Plan found:", plan.name, plan.price);

    // 3. Get barbershop details
    const { data: barbershop, error: barbershopError } = await supabase
      .from("barbershops")
      .select("*")
      .eq("id", barbershop_id)
      .single();

    if (barbershopError || !barbershop) {
      console.error("Barbershop not found:", barbershopError);
      throw new Error("Empresa não encontrada");
    }

    // 4. Get user settings
    const { data: userSettings } = await supabase
      .from("user_settings")
      .select("nome, email, numero")
      .eq("user_id", user_id)
      .single();

    // 5. Build successUrl with event_id for Facebook Pixel deduplication
    const baseSuccessUrl = "https://app.skejool.com.br/obrigado";
    const successParams = new URLSearchParams({
      ...(event_id && { event_id }),
      plan: plan_slug,
      value: plan.price.toString(),
      type: "upgrade",
    });
    const successUrl = `${baseSuccessUrl}?${successParams.toString()}`;

    console.log("Success URL:", successUrl);

    // 6. Build external reference for webhook identification
    const externalReference = JSON.stringify({
      user_id,
      barbershop_id,
      plan_slug,
      subscription_id,
      event_id,
    });

    // 7. Create Asaas Checkout Session
    const asaasPayload = {
      name: `Assinatura ${plan.name}`,
      billingType: "UNDEFINED", // Let user choose payment method
      chargeType: "RECURRING",
      cycle: "MONTHLY",
      value: plan.price,
      endDate: null,
      maxInstallmentCount: 1,
      dueDateLimitDays: 3,
      notificationEnabled: true,
      externalReference,
      callback: {
        successUrl,
        autoRedirect: true,
      },
    };

    console.log("Creating Asaas checkout with payload:", JSON.stringify(asaasPayload));

    const asaasResponse = await fetch(`${ASAAS_API_URL}/checkoutSessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access_token": ASAAS_API_KEY,
      },
      body: JSON.stringify(asaasPayload),
    });

    const asaasData = await asaasResponse.json();

    if (!asaasResponse.ok) {
      console.error("Asaas API error:", JSON.stringify(asaasData));
      throw new Error(asaasData.errors?.[0]?.description || "Erro ao criar checkout no Asaas");
    }

    console.log("Asaas checkout created:", JSON.stringify(asaasData));

    // 8. Save session to database
    const { data: newSession, error: insertError } = await supabase
      .from("session_checkout")
      .insert({
        user_id,
        barbershop_id,
        asaas_checkout_id: asaasData.id,
        asaas_checkout_link: asaasData.url,
        plan_name: plan.name,
        plan_price: plan.price,
        status: "pending",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error saving session:", insertError);
      // Don't throw - we still have the checkout URL
    }

    console.log("Session saved successfully:", newSession?.id);

    return new Response(
      JSON.stringify({
        checkout_url: asaasData.url,
        checkout_id: asaasData.id,
        session_id: newSession?.id,
        is_existing: false,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Checkout error:", error);
    const message = error instanceof Error ? error.message : "Erro interno";
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
