import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CHECKOUT_EXPIRY_MINUTES = 10;
const ASAAS_API_URL = "https://api.asaas.com/v3";

function formatDateForAsaas(date: Date): string {
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

// Call Asaas API DIRECTLY (no N8N proxy)
async function callAsaasDirect(method: string, endpoint: string, body: unknown | null): Promise<Response> {
  const apiKey = Deno.env.get("ASAAS_API_KEY");
  
  if (!apiKey) {
    throw new Error("ASAAS_API_KEY não configurada");
  }

  const url = `${ASAAS_API_URL}${endpoint}`;
  console.log(`Calling Asaas DIRECT: ${method} ${url}`);
  
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

interface CheckoutRequest {
  action: string;
  user_id: string;
  barbershop_id: string;
  plan_slug: string;
  event_id?: string;
  subscription_id?: string;
  checkout_type?: string; // "subscribe" | "upgrade" | "renew"
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: CheckoutRequest = await req.json();
    console.log("Checkout request received:", JSON.stringify(body));

    const { action, user_id, barbershop_id, plan_slug, event_id, subscription_id, checkout_type } = body;

    if (action !== "create_checkout") {
      throw new Error("Ação inválida");
    }

    if (!user_id || !barbershop_id || !plan_slug) {
      throw new Error("Dados obrigatórios faltando: user_id, barbershop_id, plan_slug");
    }

    // 1. Get plan details FIRST to filter sessions by plan
    const { data: plan, error: planError } = await supabase
      .from("plans")
      .select("*")
      .eq("slug", plan_slug)
      .eq("is_active", true)
      .single();

    if (planError || !plan) {
      console.error("Plan not found:", planError);
      throw new Error(`Plano não encontrado: ${plan_slug}`);
    }

    console.log("Plan found:", plan.name, "price:", plan.price);

    // 2. Check for existing valid session_checkout for THIS SPECIFIC PLAN
    const tenMinutesAgo = new Date(Date.now() - CHECKOUT_EXPIRY_MINUTES * 60 * 1000).toISOString();
    
    const { data: existingSession } = await supabase
      .from("session_checkout")
      .select("*")
      .eq("user_id", user_id)
      .eq("barbershop_id", barbershop_id)
      .eq("plan_name", plan.name)
      .not("status", "in", '("EXPIRED","COMPLETED","CANCELED")')
      .gte("created_at", tenMinutesAgo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    console.log("Session lookup for plan:", plan.name, "found:", existingSession?.id || "none");

    if (existingSession?.asaas_checkout_link) {
      console.log("Reusing existing valid session:", existingSession.id);
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

    // 3. Mark old pending sessions for THIS PLAN ONLY as expired
    await supabase
      .from("session_checkout")
      .update({ status: "EXPIRED", updated_at: new Date().toISOString() })
      .eq("user_id", user_id)
      .eq("barbershop_id", barbershop_id)
      .eq("plan_name", plan.name)
      .eq("status", "pending");

    // 4. Get barbershop details
    const { data: barbershop, error: barbershopError } = await supabase
      .from("barbershops")
      .select("id, name, asaas_customer_id")
      .eq("id", barbershop_id)
      .single();

    if (barbershopError || !barbershop) {
      console.error("Barbershop not found:", barbershopError);
      throw new Error("Empresa não encontrada");
    }

    // 5. Build successUrl with event_id for Facebook Pixel deduplication
    const baseSuccessUrl = "https://app.skejool.com.br/obrigado";
    const successParams = new URLSearchParams();
    if (event_id) successParams.set("event_id", event_id);
    successParams.set("plan", plan_slug);
    successParams.set("value", plan.price.toString());
    successParams.set("type", checkout_type || "subscribe");
    
    const successUrl = `${baseSuccessUrl}?${successParams.toString()}`;
    const cancelUrl = "https://app.skejool.com.br/dashboard";
    const expiredUrl = "https://app.skejool.com.br/dashboard";
    console.log("Success URL:", successUrl);

    // 6. Build external reference for webhook identification
    const externalReference = JSON.stringify({
      user_id,
      barbershop_id,
      plan_slug,
      subscription_id,
      event_id,
      checkout_type: checkout_type || "subscribe",
    });

    // 7. Calculate next due date
    const nextDueDate = formatDateForAsaas(new Date());

    // 8. Create Asaas Checkout Session DIRECTLY (no N8N proxy!)
    const asaasPayload = {
      billingTypes: ["CREDIT_CARD"],
      chargeTypes: ["RECURRENT"],
      minutesToExpire: CHECKOUT_EXPIRY_MINUTES,
      callback: {
        successUrl,
        cancelUrl,
        expiredUrl,
        autoRedirect: true,
      },
      items: [{
        name: `Assinatura ${plan.name}`,
        description: `Plano ${plan.name} - Mensal`,
        quantity: 1,
        value: plan.price,
      }],
      subscription: {
        cycle: "MONTHLY",
        nextDueDate,
      },
      externalReference,
    };

    console.log("Creating Asaas checkout DIRECT with payload:", JSON.stringify(asaasPayload));

    const asaasResponse = await callAsaasDirect("POST", "/checkoutSessions", asaasPayload);

    const responseText = await asaasResponse.text();
    console.log("Asaas response status:", asaasResponse.status);
    console.log("Asaas response body:", responseText.substring(0, 500));

    // Check if response is HTML (error page)
    if (responseText.trim().startsWith("<!") || responseText.trim().startsWith("<html")) {
      console.error("Asaas returned HTML instead of JSON");
      throw new Error("Erro de comunicação com Asaas - verifique a API key");
    }

    let asaasData;
    try {
      asaasData = JSON.parse(responseText);
    } catch {
      console.error("Failed to parse Asaas response:", responseText.substring(0, 200));
      throw new Error("Resposta inválida do Asaas");
    }

    if (!asaasResponse.ok) {
      console.error("Asaas API error:", JSON.stringify(asaasData));
      const errorMsg = asaasData.errors?.[0]?.description || asaasData.message || `Erro Asaas: ${asaasResponse.status}`;
      throw new Error(errorMsg);
    }

    console.log("Asaas checkout created successfully:", asaasData.id);

    // Use the link or url property from Asaas response
    const checkoutUrl = asaasData.link || asaasData.url || `https://www.asaas.com/checkoutSession/show/${asaasData.id}`;
    console.log("Checkout URL:", checkoutUrl);

    // 9. Save or update session in database
    const { data: expiredSession } = await supabase
      .from("session_checkout")
      .select("id")
      .eq("user_id", user_id)
      .eq("barbershop_id", barbershop_id)
      .eq("plan_name", plan.name)
      .eq("status", "EXPIRED")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let newSession;
    let dbError;

    if (expiredSession) {
      console.log("Updating expired session:", expiredSession.id);
      const result = await supabase
        .from("session_checkout")
        .update({
          asaas_checkout_id: asaasData.id,
          asaas_checkout_link: checkoutUrl,
          plan_price: plan.price,
          status: "pending",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", expiredSession.id)
        .select()
        .single();
      
      newSession = result.data;
      dbError = result.error;
    } else {
      console.log("Creating new checkout session for plan:", plan.name);
      const result = await supabase
        .from("session_checkout")
        .insert({
          user_id,
          barbershop_id,
          asaas_checkout_id: asaasData.id,
          asaas_checkout_link: checkoutUrl,
          plan_name: plan.name,
          plan_price: plan.price,
          status: "pending",
        })
        .select()
        .single();
      
      newSession = result.data;
      dbError = result.error;
    }

    if (dbError) {
      console.error("Error saving session:", dbError);
      // Continue anyway - we have the URL
    }

    console.log("Session saved:", newSession?.id);

    return new Response(
      JSON.stringify({
        checkout_url: checkoutUrl,
        link: checkoutUrl,
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
