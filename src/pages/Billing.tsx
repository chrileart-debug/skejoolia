import { useState, useEffect } from "react";
import { useSetPageHeader } from "@/contexts/PageHeaderContext";
import { Button } from "@/components/ui/button";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { createCheckoutSession, webhookRequest, WEBHOOK_ENDPOINTS } from "@/lib/webhook";
import {
  CreditCard,
  CheckCircle,
  AlertCircle,
  Clock,
  ExternalLink,
  XCircle,
  Calendar,
  Receipt,
  MessageSquare,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface Barbershop {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  is_active: boolean;
}

interface OutletContextType {
  onMenuClick: () => void;
  barbershop: Barbershop | null;
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
  const { onMenuClick, barbershop } = useOutletContext<OutletContextType>();
  const { user } = useAuth();
  const { subscription, plan, isTrialing, isActive, daysRemaining, loading } = useSubscription();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [showChurnSurvey, setShowChurnSurvey] = useState(false);
  const [churnSurvey, setChurnSurvey] = useState({
    mainReason: "",
    mostUsedFeature: "",
    wouldReturn: "",
    additionalComment: "",
  });
  
  useSetPageHeader("Faturas", "Gerencie sua assinatura");
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
    if (!user || !subscription || !plan || !barbershop) return;
    
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

  const handleOpenChurnSurvey = () => {
    setShowChurnSurvey(true);
  };

  const handleCancelWithSurvey = async () => {
    if (!user || !subscription) return;
    
    setCanceling(true);
    try {
      const { error } = await webhookRequest(WEBHOOK_ENDPOINTS.ASAAS_CHECKOUT, {
        body: {
          action: "cancel",
          user_id: user.id,
          subscription_id: subscription.id,
          asaas_subscription_id: subscription.asaas_subscription_id,
          churn_survey: {
            main_reason: churnSurvey.mainReason,
            most_used_feature: churnSurvey.mostUsedFeature,
            would_return: churnSurvey.wouldReturn,
            additional_comment: churnSurvey.additionalComment,
          },
        },
      });

      if (error) {
        toast.error("Erro ao cancelar assinatura");
        return;
      }

      toast.success("Assinatura cancelada com sucesso");
      await supabase
        .from("subscriptions")
        .update({ status: "canceled" })
        .eq("id", subscription.id);
      setShowChurnSurvey(false);
      window.location.reload();
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
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // Show fallback when no active subscription
  if (!subscription && !loading) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center max-w-md space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">Nenhuma assinatura ativa</h2>
            <p className="text-muted-foreground">
              Você ainda não possui uma assinatura ativa. Escolha um plano para começar a usar todos os recursos.
            </p>
            <Button onClick={() => window.location.href = "/plans"} className="mt-4">
              Ver planos disponíveis
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 p-3 sm:p-4 lg:p-6 max-w-2xl mx-auto w-full flex flex-col gap-3 sm:gap-4 lg:gap-6">
        {/* Main Subscription Card - Banking App Style */}
        <div className="bg-gradient-to-br from-card via-card to-muted/30 rounded-2xl sm:rounded-3xl shadow-card overflow-hidden animate-fade-in flex-shrink-0">
          {/* Card Header with gradient accent */}
          <div className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 px-4 sm:px-6 py-3 sm:py-4 border-b border-border/50">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg flex-shrink-0">
                <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-medium">Método de pagamento</p>
                {cardInfo ? (
                  <p className="text-base sm:text-lg font-semibold text-foreground truncate">
                    {cardInfo.brand} •••• {cardInfo.lastFour}
                  </p>
                ) : (
                  <p className="text-base sm:text-lg font-medium text-muted-foreground">Nenhum cartão</p>
                )}
              </div>
            </div>
          </div>

          {/* Card Body */}
          <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
            {/* Status and Plan Value Row */}
            <div className="grid grid-cols-2 gap-3 sm:gap-6">
              <div className="space-y-1">
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-medium">Status</p>
                <div className={`inline-flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full ${statusInfo.bgColor}`}>
                  <StatusIcon className={`w-3 h-3 sm:w-4 sm:h-4 ${statusInfo.color}`} />
                  <span className={`text-xs sm:text-sm font-semibold ${statusInfo.color}`}>{statusInfo.label}</span>
                </div>
                {statusInfo.sublabel && (
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{statusInfo.sublabel}</p>
                )}
              </div>
              
              <div className="space-y-1 text-right">
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-medium">Valor do Plano</p>
                <p className="text-xl sm:text-2xl font-bold text-foreground">
                  {plan ? formatCurrency(plan.price) : "-"}
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">/mês</p>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

            {/* Dates Row */}
            <div className="grid grid-cols-2 gap-3 sm:gap-6">
              <div className="space-y-0.5 sm:space-y-1">
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-medium">Início</p>
                <p className="text-sm sm:text-base font-semibold text-foreground">
                  {formatDate(subscription?.current_period_start || subscription?.trial_started_at || null)}
                </p>
              </div>
              
              <div className="space-y-0.5 sm:space-y-1 text-right">
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-medium">Fim</p>
                <p className="text-sm sm:text-base font-semibold text-foreground">
                  {formatDate(subscription?.current_period_end || subscription?.trial_expires_at || null)}
                </p>
              </div>
            </div>

            {/* Next Due Date - Highlighted */}
            <div className="bg-muted/50 rounded-xl sm:rounded-2xl p-3 sm:p-4 text-center">
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-medium mb-0.5">Próximo Vencimento</p>
              <p className="text-lg sm:text-xl font-bold text-foreground">
                {formatDate(subscription?.current_period_end || subscription?.trial_expires_at || null)}
              </p>
            </div>

            {/* Subscribe Action */}
            {(subscription?.status === "trialing" || subscription?.status === "expired" || !subscription) && (
              <div className="pt-1 sm:pt-2">
                <Button
                  className="w-full h-10 sm:h-12 text-sm sm:text-base font-semibold rounded-xl"
                  onClick={handleSubscribe}
                  disabled={subscribing || !plan}
                >
                  <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                  {subscribing ? "Processando..." : "Assinar agora"}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Payment History - Compact for mobile */}
        <div className="bg-card rounded-xl sm:rounded-2xl shadow-card overflow-hidden animate-slide-up flex-shrink-0">
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-border/50">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                <Receipt className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
              </div>
              <h2 className="text-base sm:text-lg font-semibold text-foreground">Histórico</h2>
            </div>
          </div>

          <div className="p-3 sm:p-6">
            {loadingPayments ? (
              <div className="flex items-center justify-center h-20 sm:h-32">
                <div className="w-5 h-5 sm:w-6 sm:h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : payments.length === 0 ? (
              <div className="text-center py-4 sm:py-8 text-muted-foreground">
                <Calendar className="w-8 h-8 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 opacity-50" />
                <p className="text-xs sm:text-base">Nenhum pagamento registrado</p>
              </div>
            ) : (
              <div className="space-y-2 sm:hidden">
                {/* Mobile: Card layout for payments */}
                {payments.slice(0, 3).map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="text-left min-w-0">
                        <p className="text-xs font-medium text-foreground">{formatDate(payment.due_date)}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">{payment.method || "Cartão"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {getPaymentStatusBadge(payment.status)}
                      <span className="text-xs font-semibold text-foreground">{formatCurrency(payment.amount)}</span>
                      {payment.invoice_url && (
                        <a
                          href={payment.invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Desktop/Tablet: Table layout */}
            {payments.length > 0 && (
              <div className="hidden sm:block overflow-x-auto -mx-6">
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

        {/* Cancel Subscription - Separate section at bottom */}
        {subscription?.status === "active" && (
          <div className="flex-shrink-0 pt-4 pb-8">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  className="flex items-center justify-center gap-2 w-full text-xs text-destructive/70 hover:text-destructive transition-colors py-3"
                  disabled={canceling}
                >
                  <XCircle className="w-3.5 h-3.5" />
                  {canceling ? "Cancelando..." : "Cancelar assinatura"}
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-destructive">Cancelar assinatura</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja cancelar sua assinatura? Você perderá acesso aos recursos premium ao final do período atual.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleOpenChurnSurvey}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Continuar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {/* Churn Survey Modal */}
        <Dialog open={showChurnSurvey} onOpenChange={setShowChurnSurvey}>
          <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <DialogTitle>Antes de ir...</DialogTitle>
                  <DialogDescription>Nos ajude a melhorar</DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="mainReason">Motivo principal do cancelamento</Label>
                <Select
                  value={churnSurvey.mainReason}
                  onValueChange={(value) => setChurnSurvey({ ...churnSurvey, mainReason: value })}
                >
                  <SelectTrigger id="mainReason" className="bg-background">
                    <SelectValue placeholder="Selecione um motivo" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="preco_alto">Preço muito alto</SelectItem>
                    <SelectItem value="nao_uso">Não uso mais o serviço</SelectItem>
                    <SelectItem value="dificil_usar">Achei difícil de usar</SelectItem>
                    <SelectItem value="expectativas">Não atendeu minhas expectativas</SelectItem>
                    <SelectItem value="alternativa">Encontrei uma alternativa melhor</SelectItem>
                    <SelectItem value="problemas_tecnicos">Problemas técnicos</SelectItem>
                    <SelectItem value="outro">Outro motivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mostUsedFeature">Qual recurso você mais utilizou?</Label>
                <Select
                  value={churnSurvey.mostUsedFeature}
                  onValueChange={(value) => setChurnSurvey({ ...churnSurvey, mostUsedFeature: value })}
                >
                  <SelectTrigger id="mostUsedFeature" className="bg-background">
                    <SelectValue placeholder="Selecione um recurso" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="agendamentos">Agendamentos</SelectItem>
                    <SelectItem value="agentes_ia">Agentes IA</SelectItem>
                    <SelectItem value="whatsapp">Integração WhatsApp</SelectItem>
                    <SelectItem value="clientes">Gestão de clientes</SelectItem>
                    <SelectItem value="nenhum">Nenhum em particular</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="wouldReturn">Você voltaria a usar o Skejool no futuro?</Label>
                <Select
                  value={churnSurvey.wouldReturn}
                  onValueChange={(value) => setChurnSurvey({ ...churnSurvey, wouldReturn: value })}
                >
                  <SelectTrigger id="wouldReturn" className="bg-background">
                    <SelectValue placeholder="Selecione uma opção" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="sim_certeza">Sim, com certeza</SelectItem>
                    <SelectItem value="talvez">Talvez</SelectItem>
                    <SelectItem value="provavelmente_nao">Provavelmente não</SelectItem>
                    <SelectItem value="nao">Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="additionalComment">Comentário adicional (opcional)</Label>
                <Textarea
                  id="additionalComment"
                  placeholder="Conte-nos mais sobre sua experiência..."
                  value={churnSurvey.additionalComment}
                  onChange={(e) => setChurnSurvey({ ...churnSurvey, additionalComment: e.target.value })}
                  className="resize-none bg-background"
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setShowChurnSurvey(false)}
              >
                Voltar
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancelWithSurvey}
                disabled={canceling || !churnSurvey.mainReason}
              >
                {canceling ? "Cancelando..." : "Confirmar cancelamento"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
