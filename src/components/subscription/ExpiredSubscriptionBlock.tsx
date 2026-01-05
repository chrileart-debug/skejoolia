import { useState } from "react";
import { AlertTriangle, CreditCard, Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useBarbershop } from "@/hooks/useBarbershop";
import { useSubscription } from "@/hooks/useSubscription";
import { toast } from "sonner";
import { createCheckoutSession } from "@/lib/webhook";

export function ExpiredSubscriptionBlock() {
  const { user, signOut } = useAuth();
  const { barbershop } = useBarbershop();
  const { subscription, plan } = useSubscription();
  const [subscribing, setSubscribing] = useState(false);

  const handleSubscribe = async () => {
    if (!user || !subscription || !plan || !barbershop) {
      toast.error("Dados de assinatura não encontrados");
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

  const handleLogout = async () => {
    await signOut();
    window.location.href = "/";
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card rounded-2xl shadow-2xl border border-destructive/20 overflow-hidden animate-fade-in">
        {/* Header with warning */}
        <div className="bg-gradient-to-r from-destructive/10 via-destructive/5 to-destructive/10 p-6 border-b border-destructive/20">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-destructive/20 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7 text-destructive" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">
                Período de Teste Expirado
              </h2>
              <p className="text-sm text-muted-foreground">
                Seu acesso foi temporariamente bloqueado
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          <div className="text-center space-y-2">
            <p className="text-muted-foreground">
              Para continuar usando o sistema e manter sua agenda, clientes e configurações, 
              assine agora o plano <span className="font-semibold text-foreground">{plan?.name}</span>.
            </p>
            <p className="text-2xl font-bold text-foreground">
              R$ {plan?.price?.toFixed(2).replace(".", ",")}<span className="text-sm font-normal text-muted-foreground">/mês</span>
            </p>
          </div>

          <div className="space-y-3">
            <Button
              className="w-full h-12 text-base font-semibold gap-2"
              onClick={handleSubscribe}
              disabled={subscribing}
            >
              {subscribing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <CreditCard className="w-5 h-5" />
                  Assinar Agora
                </>
              )}
            </Button>

            <Button
              variant="ghost"
              className="w-full text-muted-foreground hover:text-foreground"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sair da conta
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Seus dados estão seguros e serão mantidos. Após assinar, você terá acesso imediato a todas as funcionalidades.
          </p>
        </div>
      </div>
    </div>
  );
}
