import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useSetPageHeader } from "@/contexts/PageHeaderContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FAB } from "@/components/shared/FAB";
import { EmptyState } from "@/components/shared/EmptyState";
import { Plus, Crown, Users, Package, Edit, Trash2, AlertTriangle, Sparkles, Rocket, Loader2, UserPlus, RefreshCw, XCircle, Ban } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useNavigate, useOutletContext } from "react-router-dom";
import { ClubPlanModal } from "@/components/club/ClubPlanModal";
import { PublishPlanModal } from "@/components/club/PublishPlanModal";
import { ManualSubscriptionModal } from "@/components/club/ManualSubscriptionModal";
import { VipBadge, VipCrown } from "@/components/club/VipBadge";
import { RenewalModal } from "@/components/club/RenewalModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  barbershopSlug: string | null;
}

interface BarberPlan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  interval: string;
  is_active: boolean;
  is_published: boolean;
  created_at: string;
  items?: BarberPlanItem[];
}

interface BarberPlanItem {
  id: string;
  service_id: string;
  quantity_limit: number | null;
  service?: {
    name: string;
  };
}

interface Subscriber {
  id: string;
  client_id: string;
  plan_id: string;
  status: string;
  next_due_date: string | null;
  payment_origin: string | null;
  client?: {
    nome: string;
    telefone: string;
  };
  plan?: {
    name: string;
    price: number;
  };
}

export default function Club() {
  const { onMenuClick, barbershop, barbershopSlug } = useOutletContext<OutletContextType>();
  const { user } = useAuth();
  const { isActive } = useSubscription();
  const navigate = useNavigate();
  
  useSetPageHeader("Meu Clube", "Gerencie seus planos de assinatura para clientes");
  
  const [plans, setPlans] = useState<BarberPlan[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<BarberPlan | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<BarberPlan | null>(null);
  const [subscriberCount, setSubscriberCount] = useState<{ active: number; total: number } | null>(null);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [publishingPlanId, setPublishingPlanId] = useState<string | null>(null);
  
  // Manual subscription modal state
  const [manualSubscriptionModalOpen, setManualSubscriptionModalOpen] = useState(false);
  
  // Renewal modal state
  const [renewalModalOpen, setRenewalModalOpen] = useState(false);
  const [renewalSubscriber, setRenewalSubscriber] = useState<Subscriber | null>(null);
  
  // Cancel subscription state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [subscriberToCancel, setSubscriberToCancel] = useState<Subscriber | null>(null);
  const [cancellingSubscription, setCancellingSubscription] = useState(false);
  
  // Check if there are any draft plans
  const hasDraftPlans = plans.some(plan => !plan.is_published);

  useEffect(() => {
    if (barbershop?.id) {
      fetchPlans();
      fetchSubscribers();
    }
  }, [barbershop?.id]);

  const fetchPlans = async () => {
    if (!barbershop?.id) return;
    
    try {
      const { data: plansData, error: plansError } = await supabase
        .from("barber_plans")
        .select("*")
        .eq("barbershop_id", barbershop.id)
        .order("created_at", { ascending: false });

      if (plansError) throw plansError;

      // Fetch plan items with service names
      const plansWithItems = await Promise.all(
        (plansData || []).map(async (plan) => {
          const { data: items } = await supabase
            .from("barber_plan_items")
            .select("id, service_id, quantity_limit")
            .eq("plan_id", plan.id);

          // Get service names for each item
          const itemsWithServices = await Promise.all(
            (items || []).map(async (item) => {
              const { data: service } = await supabase
                .from("services")
                .select("name")
                .eq("id", item.service_id)
                .single();
              return { ...item, service };
            })
          );

          return { ...plan, items: itemsWithServices };
        })
      );

      setPlans(plansWithItems);
    } catch (error) {
      console.error("Error fetching plans:", error);
      toast.error("Erro ao carregar planos");
    } finally {
      setLoading(false);
    }
  };

  const fetchSubscribers = async () => {
    if (!barbershop?.id) return;

    try {
      const { data, error } = await supabase
        .from("client_club_subscriptions")
        .select(`
          id,
          client_id,
          plan_id,
          status,
          next_due_date,
          payment_origin
        `)
        .eq("barbershop_id", barbershop.id)
        .neq("status", "canceled");

      if (error) throw error;

      // Fetch client and plan details
      const subscribersWithDetails = await Promise.all(
        (data || []).map(async (sub) => {
          const { data: client } = await supabase
            .from("clientes")
            .select("nome, telefone")
            .eq("client_id", sub.client_id)
            .single();

          const { data: plan } = await supabase
            .from("barber_plans")
            .select("name, price")
            .eq("id", sub.plan_id)
            .single();

          return { ...sub, client, plan };
        })
      );

      setSubscribers(subscribersWithDetails);
    } catch (error) {
      console.error("Error fetching subscribers:", error);
    }
  };

  const handleCreatePlan = () => {
    setEditingPlan(null);
    setModalOpen(true);
  };

  const handleEditPlan = (plan: BarberPlan) => {
    setEditingPlan(plan);
    setModalOpen(true);
  };

  const handleDeleteClick = async (plan: BarberPlan) => {
    // Verificar se há assinantes (ativos ou histórico)
    const { data: subscriptions, error } = await supabase
      .from("client_club_subscriptions")
      .select("id, status")
      .eq("plan_id", plan.id);

    if (error) {
      toast.error("Erro ao verificar assinantes");
      return;
    }

    const activeSubscriptions = subscriptions?.filter(s => s.status !== 'canceled') || [];
    const totalSubscriptions = subscriptions?.length || 0;

    setPlanToDelete(plan);
    setSubscriberCount({
      active: activeSubscriptions.length,
      total: totalSubscriptions
    });
    setDeleteDialogOpen(true);
  };

  const handleDeactivatePlan = async () => {
    if (!planToDelete) return;

    try {
      const { error } = await supabase
        .from("barber_plans")
        .update({ is_active: false, is_published: false })
        .eq("id", planToDelete.id);

      if (error) throw error;

      toast.success("Plano desativado com sucesso");
      fetchPlans();
    } catch (error) {
      console.error("Error deactivating plan:", error);
      toast.error("Erro ao desativar plano");
    } finally {
      setDeleteDialogOpen(false);
      setPlanToDelete(null);
      setSubscriberCount(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!planToDelete) return;

    try {
      // 1. Excluir assinaturas canceladas vinculadas ao plano
      await supabase
        .from("client_club_subscriptions")
        .delete()
        .eq("plan_id", planToDelete.id)
        .eq("status", "canceled");

      // 2. Excluir itens do plano
      await supabase
        .from("barber_plan_items")
        .delete()
        .eq("plan_id", planToDelete.id);

      // 3. Excluir checkout sessions pendentes
      await supabase
        .from("client_checkout_sessions")
        .delete()
        .eq("plan_id", planToDelete.id);

      // 4. Excluir o plano
      const { error } = await supabase
        .from("barber_plans")
        .delete()
        .eq("id", planToDelete.id);

      if (error) throw error;

      toast.success("Plano excluído com sucesso");
      fetchPlans();
    } catch (error) {
      console.error("Error deleting plan:", error);
      toast.error("Erro ao excluir plano. Verifique se não há dados vinculados.");
    } finally {
      setDeleteDialogOpen(false);
      setPlanToDelete(null);
      setSubscriberCount(null);
    }
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setEditingPlan(null);
  };

  const handlePlanSaved = () => {
    fetchPlans();
    handleModalClose();
  };

  const handlePublishPlan = async (plan: BarberPlan) => {
    if (!barbershop?.id) return;
    
    setPublishingPlanId(plan.id);
    
    try {
      // Fetch subscription status directly from Supabase to ensure accuracy
      const { data: subscriptionData, error: subError } = await supabase
        .from("subscriptions")
        .select("status")
        .eq("barbershop_id", barbershop.id)
        .single();

      if (subError && subError.code !== "PGRST116") {
        throw subError;
      }

      // Check if barbershop has active subscription
      const hasActiveSubscription = subscriptionData?.status === "active";

      if (!hasActiveSubscription) {
        // Not subscribed - show the upgrade modal
        setPublishingPlanId(null);
        setPublishModalOpen(true);
        return;
      }

      // User has active subscription, proceed to publish
      const { error } = await supabase
        .from("barber_plans")
        .update({ is_published: true })
        .eq("id", plan.id);

      if (error) throw error;

      toast.success("Plano publicado com sucesso! Agora seus clientes podem assinar.");
      fetchPlans();
    } catch (error) {
      console.error("Error publishing plan:", error);
      toast.error("Erro ao publicar plano");
    } finally {
      setPublishingPlanId(null);
    }
  };

  const handleCancelSubscription = async () => {
    if (!subscriberToCancel || !barbershop?.id) return;
    
    setCancellingSubscription(true);
    
    try {
      if (subscriberToCancel.payment_origin === "manual") {
        // Manual subscription: directly update DB
        const { error } = await supabase
          .from("client_club_subscriptions")
          .update({ status: "canceled" })
          .eq("id", subscriberToCancel.id);
        
        if (error) throw error;
        
        toast.success("Assinatura manual cancelada");
        fetchSubscribers();
      } else {
        // Asaas subscription: send webhook
        const response = await fetch("https://webhook.lernow.com/webhook/cliente-barber-cancelar-assinatura-skjool", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            subscription_id: subscriberToCancel.id,
            client_id: subscriberToCancel.client_id,
            barbershop_id: barbershop.id,
          }),
        });
        
        if (!response.ok) {
          throw new Error("Erro ao enviar solicitação de cancelamento");
        }
        
        toast.success("Solicitação de cancelamento enviada ao Asaas. O status será atualizado em breve.");
      }
    } catch (error) {
      console.error("Error cancelling subscription:", error);
      toast.error("Erro ao cancelar assinatura");
    } finally {
      setCancellingSubscription(false);
      setCancelDialogOpen(false);
      setSubscriberToCancel(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      active: { label: "Ativo", variant: "default" },
      pending: { label: "Pendente", variant: "secondary" },
      overdue: { label: "Vencido", variant: "destructive" },
      cancelled: { label: "Cancelado", variant: "outline" },
      canceled: { label: "Cancelado", variant: "outline" },
    };
    const config = statusMap[status] || { label: status, variant: "secondary" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <div className="container mx-auto p-4 pb-24 md:pb-8 space-y-6">

      {/* Draft Plans CTA Banner */}
      {hasDraftPlans && !isActive && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertTitle className="text-amber-500">Planos em Rascunho</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            Seus planos do clube estão em modo rascunho. Assine o Skejool Pro para ativá-los e começar a vender para seus clientes.
            <Button 
              variant="link" 
              className="text-amber-500 hover:text-amber-400 p-0 h-auto ml-1"
              onClick={() => navigate("/plans")}
            >
              <Sparkles className="h-3 w-3 mr-1" />
              Fazer upgrade
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="plans" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="plans" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Planos
          </TabsTrigger>
          <TabsTrigger value="subscribers" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Assinantes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="mt-6">
          {plans.length === 0 ? (
            <EmptyState
              icon={<Package className="h-10 w-10 text-muted-foreground" />}
              title="Nenhum plano criado"
              description="Crie seu primeiro plano de assinatura para começar a fidelizar clientes"
              action={
                <Button onClick={handleCreatePlan}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Plano
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan) => (
                <Card key={plan.id} className={cn(
                  "relative overflow-hidden",
                  !plan.is_published && "border-amber-500/30"
                )}>
                  {/* Draft Badge */}
                  {!plan.is_published && (
                    <div className="absolute top-0 left-0 px-2 py-1 bg-amber-500/20 border-b border-r border-amber-500/30 rounded-br-lg">
                      <span className="text-xs font-medium text-amber-500">Rascunho</span>
                    </div>
                  )}
                  <div className="absolute top-0 right-0 p-2 flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleEditPlan(plan)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteClick(plan)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg pr-16">{plan.name}</CardTitle>
                    {plan.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {plan.description}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-primary">
                        {formatPrice(plan.price)}
                      </span>
                      <span className="text-muted-foreground">
                        /{plan.interval === "month" ? "mês" : "ano"}
                      </span>
                    </div>

                    {plan.items && plan.items.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Incluso:</p>
                        <ul className="space-y-1">
                          {plan.items.map((item) => (
                            <li
                              key={item.id}
                              className="text-sm text-muted-foreground flex items-center gap-2"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                              {item.service?.name || "Serviço"}
                              {item.quantity_limit && item.quantity_limit > 0 ? (
                                <Badge variant="outline" className="ml-auto text-xs">
                                  {item.quantity_limit}x
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="ml-auto text-xs">
                                  Ilimitado
                                </Badge>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Status Badge or Publish Button */}
                    <div className="flex items-center gap-2">
                      {!plan.is_published ? (
                        <Button
                          size="sm"
                          onClick={() => handlePublishPlan(plan)}
                          disabled={publishingPlanId === plan.id}
                          className="gap-1.5"
                        >
                          {publishingPlanId === plan.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Rocket className="w-3.5 h-3.5" />
                          )}
                          Publicar Plano
                        </Button>
                      ) : (
                        <Badge variant="default" className="bg-success text-success-foreground">
                          Publicado
                        </Badge>
                      )}
                      <Badge variant={plan.is_active ? "secondary" : "outline"}>
                        {plan.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="subscribers" className="mt-6">
          {/* Header with Add Manual Subscriber button */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Assinantes</h2>
            <Button 
              onClick={() => setManualSubscriptionModalOpen(true)}
              variant="outline"
              className="gap-2"
            >
              <UserPlus className="w-4 h-4" />
              <span className="hidden sm:inline">Novo Assinante Manual</span>
              <span className="sm:hidden">Adicionar</span>
            </Button>
          </div>

          {subscribers.length === 0 ? (
            <EmptyState
              icon={<Users className="h-10 w-10 text-muted-foreground" />}
              title="Nenhum assinante"
              description="Quando clientes assinarem seus planos, eles aparecerão aqui"
            />
          ) : (
            <div className="space-y-4">
              {subscribers.map((sub) => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const dueDate = sub.next_due_date ? new Date(sub.next_due_date) : null;
                if (dueDate) dueDate.setHours(0, 0, 0, 0);
                const isExpired = dueDate && sub.status === "active" ? dueDate < today : false;
                
                return (
                  <Card key={sub.id}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-4">
                        {/* Avatar with crown */}
                        <div className="relative">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-primary font-semibold">
                              {sub.client?.nome?.charAt(0).toUpperCase() || "C"}
                            </span>
                          </div>
                          {sub.status === "active" && (
                            <div className="absolute -top-1 -right-1">
                              <VipBadge status={sub.status} nextDueDate={sub.next_due_date} size="sm" />
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{sub.client?.nome || "Cliente"}</p>
                            <VipCrown status={sub.status} nextDueDate={sub.next_due_date} />
                          </div>
                          <p className="text-sm text-muted-foreground">{sub.client?.telefone || "Sem telefone"}</p>
                        </div>
                      </div>
                      <div className="text-right space-y-2">
                        <p className="text-sm font-medium">{sub.plan?.name || "Plano"}</p>
                        <div className="flex items-center gap-2">
                          {isExpired ? (
                            <Badge variant="destructive">Vencido</Badge>
                          ) : (
                            getStatusBadge(sub.status || "pending")
                          )}
                          {sub.next_due_date && (
                            <span className={`text-xs ${isExpired ? 'text-red-500' : 'text-muted-foreground'}`}>
                              {new Date(sub.next_due_date).toLocaleDateString("pt-BR")}
                            </span>
                          )}
                        </div>
                        {/* Renewal Button for manual subscriptions */}
                        {sub.payment_origin === "manual" && sub.status === "active" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-xs"
                            onClick={() => {
                              setRenewalSubscriber(sub);
                              setRenewalModalOpen(true);
                            }}
                          >
                            <RefreshCw className="w-3 h-3" />
                            Renovar
                          </Button>
                        )}
                        {/* Cancel Button for active subscriptions */}
                        {sub.status === "active" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              setSubscriberToCancel(sub);
                              setCancelDialogOpen(true);
                            }}
                          >
                            <XCircle className="w-3 h-3" />
                            Cancelar
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <FAB icon={<Plus className="h-6 w-6" />} onClick={handleCreatePlan} className="md:hidden" />

      <PublishPlanModal 
        open={publishModalOpen} 
        onClose={() => setPublishModalOpen(false)} 
      />

      <ClubPlanModal
        open={modalOpen}
        onClose={handleModalClose}
        onSaved={handlePlanSaved}
        plan={editingPlan}
        barbershopId={barbershop?.id || ""}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => {
        setDeleteDialogOpen(open);
        if (!open) {
          setPlanToDelete(null);
          setSubscriberCount(null);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gerenciar plano</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>
                  O que deseja fazer com o plano "<strong>{planToDelete?.name}</strong>"?
                </p>
                {subscriberCount?.active !== undefined && subscriberCount.active > 0 && (
                  <p className="mt-2 text-amber-500">
                    Este plano possui <strong>{subscriberCount.active} assinante(s) ativo(s)</strong>.
                  </p>
                )}
                {subscriberCount?.total !== undefined && subscriberCount.total > 0 && subscriberCount.active === 0 && (
                  <p className="mt-2 text-muted-foreground">
                    Este plano possui {subscriberCount.total} assinatura(s) cancelada(s) no histórico.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            
            <Button
              variant="outline"
              onClick={handleDeactivatePlan}
              className="border-amber-500 text-amber-500 hover:bg-amber-500/10"
            >
              <Ban className="h-4 w-4 mr-2" />
              Desativar
            </Button>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Button
                      variant="destructive"
                      onClick={handleDeleteConfirm}
                      disabled={subscriberCount?.active !== undefined && subscriberCount.active > 0}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </Button>
                  </span>
                </TooltipTrigger>
                {subscriberCount?.active !== undefined && subscriberCount.active > 0 && (
                  <TooltipContent side="top" className="max-w-xs">
                    <p>Para excluir, cancele primeiro as assinaturas ativas na aba "Assinantes".</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Manual Subscription Modal */}
      <ManualSubscriptionModal
        open={manualSubscriptionModalOpen}
        onClose={() => setManualSubscriptionModalOpen(false)}
        onSuccess={() => {
          fetchSubscribers();
        }}
        barbershopId={barbershop?.id || ""}
        userId={user?.id || ""}
        showClientSearch={true}
      />

      {/* Renewal Modal */}
      {renewalSubscriber && (
        <RenewalModal
          open={renewalModalOpen}
          onClose={() => {
            setRenewalModalOpen(false);
            setRenewalSubscriber(null);
          }}
          onSuccess={() => {
            fetchSubscribers();
          }}
          subscriptionId={renewalSubscriber.id}
          clientName={renewalSubscriber.client?.nome || "Cliente"}
          planName={renewalSubscriber.plan?.name || "Plano"}
          planPrice={renewalSubscriber.plan?.price || 0}
          nextDueDate={renewalSubscriber.next_due_date || ""}
          barbershopId={barbershop?.id || ""}
          clientId={renewalSubscriber.client_id}
        />
      )}

      {/* Cancel Subscription Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar assinatura?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar a assinatura de{" "}
              <strong>{subscriberToCancel?.client?.nome || "este cliente"}</strong>?
              {subscriberToCancel?.payment_origin === "asaas" ? (
                <span className="block mt-2 text-warning">
                  Esta assinatura é gerenciada pelo Asaas. Uma solicitação de cancelamento será enviada.
                </span>
              ) : (
                <span className="block mt-2">
                  O status da assinatura será alterado para cancelado imediatamente.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancellingSubscription}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelSubscription}
              disabled={cancellingSubscription}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancellingSubscription ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Cancelando...
                </>
              ) : (
                "Confirmar Cancelamento"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </>
  );
}
