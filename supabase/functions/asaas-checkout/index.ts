import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CHECKOUT_EXPIRY_MINUTES = 10;

function formatDateForAsaas(date: Date): string {
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

// Call N8N Proxy (proven to work!)
async function callAsaasProxy(method: string, endpoint: string, body: unknown | null): Promise<Response> {
  const proxyUrl = Deno.env.get("ASAAS_PROXY_URL");
  const proxyToken = Deno.env.get("ASAAS_PROXY_TOKEN");

  if (!proxyUrl || !proxyToken) {
    throw new Error("PROXY_NOT_CONFIGURED");
  }

  const url = `${proxyUrl}${endpoint}`;
  console.log(`Calling Asaas via PROXY: ${method} ${url}`);

  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${proxyToken}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  return response;
}

// Call Asaas API DIRECTLY (fallback)
async function callAsaasDirect(method: string, endpoint: string, body: unknown | null): Promise<Response> {
  const apiKey = Deno.env.get("ASAAS_API_KEY");
  
  if (!apiKey) {
    throw new Error("ASAAS_API_KEY não configurada");
  }

  // Try both possible base URLs
  const baseUrls = [
    "https://api.asaas.com/v3",
    "https://www.asaas.com/api/v3"
  ];

  let lastResponse: Response | null = null;

  for (const baseUrl of baseUrls) {
    const url = `${baseUrl}${endpoint}`;
    console.log(`Trying Asaas DIRECT: ${method} ${url}`);
    
    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "access_token": apiKey,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      // If not 404, use this response
      if (response.status !== 404) {
        return response;
      }
      
      lastResponse = response;
      console.log(`Got 404 from ${url}, trying next...`);
    } catch (e) {
      console.error(`Error calling ${url}:`, e);
    }
  }

  // Return last response or throw
  if (lastResponse) return lastResponse;
  throw new Error("All Asaas endpoints failed");
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

    // 8. Build the checkout payload
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

    console.log("Creating Asaas checkout with payload:", JSON.stringify(asaasPayload));

    // 9. Try PROXY first (N8N - proven to work), fallback to DIRECT
    let asaasData: { id?: string; link?: string; url?: string; errors?: Array<{ description: string }>; message?: string } | null = null;
    let provider = "proxy";
    let responseOk = false;

    // Try N8N Proxy first
    try {
      console.log("Attempting N8N PROXY...");
      const proxyResponse = await callAsaasProxy("POST", "/checkouts", asaasPayload);
      const proxyText = await proxyResponse.text();
      console.log("Proxy response status:", proxyResponse.status);
      console.log("Proxy response body:", proxyText.substring(0, 500));

      if (proxyResponse.ok && !proxyText.includes("<!doctype") && !proxyText.includes("<html")) {
        try {
          asaasData = JSON.parse(proxyText);
          if (asaasData?.id) {
            responseOk = true;
            console.log("PROXY succeeded with id:", asaasData.id);
          }
        } catch {
          console.error("Failed to parse proxy response");
        }
      }
    } catch (proxyError) {
      console.error("Proxy failed:", proxyError);
    }

    // If proxy failed, try DIRECT
    if (!responseOk) {
      console.log("Proxy failed or returned error, trying DIRECT...");
      provider = "direct";

      // Try multiple endpoints
      const endpoints = ["/checkouts", "/checkoutSessions"];
      
      for (const endpoint of endpoints) {
        try {
          console.log(`Trying direct endpoint: ${endpoint}`);
          const directResponse = await callAsaasDirect("POST", endpoint, asaasPayload);
          const directText = await directResponse.text();
          console.log(`Direct ${endpoint} status:`, directResponse.status);
          console.log(`Direct ${endpoint} body:`, directText.substring(0, 500));

          // Skip if HTML response
          if (directText.includes("<!doctype") || directText.includes("<html")) {
            console.log(`Endpoint ${endpoint} returned HTML, trying next...`);
            continue;
          }

          if (directResponse.ok) {
            try {
              asaasData = JSON.parse(directText);
              if (asaasData?.id) {
                responseOk = true;
                console.log(`DIRECT ${endpoint} succeeded with id:`, asaasData.id);
                break;
              }
            } catch {
              console.error("Failed to parse direct response");
            }
          }
        } catch (e) {
          console.error(`Direct ${endpoint} failed:`, e);
        }
      }
    }

    // If both failed, throw error
    if (!responseOk || !asaasData?.id) {
      console.error("All checkout attempts failed");
      throw new Error("Falha ao criar checkout - tente novamente em alguns minutos");
    }

    console.log(`Checkout created via ${provider}:`, asaasData.id);

    // 10. Build checkout URL
    const checkoutUrl = asaasData.link || asaasData.url || `https://www.asaas.com/c/${asaasData.id}`;
    console.log("Final checkout URL:", checkoutUrl);

    // 11. Save or update session in database
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

    console.log("Session saved:", newSession?.id, "provider:", provider);

    return new Response(
      JSON.stringify({
        checkout_url: checkoutUrl,
        link: checkoutUrl,
        checkout_id: asaasData.id,
        session_id: newSession?.id,
        is_existing: false,
        provider,
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
