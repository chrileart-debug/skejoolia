import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CHECKOUT_EXPIRY_MINUTES = 10;
const ASAAS_API_URL = "https://www.asaas.com/api/v3";

function formatDateForAsaas(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Chamada direta à API do Asaas (sem N8N)
async function callAsaas(method: string, endpoint: string, body: unknown | null): Promise<Response> {
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

interface CheckoutRequest {
  action: string;
  user_id: string;
  barbershop_id: string;
  plan_slug: string;
  event_id?: string;
  subscription_id?: string;
  checkout_type?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: CheckoutRequest = await req.json();
    console.log("Checkout request:", JSON.stringify(body));

    const { action, user_id, barbershop_id, plan_slug, event_id, subscription_id, checkout_type } = body;

    if (action !== "create_checkout") {
      throw new Error("Ação inválida");
    }

    if (!user_id || !barbershop_id || !plan_slug) {
      throw new Error("Dados obrigatórios faltando: user_id, barbershop_id, plan_slug");
    }

    // 1. Buscar plano
    const { data: plan, error: planError } = await supabase
      .from("plans")
      .select("*")
      .eq("slug", plan_slug)
      .eq("is_active", true)
      .single();

    if (planError || !plan) {
      console.error("Plano não encontrado:", planError);
      throw new Error(`Plano não encontrado: ${plan_slug}`);
    }

    console.log("Plano:", plan.name, "preço:", plan.price);

    // 2. Verificar sessão existente válida (< 10 minutos)
    const tenMinutesAgo = new Date(Date.now() - CHECKOUT_EXPIRY_MINUTES * 60 * 1000).toISOString();
    
    const { data: existingSession } = await supabase
      .from("session_checkout")
      .select("*")
      .eq("user_id", user_id)
      .eq("barbershop_id", barbershop_id)
      .eq("plan_name", plan.name)
      .eq("status", "pending")
      .gte("created_at", tenMinutesAgo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingSession?.asaas_checkout_link) {
      console.log("Reutilizando sessão existente:", existingSession.id);
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

    // 3. Marcar sessões antigas como EXPIRED
    await supabase
      .from("session_checkout")
      .update({ status: "EXPIRED", updated_at: new Date().toISOString() })
      .eq("user_id", user_id)
      .eq("barbershop_id", barbershop_id)
      .eq("plan_name", plan.name)
      .eq("status", "pending");

    // 4. Buscar dados da barbearia
    const { data: barbershop, error: barbershopError } = await supabase
      .from("barbershops")
      .select("id, name, asaas_customer_id")
      .eq("id", barbershop_id)
      .single();

    if (barbershopError || !barbershop) {
      console.error("Barbearia não encontrada:", barbershopError);
      throw new Error("Empresa não encontrada");
    }

    // 5. URLs de callback
    const baseSuccessUrl = "https://app.skejool.com.br/obrigado";
    const successParams = new URLSearchParams();
    if (event_id) successParams.set("event_id", event_id);
    successParams.set("plan", plan_slug);
    successParams.set("value", plan.price.toString());
    successParams.set("type", checkout_type || "subscribe");
    
    const successUrl = `${baseSuccessUrl}?${successParams.toString()}`;
    const cancelUrl = "https://app.skejool.com.br/dashboard";
    const expiredUrl = "https://app.skejool.com.br/dashboard";

    // 6. External reference para webhook
    const externalReference = JSON.stringify({
      user_id,
      barbershop_id,
      plan_slug,
      subscription_id,
      event_id,
      checkout_type: checkout_type || "subscribe",
    });

    // 7. Payload do checkout
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
        nextDueDate: formatDateForAsaas(new Date()),
      },
      externalReference,
    };

    console.log("Criando checkout no Asaas:", JSON.stringify(asaasPayload));

    // 8. Chamar API do Asaas diretamente
    const asaasResponse = await callAsaas("POST", "/checkouts", asaasPayload);
    const asaasText = await asaasResponse.text();
    
    console.log("Asaas status:", asaasResponse.status);
    console.log("Asaas response:", asaasText.substring(0, 500));

    if (!asaasResponse.ok) {
      console.error("Erro Asaas:", asaasText);
      throw new Error(`Erro ao criar checkout: ${asaasResponse.status}`);
    }

    const asaasData = JSON.parse(asaasText);

    if (!asaasData.id) {
      console.error("Resposta Asaas sem ID:", asaasData);
      throw new Error("Resposta inválida do Asaas");
    }

    // 9. Montar URL do checkout
    const checkoutUrl = asaasData.link || asaasData.url || `https://www.asaas.com/c/${asaasData.id}`;
    console.log("Checkout URL:", checkoutUrl);

    // 10. Salvar sessão no banco
    const { data: newSession, error: dbError } = await supabase
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

    if (dbError) {
      console.error("Erro ao salvar sessão:", dbError);
    }

    console.log("Sessão criada:", newSession?.id);

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
    console.error("Erro no checkout:", error);
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
