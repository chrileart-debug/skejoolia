import { Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import { useNavigate } from "react-router-dom";

export function TrialBanner() {
  const { isTrialing, daysRemaining, plan } = useSubscription();
  const navigate = useNavigate();

  if (!isTrialing || daysRemaining <= 0) return null;

  return (
    <div className="w-full bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 border-b border-primary/20">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <Clock className="w-4 h-4 text-primary" />
          </div>
          <div className="text-sm">
            <span className="text-foreground font-medium">
              Teste grátis: {daysRemaining} {daysRemaining === 1 ? "dia" : "dias"} restantes
            </span>
            <span className="text-muted-foreground ml-2">
              Plano {plan?.name}
            </span>
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => navigate("/settings?tab=subscription")}
          className="gap-1.5"
        >
          Assinar agora
          <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
