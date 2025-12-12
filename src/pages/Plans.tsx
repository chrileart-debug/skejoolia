import { useState } from "react";
import { Check, Crown, Zap, ArrowRight, Loader2 } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { webhookRequest, WEBHOOK_ENDPOINTS, CheckoutResponse } from "@/lib/webhook";

const Plans = () => {
  const { user } = useAuth();
  const { subscription, plan, isTrialing, daysRemaining, loading } = useSubscription();
  const [upgradeLoading, setUpgradeLoading] = useState(false);

  const currentPlanSlug = subscription?.plan_slug || "basico";

  const planFeatures = {
    basico: [
      "1 agente IA",
      "1 integração WhatsApp",
      "3 serviços",
      "10 agendamentos/mês",
      "Agendamento manual e automático",
      "7 dias de teste grátis",
    ],
    corporativo: [
      "5 agentes IA",
      "5 integrações WhatsApp",
      "Serviços ilimitados",
      "Agendamentos ilimitados",
      "Agendamento manual e automático",
      "Suporte prioritário",
      "Atualizações mais rápidas",
      "Auxílio na criação de agentes",
      "7 dias de teste grátis",
    ],
  };

  const handleUpgrade = async () => {
    if (!user) return;

    setUpgradeLoading(true);
    try {
      const { data, error } = await webhookRequest<CheckoutResponse>(
        WEBHOOK_ENDPOINTS.ASAAS_CHECKOUT,
        {
          body: {
            user_id: user.id,
            plan_name: "Corporativo",
            plan_price: 49.9,
            email: user.email,
          },
        }
      );

      if (error) {
        throw new Error(error);
      }

      const checkoutUrl = data?.link || data?.checkout_url;

      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        throw new Error("Link de checkout não encontrado");
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível iniciar o upgrade. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setUpgradeLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Planos</h1>
        <p className="text-muted-foreground mt-1">
          {isTrialing ? (
            <>
              Você está no plano <span className="font-medium text-primary">{plan?.name || "Básico"}</span> em período de teste
              {daysRemaining !== null && (
                <span className="ml-1">
                  — <span className="font-medium">{daysRemaining} {daysRemaining === 1 ? "dia restante" : "dias restantes"}</span>
                </span>
              )}
            </>
          ) : (
            <>
              Seu plano atual: <span className="font-medium text-primary">{plan?.name || "Básico"}</span>
            </>
          )}
        </p>
      </div>

      {/* Plans Grid */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto">
        {/* Plano Básico */}
        <Card className={`relative overflow-hidden transition-all ${currentPlanSlug === "basico" ? "ring-2 ring-primary" : ""}`}>
          {currentPlanSlug === "basico" && (
            <Badge className="absolute top-4 right-4 bg-primary text-primary-foreground">
              Seu Plano Atual
            </Badge>
          )}
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Zap className="w-5 h-5 text-primary" />
              Básico
            </CardTitle>
            <div className="mt-2">
              <span className="text-3xl font-bold text-foreground">R$ 29,90</span>
              <span className="text-muted-foreground">/mês</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-3">
              {planFeatures.basico.map((feature, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>
            
            {currentPlanSlug === "basico" ? (
              <Button variant="outline" className="w-full" disabled>
                Plano Atual
              </Button>
            ) : (
              <Button variant="outline" className="w-full" disabled>
                Plano anterior
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Plano Corporativo */}
        <Card className={`relative overflow-hidden transition-all ${currentPlanSlug === "corporativo" ? "ring-2 ring-primary" : "border-primary/30"}`}>
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-primary/60" />
          
          {currentPlanSlug === "corporativo" ? (
            <Badge className="absolute top-4 right-4 bg-primary text-primary-foreground">
              Seu Plano Atual
            </Badge>
          ) : (
            <Badge variant="secondary" className="absolute top-4 right-4">
              <Crown className="w-3 h-3 mr-1" />
              Recomendado
            </Badge>
          )}
          
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Crown className="w-5 h-5 text-primary" />
              Corporativo
            </CardTitle>
            <div className="mt-2">
              <span className="text-3xl font-bold text-foreground">R$ 49,90</span>
              <span className="text-muted-foreground">/mês</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-3">
              {planFeatures.corporativo.map((feature, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>
            
            {currentPlanSlug === "corporativo" ? (
              <Button variant="outline" className="w-full" disabled>
                Plano Atual
              </Button>
            ) : (
              <Button 
                className="w-full" 
                onClick={handleUpgrade}
                disabled={upgradeLoading}
              >
                {upgradeLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    Fazer Upgrade
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Plans;
