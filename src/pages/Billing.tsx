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
  Crown,
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
        // Update local state
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

  const getStatusBadge = () => {
    if (!subscription) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-muted text-muted-foreground">
          <AlertCircle className="w-4 h-4" />
          Sem assinatura
        </span>
      );
    }

    switch (subscription.status) {
      case "trialing":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-primary/10 text-primary">
            <Clock className="w-4 h-4" />
            Teste grátis ({daysRemaining} dias restantes)
          </span>
        );
      case "active":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-success/10 text-success">
            <CheckCircle className="w-4 h-4" />
            Ativo
          </span>
        );
      case "canceled":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-muted text-muted-foreground">
            <XCircle className="w-4 h-4" />
            Cancelado
          </span>
        );
      case "expired":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-destructive/10 text-destructive">
            <AlertCircle className="w-4 h-4" />
            Expirado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-warning/10 text-warning">
            <AlertCircle className="w-4 h-4" />
            {subscription.status}
          </span>
        );
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

      <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-6">
        {/* Current Plan Card */}
        <div className="bg-card rounded-2xl shadow-card p-6 animate-fade-in">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
              <Crown className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Plano Atual</h2>
              <p className="text-sm text-muted-foreground">
                {plan?.name || "Nenhum plano selecionado"}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Status */}
            <div className="flex items-center justify-between py-3 border-b border-border">
              <span className="text-muted-foreground">Status</span>
              {getStatusBadge()}
            </div>

            {/* Price */}
            {plan && (
              <div className="flex items-center justify-between py-3 border-b border-border">
                <span className="text-muted-foreground">Valor</span>
                <span className="font-semibold text-foreground">
                  {formatCurrency(plan.price)}/mês
                </span>
              </div>
            )}

            {/* Limits */}
            {plan && (
              <div className="grid grid-cols-2 gap-4 py-3">
                <div className="text-center p-3 rounded-xl bg-muted/50">
                  <p className="text-2xl font-bold text-foreground">{plan.max_agents}</p>
                  <p className="text-xs text-muted-foreground">Agentes</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-muted/50">
                  <p className="text-2xl font-bold text-foreground">{plan.max_whatsapp}</p>
                  <p className="text-xs text-muted-foreground">WhatsApp</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-muted/50">
                  <p className="text-2xl font-bold text-foreground">
                    {plan.max_services ?? "∞"}
                  </p>
                  <p className="text-xs text-muted-foreground">Serviços</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-muted/50">
                  <p className="text-2xl font-bold text-foreground">
                    {plan.max_appointments_month ?? "∞"}
                  </p>
                  <p className="text-xs text-muted-foreground">Agendamentos/mês</p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              {(subscription?.status === "trialing" || subscription?.status === "expired" || !subscription) && (
                <Button
                  className="flex-1"
                  onClick={handleSubscribe}
                  disabled={subscribing || !plan}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  {subscribing ? "Processando..." : "Assinar agora"}
                </Button>
              )}
              
              {subscription?.status === "active" && (
                <Button
                  variant="outline"
                  className="flex-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={handleCancel}
                  disabled={canceling}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  {canceling ? "Cancelando..." : "Cancelar assinatura"}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Payment History */}
        <div className="bg-card rounded-2xl shadow-card p-6 animate-slide-up">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
              <Receipt className="w-5 h-5 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Histórico de Pagamentos</h2>
          </div>

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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead className="text-right">Fatura</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>{formatDate(payment.due_date)}</TableCell>
                      <TableCell>{formatCurrency(payment.amount)}</TableCell>
                      <TableCell>{getPaymentStatusBadge(payment.status)}</TableCell>
                      <TableCell className="capitalize">{payment.method || "-"}</TableCell>
                      <TableCell className="text-right">
                        {payment.invoice_url ? (
                          <a
                            href={payment.invoice_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
                          >
                            Ver <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          "-"
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
  );
}
