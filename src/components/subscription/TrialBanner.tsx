import { useState } from "react";
import { Clock, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { useBarbershop } from "@/hooks/useBarbershop";
import { toast } from "sonner";
import { createCheckoutSession } from "@/lib/webhook";
import { useFacebookPixel, generateEventId } from "@/hooks/useFacebookPixel";

export function TrialBanner() {
  const { isTrialing, daysRemaining, plan, subscription } = useSubscription();
  const { user } = useAuth();
  const { barbershop } = useBarbershop();
  const [subscribing, setSubscribing] = useState(false);
  const { trackInitiateCheckout } = useFacebookPixel();

  if (!isTrialing || daysRemaining <= 0) return null;

  const handleSubscribe = async () => {
    if (!user || !subscription || !plan || !barbershop) {
      toast.error("Dados de assinatura não encontrados");
      return;
    }

    // Track InitiateCheckout event
    trackInitiateCheckout({
      value: plan.price,
      currency: "BRL",
      contentName: `Plano ${plan.name}`,
      eventId: generateEventId(user.id),
    });

    setSubscribing(true);
    try {
      const { data, error } = await createCheckoutSession({
        action: "subscribe",
        user_id: user.id,
        plan_slug: subscription.plan_slug,
        price: plan.price,
        subscription_id: subscription.id,
        barbershop_id: barbershop.id,
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
          onClick={handleSubscribe}
          disabled={subscribing}
          className="gap-1.5"
        >
          {subscribing ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              Assinar agora
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
