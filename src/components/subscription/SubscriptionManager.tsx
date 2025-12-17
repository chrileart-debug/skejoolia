import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CreditCard,
  Crown,
  Calendar,
  ExternalLink,
  Loader2,
  XCircle,
  CheckCircle,
  Clock,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useBarbershop } from "@/hooks/useBarbershop";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { createCheckoutSession, webhookRequest, WEBHOOK_ENDPOINTS } from "@/lib/webhook";

interface Payment {
  id: string;
  amount: number;
  status: string;
  due_date: string | null;
  paid_at: string | null;
  method: string | null;
  invoice_url: string | null;
  created_at: string | null;
}

export function SubscriptionManager() {
  const { user } = useAuth();
  const { barbershop } = useBarbershop();
  const { subscription, plan, isTrialing, isActive, daysRemaining, refreshSubscription } = useSubscription();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);

  useEffect(() => {
    if (user) {
      fetchPayments();
    }
  }, [user]);

  const fetchPayments = async () => {
    if (!user) return;
    setLoadingPayments(true);

    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setPayments(data as Payment[]);
    }
    setLoadingPayments(false);
  };

  const handleSubscribe = async () => {
    if (!user || !subscription || !plan) {
      toast.error("Dados de assinatura não encontrados");
      return;
    }

    setIsSubscribing(true);

    try {
      const { data, error } = await createCheckoutSession({
        action: "subscribe",
        user_id: user.id,
        plan_slug: subscription.plan_slug,
        price: plan.price,
        subscription_id: subscription.id,
      });

      if (error) {
        throw new Error(error);
      }

      const checkoutUrl = data?.link || data?.checkout_url;

      if (checkoutUrl) {
        // Save checkout session
        await supabase.from("session_checkout").upsert({
          user_id: user.id,
          barbershop_id: barbershop!.id,
          asaas_checkout_id: null,
          asaas_checkout_link: checkoutUrl,
          status: "pending",
        });

        // Redirect to Asaas checkout
        window.location.href = checkoutUrl;
      } else {
        toast.error("Erro ao criar sessão de pagamento");
      }

      await refreshSubscription();
    } catch (error) {
      console.error("Error subscribing:", error);
      toast.error("Erro ao processar assinatura. Tente novamente.");
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleCancel = async () => {
    if (!user || !subscription) {
      toast.error("Dados de assinatura não encontrados");
      return;
    }

    setIsCanceling(true);

    try {
      const { error } = await webhookRequest(WEBHOOK_ENDPOINTS.ASAAS_CHECKOUT, {
        body: {
          action: "cancel",
          user_id: user.id,
          subscription_id: subscription.id,
          asaas_subscription_id: subscription.asaas_subscription_id,
        },
      });

      if (error) {
        throw new Error(error);
      }

      // Update local subscription status
      await supabase
        .from("subscriptions")
        .update({ status: "canceled" })
        .eq("id", subscription.id);

      toast.success("Assinatura cancelada com sucesso");
      await refreshSubscription();
    } catch (error) {
      console.error("Error canceling:", error);
      toast.error("Erro ao cancelar assinatura. Tente novamente.");
    } finally {
      setIsCanceling(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
      trialing: { label: "Período de teste", variant: "secondary", icon: <Clock className="w-3 h-3" /> },
      active: { label: "Ativa", variant: "default", icon: <CheckCircle className="w-3 h-3" /> },
      canceled: { label: "Cancelada", variant: "destructive", icon: <XCircle className="w-3 h-3" /> },
      expired: { label: "Expirada", variant: "destructive", icon: <AlertCircle className="w-3 h-3" /> },
      past_due: { label: "Pagamento pendente", variant: "outline", icon: <AlertCircle className="w-3 h-3" /> },
    };

    const config = statusConfig[status] || { label: status, variant: "outline" as const, icon: null };

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  const getPaymentStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      PENDING: { label: "Pendente", className: "bg-yellow-500/10 text-yellow-500" },
      RECEIVED: { label: "Recebido", className: "bg-green-500/10 text-green-500" },
      CONFIRMED: { label: "Confirmado", className: "bg-green-500/10 text-green-500" },
      OVERDUE: { label: "Vencido", className: "bg-red-500/10 text-red-500" },
      REFUNDED: { label: "Reembolsado", className: "bg-blue-500/10 text-blue-500" },
    };

    const config = statusConfig[status] || { label: status, className: "bg-muted text-muted-foreground" };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("pt-BR");
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const showSubscribeButton = subscription?.status === "trialing" || subscription?.status === "expired" || subscription?.status === "canceled";
  const showCancelButton = subscription?.status === "active";

  return (
    <div className="space-y-6">
      {/* Current Plan Card */}
      <div className="bg-card rounded-2xl shadow-card p-6 animate-fade-in">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Crown className="w-5 h-5 text-primary" />
          Sua Assinatura
        </h3>

        {subscription && plan ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xl font-bold text-foreground">{plan.name}</p>
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(plan.price)}
                  <span className="text-sm font-normal text-muted-foreground">/mês</span>
                </p>
              </div>
              {getStatusBadge(subscription.status)}
            </div>

            {isTrialing && (
              <div className="bg-primary/10 rounded-lg p-3">
                <p className="text-sm text-foreground">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Seu período de teste termina em <strong>{daysRemaining} dias</strong>
                </p>
                {subscription.trial_expires_at && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Expira em: {formatDate(subscription.trial_expires_at)}
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Agentes</p>
                <p className="font-medium text-foreground">
                  {plan.max_agents} {plan.max_agents === 1 ? "agente" : "agentes"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">WhatsApp</p>
                <p className="font-medium text-foreground">
                  {plan.max_whatsapp} {plan.max_whatsapp === 1 ? "integração" : "integrações"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Serviços</p>
                <p className="font-medium text-foreground">
                  {plan.max_services ? `${plan.max_services} serviços` : "Ilimitado"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Agendamentos/mês</p>
                <p className="font-medium text-foreground">
                  {plan.max_appointments_month ? `${plan.max_appointments_month}` : "Ilimitado"}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              {showSubscribeButton && (
                <Button
                  onClick={handleSubscribe}
                  disabled={isSubscribing}
                  className="flex-1"
                >
                  {isSubscribing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CreditCard className="w-4 h-4 mr-2" />
                  )}
                  {isSubscribing ? "Processando..." : "Assinar agora"}
                </Button>
              )}

              {showCancelButton && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="text-destructive hover:text-destructive">
                      <XCircle className="w-4 h-4 mr-2" />
                      Cancelar assinatura
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancelar assinatura?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja cancelar sua assinatura? Você perderá acesso aos recursos premium ao final do período atual.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Voltar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleCancel}
                        disabled={isCanceling}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {isCanceling ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : null}
                        {isCanceling ? "Cancelando..." : "Confirmar cancelamento"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground">Carregando informações da assinatura...</p>
        )}
      </div>

      {/* Payment History */}
      <div className="bg-card rounded-2xl shadow-card p-6 animate-slide-up">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          Histórico de Pagamentos
        </h3>

        {loadingPayments ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : payments.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Nenhum pagamento registrado ainda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">
                      {formatDate(payment.created_at)}
                    </TableCell>
                    <TableCell>{formatCurrency(payment.amount)}</TableCell>
                    <TableCell>{getPaymentStatusBadge(payment.status)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {payment.method || "-"}
                    </TableCell>
                    <TableCell>
                      {payment.invoice_url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(payment.invoice_url!, "_blank")}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
