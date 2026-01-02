import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

interface ActionRequest {
  action: string;
  user_id: string;
  subscription_id: string;
  asaas_subscription_id?: string | null;
  churn_survey?: Record<string, unknown>;
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

    const body: ActionRequest = await req.json();
    console.log("Subscription action received:", JSON.stringify(body));

    const { action, user_id, subscription_id, asaas_subscription_id, churn_survey } = body;

    if (!user_id || !subscription_id) {
      throw new Error("Dados obrigatórios faltando: user_id, subscription_id");
    }

    switch (action) {
      case "cancel": {
        console.log("Processing subscription cancellation");

        // 1. If we have Asaas subscription ID, cancel on Asaas first via proxy
        if (asaas_subscription_id) {
          console.log("Canceling on Asaas via proxy:", asaas_subscription_id);
          
          const asaasResponse = await callAsaasProxy("DELETE", `/subscriptions/${asaas_subscription_id}`, null);

          const responseText = await asaasResponse.text();
          console.log("Asaas cancel response status:", asaasResponse.status);
          console.log("Asaas cancel response:", responseText.substring(0, 300));

          // 404 means subscription doesn't exist (already canceled or never created)
          if (!asaasResponse.ok && asaasResponse.status !== 404) {
            let errorMessage = "Erro ao cancelar no Asaas";
            try {
              const errorData = JSON.parse(responseText);
              errorMessage = errorData.errors?.[0]?.description || errorMessage;
            } catch {
              // Use default error message
            }
            console.error("Asaas cancel error:", errorMessage);
            // Continue to update local status even if Asaas fails
          } else {
            console.log("Asaas subscription canceled successfully or not found");
          }
        }

        // 2. Update subscription status in database
        const { error: updateError } = await supabase
          .from("subscriptions")
          .update({ 
            status: "canceled",
            updated_at: new Date().toISOString(),
          })
          .eq("id", subscription_id);

        if (updateError) {
          console.error("Error updating subscription:", updateError);
          throw new Error("Erro ao atualizar status da assinatura");
        }

        console.log("Subscription canceled in database:", subscription_id);

        // 3. Log churn survey if provided
        if (churn_survey && Object.keys(churn_survey).length > 0) {
          console.log("Churn survey received:", JSON.stringify(churn_survey));
          // Could save to a churn_surveys table if needed
        }

        return new Response(
          JSON.stringify({ success: true, message: "Assinatura cancelada com sucesso" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        throw new Error(`Ação desconhecida: ${action}`);
    }
  } catch (error: unknown) {
    console.error("Subscription action error:", error);
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
