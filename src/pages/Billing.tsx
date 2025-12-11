import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  CreditCard,
  CheckCircle,
  AlertCircle,
  Clock,
  ExternalLink,
  XCircle,
  Calendar,
  Receipt,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

interface OutletContextType {
  onMenuClick: () => void;
}

interface Payment {
  id: string;
  amount: number;
  status: string;
  due_date: string | null;
  paid_at: string | null;
  method: string | null;
  invoice_url: string | null;
  raw: {
    creditCard?: {
      creditCardNumber?: string;
      creditCardBrand?: string;
    };
  } | null;
}

export default function Billing() {
  const { onMenuClick } = useOutletContext<OutletContextType>();
  const { user } = useAuth();
  const { subscription, plan, isTrialing, isActive, daysRemaining, loading } = useSubscription();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [canceling, setCanceling] = useState(false);

  useEffect(() => {
    if (user) {
      fetchPayments();
    }
  }, [user]);

  const fetchPayments = async () => {
    if (!user) return;
    
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
    if (!user || !subscription || !plan) return;
    
    setSubscribing(true);
    try {
      const response = await fetch("https://webhook.lernow.com/webhook/asaas-checkout-skejool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "subscribe",
          user_id: user.id,
          plan_slug: subscription.plan_slug,
          price: plan.price,
          subscription_id: subscription.id,
        }),
      });

      const data = await response.json();
      
      if (data.link) {
        window.location.href = data.link;
      } else if (data.checkout_url) {
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

  const handleCancel = async () => {
    if (!user || !subscription) return;
    
    setCanceling(true);
    try {
      const response = await fetch("https://webhook.lernow.com/webhook/asaas-checkout-skejool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel",
          user_id: user.id,
          subscription_id: subscription.id,
          asaas_subscription_id: subscription.asaas_subscription_id,
        }),
      });

      if (response.ok) {
        toast.success("Assinatura cancelada com sucesso");
        await supabase
          .from("subscriptions")
          .update({ status: "canceled" })
          .eq("id", subscription.id);
        window.location.reload();
      } else {
        toast.error("Erro ao cancelar assinatura");
      }
    } catch (error) {
      console.error("Cancel error:", error);
      toast.error("Erro ao cancelar assinatura");
    } finally {
      setCanceling(false);
    }
  };

  const getStatusInfo = () => {
    if (!subscription) {
      return { label: "Sem assinatura", color: "text-muted-foreground", bgColor: "bg-muted", icon: AlertCircle };
    }

    switch (subscription.status) {
      case "trialing":
        return { label: `Teste grátis`, sublabel: `${daysRemaining} dias restantes`, color: "text-primary", bgColor: "bg-primary/10", icon: Clock };
      case "active":
        return { label: "Ativo", color: "text-success", bgColor: "bg-success/10", icon: CheckCircle };
      case "canceled":
        return { label: "Cancelado", color: "text-muted-foreground", bgColor: "bg-muted", icon: XCircle };
      case "expired":
        return { label: "Expirado", color: "text-destructive", bgColor: "bg-destructive/10", icon: AlertCircle };
      default:
        return { label: subscription.status, color: "text-warning", bgColor: "bg-warning/10", icon: AlertCircle };
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case "CONFIRMED":
      case "RECEIVED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-success/10 text-success">
            <CheckCircle className="w-3 h-3" />
            Pago
          </span>
        );
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-warning/10 text-warning">
            <Clock className="w-3 h-3" />
            Pendente
          </span>
        );
      case "OVERDUE":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-destructive/10 text-destructive">
            <AlertCircle className="w-3 h-3" />
            Atrasado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
            {status}
          </span>
        );
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("pt-BR");
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // Extract card info from most recent payment
  const getCardInfo = () => {
    const paymentWithCard = payments.find(p => p.raw?.creditCard?.creditCardNumber);
    if (!paymentWithCard?.raw?.creditCard) return null;
    
    const { creditCardNumber, creditCardBrand } = paymentWithCard.raw.creditCard;
    const lastFour = creditCardNumber?.slice(-4) || "****";
    return { lastFour, brand: creditCardBrand || "Cartão" };
  };

  const cardInfo = getCardInfo();
  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header title="Faturas" subtitle="Gerencie sua assinatura" onMenuClick={onMenuClick} />
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title="Faturas" subtitle="Gerencie sua assinatura" onMenuClick={onMenuClick} />

      <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-6">
        {/* Main Subscription Card - Banking App Style */}
        <div className="bg-gradient-to-br from-card via-card to-muted/30 rounded-3xl shadow-card overflow-hidden animate-fade-in">
          {/* Card Header with gradient accent */}
          <div className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 px-6 py-5 border-b border-border/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
                  <CreditCard className="w-6 h-6 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Método de pagamento</p>
                  {cardInfo ? (
                    <p className="text-lg font-semibold text-foreground">
                      {cardInfo.brand} •••• {cardInfo.lastFour}
                    </p>
                  ) : (
                    <p className="text-lg font-medium text-muted-foreground">Nenhum cartão vinculado</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Card Body */}
          <div className="p-6 space-y-6">
            {/* Status and Plan Value Row */}
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Status</p>
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${statusInfo.bgColor}`}>
                  <StatusIcon className={`w-4 h-4 ${statusInfo.color}`} />
                  <span className={`text-sm font-semibold ${statusInfo.color}`}>{statusInfo.label}</span>
                </div>
                {statusInfo.sublabel && (
                  <p className="text-xs text-muted-foreground mt-1">{statusInfo.sublabel}</p>
                )}
              </div>
              
              <div className="space-y-1.5 text-right">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Valor do Plano</p>
                <p className="text-2xl font-bold text-foreground">
                  {plan ? formatCurrency(subscription?.price_at_signup || plan.price) : "-"}
                </p>
                <p className="text-xs text-muted-foreground">/mês</p>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

            {/* Dates Row */}
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Início do Contrato</p>
                <p className="text-base font-semibold text-foreground">
                  {formatDate(subscription?.current_period_start || subscription?.trial_started_at || null)}
                </p>
              </div>
              
              <div className="space-y-1.5 text-right">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Fim do Contrato</p>
                <p className="text-base font-semibold text-foreground">
                  {formatDate(subscription?.current_period_end || subscription?.trial_expires_at || null)}
                </p>
              </div>
            </div>

            {/* Next Due Date - Highlighted */}
            <div className="bg-muted/50 rounded-2xl p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">Próximo Vencimento</p>
              <p className="text-xl font-bold text-foreground">
                {formatDate(subscription?.current_period_end || subscription?.trial_expires_at || null)}
              </p>
            </div>

            {/* Actions */}
            <div className="pt-2 space-y-3">
              {(subscription?.status === "trialing" || subscription?.status === "expired" || !subscription) && (
                <Button
                  className="w-full h-12 text-base font-semibold rounded-xl"
                  onClick={handleSubscribe}
                  disabled={subscribing || !plan}
                >
                  <CreditCard className="w-5 h-5 mr-2" />
                  {subscribing ? "Processando..." : "Assinar agora"}
                </Button>
              )}
              
              {subscription?.status === "active" && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-3 border-t border-border/50"
                      disabled={canceling}
                    >
                      {canceling ? "Cancelando..." : "Cancelar assinatura"}
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancelar assinatura</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja cancelar sua assinatura? Você perderá acesso aos recursos premium ao final do período atual.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Voltar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleCancel}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Confirmar cancelamento
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </div>

        {/* Payment History */}
        <div className="bg-card rounded-2xl shadow-card overflow-hidden animate-slide-up">
          <div className="px-6 py-4 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                <Receipt className="w-5 h-5 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Histórico de Pagamentos</h2>
            </div>
          </div>

          <div className="p-6">
            {loadingPayments ? (
              <div className="flex items-center justify-center h-32">
                <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : payments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Nenhum pagamento registrado</p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Data</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead className="text-right pr-6">Fatura</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment.id} className="hover:bg-muted/50">
                        <TableCell className="pl-6 font-medium">{formatDate(payment.due_date)}</TableCell>
                        <TableCell>{formatCurrency(payment.amount)}</TableCell>
                        <TableCell>{getPaymentStatusBadge(payment.status)}</TableCell>
                        <TableCell className="capitalize text-muted-foreground">{payment.method || "-"}</TableCell>
                        <TableCell className="text-right pr-6">
                          {payment.invoice_url ? (
                            <a
                              href={payment.invoice_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline text-sm font-medium"
                            >
                              Ver <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground">-</span>
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
      </div>
    </div>
  );
}
