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

function formatTimestamp(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${day}/${month}/${year}-${hours}:${minutes}:${seconds}`;
}

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

    // 1. Buscar plano no banco de dados
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

    console.log("Plano encontrado:", plan.name, "- Preço:", plan.price);

    // 2. Verificar se existe sessão pendente válida (< 10 minutos)
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

    // 3. Marcar sessões antigas/expiradas como EXPIRED
    await supabase
      .from("session_checkout")
      .update({ status: "EXPIRED", updated_at: new Date().toISOString() })
      .eq("user_id", user_id)
      .eq("barbershop_id", barbershop_id)
      .in("status", ["pending", "EXPIRED"]);

    // 4. URLs de callback
    const baseSuccessUrl = "https://app.skejool.com.br/obrigado";
    const successParams = new URLSearchParams();
    if (event_id) successParams.set("event_id", event_id);
    successParams.set("plan", plan_slug);
    successParams.set("value", plan.price.toString());
    successParams.set("type", checkout_type || "subscribe");
    
    const successUrl = `${baseSuccessUrl}?${successParams.toString()}`;
    const cancelUrl = "https://app.skejool.com.br/dashboard";
    const expiredUrl = "https://app.skejool.com.br/dashboard";

    // 5. External reference no formato simples (pipe-separated para parsing no webhook)
    const timestamp = formatTimestamp();
    const externalReference = `skejool_${user_id}_${barbershop_id}_${plan_slug}_${subscription_id || 'new'}_${event_id || 'none'}_${checkout_type || 'subscribe'}_${timestamp}`;

    // 6. Payload do checkout (seguindo o formato que funciona)
    const asaasPayload = {
      billingTypes: ["CREDIT_CARD"],
      chargeTypes: ["RECURRENT"],
      minutesToExpire: CHECKOUT_EXPIRY_MINUTES,
      externalReference,
      items: [{
        name: plan_slug,
        description: `Assinatura mensal Skejool`,
        quantity: 1,
        value: plan.price,
      }],
      subscription: {
        cycle: "MONTHLY",
        nextDueDate: formatDateForAsaas(new Date()),
        description: `Assinatura ${plan.name} - Skejool`,
      },
      callback: {
        successUrl,
        cancelUrl,
        expiredUrl,
      },
    };

    console.log("Payload Asaas:", JSON.stringify(asaasPayload));

    // 7. Chamar API do Asaas diretamente
    const asaasResponse = await callAsaas("POST", "/checkouts", asaasPayload);
    const asaasText = await asaasResponse.text();
    
    console.log("Asaas status:", asaasResponse.status);
    console.log("Asaas response:", asaasText.substring(0, 500));

    if (!asaasResponse.ok) {
      console.error("Erro Asaas:", asaasText);
      throw new Error(`Erro ao criar checkout: ${asaasResponse.status} - ${asaasText}`);
    }

    const asaasData = JSON.parse(asaasText);

    if (!asaasData.id) {
      console.error("Resposta Asaas sem ID:", asaasData);
      throw new Error("Resposta inválida do Asaas");
    }

    // 8. Montar URL do checkout
    const checkoutUrl = asaasData.link || asaasData.url || `https://www.asaas.com/c/${asaasData.id}`;
    console.log("Checkout URL:", checkoutUrl);

    // 9. Salvar sessão no banco
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
