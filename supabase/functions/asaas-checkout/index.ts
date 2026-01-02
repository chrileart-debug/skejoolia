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

    // 1. Get plan details FIRST to filter sessions by plan
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

    // 2. Check for existing valid session_checkout for THIS SPECIFIC PLAN
    const tenMinutesAgo = new Date(Date.now() - CHECKOUT_EXPIRY_MINUTES * 60 * 1000).toISOString();
    
    const { data: existingSession } = await supabase
      .from("session_checkout")
      .select("*")
      .eq("user_id", user_id)
      .eq("barbershop_id", barbershop_id)
      .eq("plan_name", plan.name) // FILTRO POR PLANO!
      .not("status", "in", '("EXPIRED","COMPLETED","CANCELED")')
      .gte("created_at", tenMinutesAgo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    console.log("Session lookup for plan:", plan.name, "found:", existingSession?.id || "none");

    if (existingSession?.asaas_checkout_link) {
      console.log("Existing valid session found for plan:", plan.name, "session:", existingSession.id);
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
      .eq("plan_name", plan.name) // APENAS DO MESMO PLANO
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

    // 8. Create Asaas Checkout Session using proxy via N8N
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
      const parsed = JSON.parse(responseText);
      // Handle array response from N8N proxy
      asaasData = Array.isArray(parsed) ? parsed[0] : parsed;
    } catch {
      console.error("Failed to parse Asaas response as JSON:", responseText.substring(0, 200));
      throw new Error("Resposta inválida do Asaas - verifique a API key e configuração");
    }

    if (!asaasResponse.ok) {
      console.error("Asaas API error:", JSON.stringify(asaasData));
      throw new Error(asaasData.errors?.[0]?.description || `Erro ao criar checkout no Asaas: ${asaasResponse.status}`);
    }

    console.log("Asaas checkout created:", JSON.stringify(asaasData));

    // Use the link property from Asaas response (not url)
    const checkoutUrl = asaasData.link || `https://www.asaas.com/checkoutSession/show/${asaasData.id}`;
    console.log("Checkout URL:", checkoutUrl);

    // 9. Check if there's an expired session for this plan to UPDATE instead of INSERT
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
      // UPDATE existing expired session
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
      // INSERT new session
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
      // Don't throw - we still have the checkout URL
    }

    console.log("Session saved successfully:", newSession?.id, "for plan:", plan.name);

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
