import { Check, Sparkles, Users, MessageSquare, Scissors, Calendar, Headphones, Zap, UserCheck, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Plan {
  slug: string;
  name: string;
  price: number;
  max_agents: number;
  max_whatsapp: number;
  max_services: number | null;
  max_appointments_month: number | null;
}

interface PlanSelectorProps {
  plans: Plan[];
  onSelectPlan: (planSlug: string) => void;
  loading?: boolean;
}

export function PlanSelector({ plans, onSelectPlan, loading }: PlanSelectorProps) {
  const basicoPlan = plans.find(p => p.slug === "basico");
  const corporativoPlan = plans.find(p => p.slug === "corporativo");

  if (!basicoPlan || !corporativoPlan) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const planFeatures = {
    basico: [
      { icon: Users, text: "1 agente" },
      { icon: MessageSquare, text: "1 integração WhatsApp" },
      { icon: Scissors, text: "Até 3 serviços cadastrados" },
      { icon: Calendar, text: "Até 10 agendamentos por mês" },
      { icon: Check, text: "Agendamento automático" },
      { icon: Check, text: "Agendamento manual" },
    ],
    corporativo: [
      { icon: Users, text: "Até 5 agentes" },
      { icon: MessageSquare, text: "Até 5 integrações WhatsApp" },
      { icon: Scissors, text: "Serviços ilimitados" },
      { icon: Calendar, text: "Agendamentos ilimitados" },
      { icon: Check, text: "Agendamento automático" },
      { icon: Check, text: "Agendamento manual" },
    ],
    corporativoPremium: [
      { icon: Headphones, text: "Suporte prioritário" },
      { icon: Zap, text: "Atualizações mais rápidas" },
      { icon: UserCheck, text: "Auxílio na criação do agente" },
      { icon: Settings, text: "Acompanhamento na configuração" },
    ],
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-foreground">Escolha seu plano</h1>
        <p className="text-muted-foreground">
          Comece com 7 dias grátis em qualquer plano
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Plano Básico */}
        <div className="relative rounded-2xl border border-border bg-card p-6 shadow-card hover:shadow-card-hover transition-shadow">
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-foreground">Básico</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Ideal para autônomos e microbarbearias
              </p>
            </div>

            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold text-foreground">R$ {basicoPlan.price.toFixed(2).replace(".", ",")}</span>
              <span className="text-muted-foreground">/mês</span>
            </div>

            <div className="py-2 px-3 rounded-lg bg-primary/10 text-primary text-sm font-medium text-center">
              7 dias grátis para testar
            </div>

            <ul className="space-y-3">
              {planFeatures.basico.map((feature, idx) => (
                <li key={idx} className="flex items-center gap-3 text-sm text-foreground">
                  <feature.icon className="w-4 h-4 text-primary shrink-0" />
                  <span>{feature.text}</span>
                </li>
              ))}
            </ul>

            <Button
              onClick={() => onSelectPlan("basico")}
              variant="outline"
              size="lg"
              className="w-full"
              disabled={loading}
            >
              Começar teste grátis
            </Button>
          </div>
        </div>

        {/* Plano Corporativo */}
        <div className="relative rounded-2xl border-2 border-primary bg-card p-6 shadow-card hover:shadow-card-hover transition-shadow">
          {/* Badge recomendado */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full gradient-primary text-primary-foreground text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              RECOMENDADO
            </div>
          </div>

          <div className="space-y-6 pt-2">
            <div>
              <h3 className="text-xl font-bold text-foreground">Corporativo</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Para barbearias com maior volume
              </p>
            </div>

            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold text-foreground">R$ {corporativoPlan.price.toFixed(2).replace(".", ",")}</span>
              <span className="text-muted-foreground">/mês</span>
            </div>

            <div className="py-2 px-3 rounded-lg bg-primary/10 text-primary text-sm font-medium text-center">
              7 dias grátis para testar
            </div>

            <ul className="space-y-3">
              {planFeatures.corporativo.map((feature, idx) => (
                <li key={idx} className="flex items-center gap-3 text-sm text-foreground">
                  <feature.icon className="w-4 h-4 text-primary shrink-0" />
                  <span>{feature.text}</span>
                </li>
              ))}
            </ul>

            <div className="border-t border-border pt-4">
              <p className="text-xs font-medium text-muted-foreground uppercase mb-3">
                Benefícios Premium
              </p>
              <ul className="space-y-2">
                {planFeatures.corporativoPremium.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-3 text-sm text-foreground">
                    <feature.icon className="w-4 h-4 text-accent shrink-0" />
                    <span>{feature.text}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Button
              onClick={() => onSelectPlan("corporativo")}
              size="lg"
              className="w-full"
              disabled={loading}
            >
              Começar teste grátis
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
