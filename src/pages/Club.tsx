import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useBarbershop } from "@/hooks/useBarbershop";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FAB } from "@/components/shared/FAB";
import { EmptyState } from "@/components/shared/EmptyState";
import { Plus, Crown, Users, Package, Edit, Trash2, AlertTriangle, Sparkles, Rocket, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { ClubPlanModal } from "@/components/club/ClubPlanModal";
import { PublishPlanModal } from "@/components/club/PublishPlanModal";
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
  client?: {
    nome: string;
    telefone: string;
  };
  plan?: {
    name: string;
  };
}

export default function Club() {
  const { user } = useAuth();
  const { barbershop } = useBarbershop();
  const { isActive } = useSubscription();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<BarberPlan[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<BarberPlan | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<BarberPlan | null>(null);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [publishingPlanId, setPublishingPlanId] = useState<string | null>(null);
  
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
          next_due_date
        `)
        .eq("barbershop_id", barbershop.id);

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
            .select("name")
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

  const handleDeleteClick = (plan: BarberPlan) => {
    setPlanToDelete(plan);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!planToDelete) return;

    try {
      // Delete plan items first
      await supabase
        .from("barber_plan_items")
        .delete()
        .eq("plan_id", planToDelete.id);

      // Delete the plan
      const { error } = await supabase
        .from("barber_plans")
        .delete()
        .eq("id", planToDelete.id);

      if (error) throw error;

      toast.success("Plano excluído com sucesso");
      fetchPlans();
    } catch (error) {
      console.error("Error deleting plan:", error);
      toast.error("Erro ao excluir plano");
    } finally {
      setDeleteDialogOpen(false);
      setPlanToDelete(null);
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
    // If user doesn't have an active subscription, show the subscribe modal
    if (!isActive) {
      setPublishModalOpen(true);
      return;
    }

    // User is subscribed, proceed to publish
    setPublishingPlanId(plan.id);
    try {
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

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      active: { label: "Ativo", variant: "default" },
      pending: { label: "Pendente", variant: "secondary" },
      overdue: { label: "Vencido", variant: "destructive" },
      cancelled: { label: "Cancelado", variant: "outline" },
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
    <div className="container mx-auto p-4 pb-24 md:pb-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Crown className="h-6 w-6 text-primary" />
            Meu Clube
          </h1>
          <p className="text-muted-foreground">
            Gerencie seus planos de assinatura para clientes
          </p>
        </div>
        <Button onClick={handleCreatePlan} className="hidden md:flex">
          <Plus className="h-4 w-4 mr-2" />
          Novo Plano
        </Button>
      </div>

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
          {subscribers.length === 0 ? (
            <EmptyState
              icon={<Users className="h-10 w-10 text-muted-foreground" />}
              title="Nenhum assinante"
              description="Quando clientes assinarem seus planos, eles aparecerão aqui"
            />
          ) : (
            <div className="space-y-4">
              {subscribers.map((sub) => (
                <Card key={sub.id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {sub.client?.nome || "Cliente"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {sub.client?.telefone || "Sem telefone"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {sub.plan?.name || "Plano"}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {getStatusBadge(sub.status || "pending")}
                        {sub.next_due_date && (
                          <span className="text-xs text-muted-foreground">
                            Vence:{" "}
                            {new Date(sub.next_due_date).toLocaleDateString(
                              "pt-BR"
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir plano?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o plano "{planToDelete?.name}"? Esta
              ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
