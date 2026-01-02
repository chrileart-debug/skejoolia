import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CHECKOUT_EXPIRY_MINUTES = 10;

function formatDateForAsaas(date: Date): string {
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

// Helper function to call Asaas via N8N proxy
async function callAsaasProxy(method: string, endpoint: string, body: unknown | null): Promise<Response> {
  const proxyUrl = Deno.env.get("ASAAS_PROXY_URL");
  const proxyToken = Deno.env.get("ASAAS_PROXY_TOKEN");
  
  if (!proxyUrl || !proxyToken) {
    throw new Error("ASAAS_PROXY_URL ou ASAAS_PROXY_TOKEN não configurados");
  }

  console.log(`Calling Asaas proxy: ${method} ${endpoint}`);
  
  const response = await fetch(proxyUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-proxy-token": proxyToken,
    },
    body: JSON.stringify({
      method,
      endpoint,
      body,
    }),
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

    // 1. Check for existing valid session_checkout (within 10 minutes)
    const tenMinutesAgo = new Date(Date.now() - CHECKOUT_EXPIRY_MINUTES * 60 * 1000).toISOString();
    
    const { data: existingSession } = await supabase
      .from("session_checkout")
      .select("*")
      .eq("user_id", user_id)
      .eq("barbershop_id", barbershop_id)
      .not("status", "in", '("EXPIRED","COMPLETED","CANCELED")')
      .gte("created_at", tenMinutesAgo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingSession?.asaas_checkout_link) {
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

    // Mark old pending sessions as expired
    await supabase
      .from("session_checkout")
      .update({ status: "EXPIRED", updated_at: new Date().toISOString() })
      .eq("user_id", user_id)
      .eq("barbershop_id", barbershop_id)
      .eq("status", "pending");

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
      .select("id, name, asaas_customer_id")
      .eq("id", barbershop_id)
      .single();

    if (barbershopError || !barbershop) {
      console.error("Barbershop not found:", barbershopError);
      throw new Error("Empresa não encontrada");
    }

    // 4. Build successUrl with event_id for Facebook Pixel deduplication
    const baseSuccessUrl = "https://app.skejool.com.br/obrigado";
    const successParams = new URLSearchParams();
    if (event_id) successParams.set("event_id", event_id);
    successParams.set("plan", plan_slug);
    successParams.set("value", plan.price.toString());
    successParams.set("type", checkout_type || "subscribe");
    
    const successUrl = `${baseSuccessUrl}?${successParams.toString()}`;
    const cancelUrl = "https://app.skejool.com.br/planos";
    const expiredUrl = "https://app.skejool.com.br/planos";
    console.log("Success URL:", successUrl);

    // 5. Build external reference for webhook identification
    const externalReference = JSON.stringify({
      user_id,
      barbershop_id,
      plan_slug,
      subscription_id,
      event_id,
      checkout_type: checkout_type || "subscribe",
    });

    // 6. Calculate next due date (today or tomorrow depending on business rules)
    const nextDueDate = formatDateForAsaas(new Date());

    // 7. Create Asaas Checkout Session using proxy via N8N
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

    console.log("Creating Asaas checkout via proxy with payload:", JSON.stringify(asaasPayload));

    const asaasResponse = await callAsaasProxy("POST", "/checkouts", asaasPayload);

    // Handle response - check content type first
    const contentType = asaasResponse.headers.get("content-type") || "";
    const responseText = await asaasResponse.text();
    console.log("Asaas response status:", asaasResponse.status);
    console.log("Asaas response content-type:", contentType);
    console.log("Asaas response body (first 500 chars):", responseText.substring(0, 500));

    // Check if response is HTML (error page)
    if (contentType.includes("text/html") || responseText.trim().startsWith("<!")) {
      console.error("Asaas returned HTML instead of JSON - likely wrong endpoint or auth error");
      throw new Error("Erro de comunicação com Asaas - verifique a configuração da API");
    }

    let asaasData;
    try {
      asaasData = JSON.parse(responseText);
    } catch {
      console.error("Failed to parse Asaas response as JSON:", responseText.substring(0, 200));
      throw new Error("Resposta inválida do Asaas - verifique a API key e configuração");
    }

    if (!asaasResponse.ok) {
      console.error("Asaas API error:", JSON.stringify(asaasData));
      throw new Error(asaasData.errors?.[0]?.description || `Erro ao criar checkout no Asaas: ${asaasResponse.status}`);
    }

    console.log("Asaas checkout created:", JSON.stringify(asaasData));

    // Build checkout URL - Asaas checkouts use this format
    const checkoutUrl = asaasData.url || `https://asaas.com/checkoutSession/show?id=${asaasData.id}`;

    // 7. Save session to database
    const { data: newSession, error: insertError } = await supabase
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

    if (insertError) {
      console.error("Error saving session:", insertError);
      // Don't throw - we still have the checkout URL
    }

    console.log("Session saved successfully:", newSession?.id);

    return new Response(
      JSON.stringify({
        checkout_url: checkoutUrl,
        link: checkoutUrl, // For backward compatibility
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
