import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { Crown, Clock, CreditCard, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { createCheckoutSession } from "@/lib/webhook";

export function SubscriptionCard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { subscription, plan, isTrialing, daysRemaining, loading } = useSubscription();
  const [subscribing, setSubscribing] = useState(false);

  const handleSubscribe = async () => {
    if (!user || !subscription || !plan) {
      navigate("/billing");
      return;
    }
    
    setSubscribing(true);
    try {
      const { data, error } = await createCheckoutSession({
        action: "subscribe",
        user_id: user.id,
        plan_slug: subscription.plan_slug,
        price: plan.price,
        subscription_id: subscription.id,
      });

      if (error) {
        toast.error(error);
        return;
      }
      
      if (data?.link) {
        window.location.href = data.link;
      } else if (data?.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        toast.error("Erro ao criar sessão de pagamento");
      }
    } catch (error) {
      console.error("Subscribe error:", error);
      toast.error("Erro ao processar assinatura");
    } finally {
      setSubscribing(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-card rounded-2xl shadow-card p-5 animate-fade-in">
        <div className="flex items-center justify-center h-24">
          <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // No subscription - prompt to configure
  if (!subscription) {
    return (
      <div className="bg-card rounded-2xl shadow-card p-5 animate-fade-in">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-warning" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Sem assinatura</h3>
            <p className="text-sm text-muted-foreground">Configure seu plano</p>
          </div>
        </div>
        <Button className="w-full" onClick={() => navigate("/billing")}>
          <CreditCard className="w-4 h-4 mr-2" />
          Ver planos
        </Button>
      </div>
    );
  }

  // Trialing
  if (isTrialing) {
    return (
      <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl shadow-card p-5 animate-fade-in border border-primary/20">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
            <Clock className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Teste Grátis</h3>
            <p className="text-sm text-primary font-medium">
              {daysRemaining} {daysRemaining === 1 ? "dia restante" : "dias restantes"}
            </p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Plano {plan?.name} • Assine para continuar após o período de teste
        </p>
        <Button className="w-full" onClick={handleSubscribe} disabled={subscribing}>
          <CreditCard className="w-4 h-4 mr-2" />
          {subscribing ? "Processando..." : "Assinar agora"}
        </Button>
      </div>
    );
  }

  // Expired
  if (subscription.status === "expired") {
    return (
      <div className="bg-destructive/5 rounded-2xl shadow-card p-5 animate-fade-in border border-destructive/20">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Assinatura Expirada</h3>
            <p className="text-sm text-destructive">Renove para continuar usando</p>
          </div>
        </div>
        <Button className="w-full" onClick={handleSubscribe} disabled={subscribing}>
          <CreditCard className="w-4 h-4 mr-2" />
          {subscribing ? "Processando..." : "Renovar assinatura"}
        </Button>
      </div>
    );
  }

  // Active
  if (subscription.status === "active") {
    return (
      <div className="bg-success/5 rounded-2xl shadow-card p-5 animate-fade-in border border-success/20">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
            <Crown className="w-5 h-5 text-success" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Plano {plan?.name}</h3>
            <p className="text-sm text-success font-medium flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Ativo
            </p>
          </div>
        </div>
        <Button variant="outline" className="w-full" onClick={() => navigate("/billing")}>
          Gerenciar assinatura
        </Button>
      </div>
    );
  }

  // Canceled or other
  return (
    <div className="bg-card rounded-2xl shadow-card p-5 animate-fade-in">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
          <Crown className="w-5 h-5 text-muted-foreground" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Plano {plan?.name}</h3>
          <p className="text-sm text-muted-foreground capitalize">{subscription.status}</p>
        </div>
      </div>
      <Button variant="outline" className="w-full" onClick={() => navigate("/billing")}>
        Ver detalhes
      </Button>
    </div>
  );
}
