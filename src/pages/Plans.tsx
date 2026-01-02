import { useState } from "react";
import { Check, Crown, Zap, ArrowRight, Loader2 } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { useBarbershop } from "@/hooks/useBarbershop";
import { useOutletContext } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { createCheckoutSession } from "@/lib/webhook";

interface OutletContextType {
  onMenuClick: () => void;
  barbershopSlug: string | null;
}

const Plans = () => {
  const { user } = useAuth();
  const { barbershop } = useBarbershop();
  const { subscription, plan, plans, isTrialing, daysRemaining, loading } = useSubscription();
  const { onMenuClick, barbershopSlug } = useOutletContext<OutletContextType>();
  const [upgradeLoading, setUpgradeLoading] = useState(false);

  const currentPlanSlug = subscription?.plan_slug || "basico";
  
  const basicoPlan = plans.find(p => p.slug === "basico");
  const corporativoPlan = plans.find(p => p.slug === "corporativo");

  const formatLimit = (value: number | null) => {
    if (value === null || value >= 9999) return "Ilimitados";
    return value.toString();
  };

  const getPlanFeatures = (planData: typeof basicoPlan) => {
    if (!planData) return [];
    const isUnlimitedServices = planData.max_services === null || planData.max_services >= 9999;
    const isUnlimitedAppointments = planData.max_appointments_month === null || planData.max_appointments_month >= 9999;
    
    return [
      `${planData.max_agents} agente${planData.max_agents > 1 ? 's' : ''} IA`,
      `${planData.max_whatsapp} integração${planData.max_whatsapp > 1 ? 'ões' : ''} WhatsApp`,
      isUnlimitedServices ? "Serviços ilimitados" : `${planData.max_services} serviços`,
      isUnlimitedAppointments ? "Agendamentos ilimitados" : `${planData.max_appointments_month} agendamentos/mês`,
      "Agendamento manual e automático",
      "7 dias de teste grátis",
    ];
  };

  const corporativoExtraFeatures = [
    "Suporte prioritário",
    "Atualizações mais rápidas",
    "Auxílio na criação de agentes",
    "Pode adicionar membros à equipe",
    "Pode criar planos de assinatura",
  ];

  const handleUpgrade = async () => {
    console.log("=== handleUpgrade iniciado ===");
    console.log("User:", user);
    console.log("Subscription:", subscription);

    if (!user || !subscription) {
      console.log("Abortando: user ou subscription nulo");
      toast({
        title: "Erro",
        description: "Dados de assinatura não disponíveis. Tente recarregar a página.",
        variant: "destructive",
      });
      return;
    }

    if (!barbershop) {
      toast({
        title: "Erro",
        description: "Dados da barbearia não disponíveis. Tente recarregar a página.",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      action: "upgrade",
      user_id: user.id,
      plan_slug: "corporativo",
      price: corporativoPlan?.price || 79.9,
      subscription_id: subscription.id,
      barbershop_id: barbershop.id,
    };

    setUpgradeLoading(true);
    try {
      const { data, error } = await createCheckoutSession(payload);
      
      console.log("Resposta webhook - data:", data);
      console.log("Resposta webhook - error:", error);

      if (error) {
        throw new Error(error);
      }

      const checkoutUrl = data?.link || data?.checkout_url;
      console.log("Checkout URL:", checkoutUrl);

      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        throw new Error("Link de checkout não encontrado");
      }
    } catch (error) {
      console.error("Erro no upgrade:", error);
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

  const getSubtitle = () => {
    if (isTrialing) {
      const trialText = `Plano ${plan?.name || "Básico"} em período de teste`;
      if (daysRemaining !== null) {
        return `${trialText} — ${daysRemaining} ${daysRemaining === 1 ? "dia restante" : "dias restantes"}`;
      }
      return trialText;
    }
    return `Seu plano atual: ${plan?.name || "Básico"}`;
  };

  return (
    <>
      <Header 
        title="Planos" 
        subtitle={getSubtitle()} 
        onMenuClick={onMenuClick}
        barbershopSlug={barbershopSlug}
      />
      <div className="p-4 md:p-6 space-y-6 pb-8">

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
              <span className="text-3xl font-bold text-foreground">
                R$ {basicoPlan?.price.toFixed(2).replace(".", ",")}
              </span>
              <span className="text-muted-foreground">/mês</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-3">
              {getPlanFeatures(basicoPlan).map((feature, index) => (
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
              <span className="text-3xl font-bold text-foreground">
                R$ {corporativoPlan?.price.toFixed(2).replace(".", ",")}
              </span>
              <span className="text-muted-foreground">/mês</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-3">
              {getPlanFeatures(corporativoPlan).map((feature, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">{feature}</span>
                </li>
              ))}
              {corporativoExtraFeatures.map((feature, index) => (
                <li key={`extra-${index}`} className="flex items-start gap-2 text-sm">
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
    </>
  );
};

export default Plans;
