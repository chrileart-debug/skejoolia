import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  User,
  Crown,
  Scissors,
  Calendar,
  LogOut,
  Sparkles,
  Check,
  Gift,
} from "lucide-react";

interface ClientData {
  client_id: string;
  nome: string | null;
  telefone: string | null;
  email: string | null;
  total_cortes: number | null;
  faturamento_total: number | null;
  last_visit: string | null;
}

interface Subscription {
  id: string;
  status: string | null;
  plan_id: string;
  next_due_date: string | null;
}

interface Plan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  interval: string | null;
}

interface PlanItem {
  id: string;
  service_id: string;
  quantity_limit: number | null;
  service_name?: string;
}

interface ServiceUsage {
  service_id: string;
  count: number;
}

interface ClientPortalProps {
  client: ClientData;
  barbershopId: string;
  barbershopName: string;
  onLogout: () => void;
  onNavigateToBooking: () => void;
}

const formatPrice = (price: number): string => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(price);
};

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return "Nunca";
  const date = new Date(dateStr);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getIntervalLabel = (interval: string | null): string => {
  switch (interval) {
    case "week":
      return "/semana";
    case "year":
      return "/ano";
    default:
      return "/mês";
  }
};

export const ClientPortal = ({
  client,
  barbershopId,
  barbershopName,
  onLogout,
  onNavigateToBooking,
}: ClientPortalProps) => {
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [services, setServices] = useState<{ id: string; name: string }[]>([]);
  const [usage, setUsage] = useState<ServiceUsage[]>([]);

  useEffect(() => {
    const fetchSubscriptionData = async () => {
      try {
        // Fetch active subscription for this client
        const { data: subData } = await supabase
          .from("client_club_subscriptions")
          .select("*")
          .eq("client_id", client.client_id)
          .eq("barbershop_id", barbershopId)
          .eq("status", "active")
          .single();

        if (subData) {
          setSubscription(subData);

          // Fetch plan details
          const { data: planData } = await supabase
            .from("barber_plans")
            .select("*")
            .eq("id", subData.plan_id)
            .single();

          if (planData) {
            setPlan(planData);

            // Fetch plan items
            const { data: itemsData } = await supabase
              .from("barber_plan_items")
              .select("*")
              .eq("plan_id", planData.id);

            if (itemsData) setPlanItems(itemsData);
          }

          // Fetch usage for current period (this month)
          const startOfMonth = new Date();
          startOfMonth.setDate(1);
          startOfMonth.setHours(0, 0, 0, 0);

          const { data: usageData } = await supabase
            .from("client_subscription_usage")
            .select("service_id")
            .eq("subscription_id", subData.id)
            .gte("used_at", startOfMonth.toISOString());

          if (usageData) {
            // Group by service_id
            const usageMap: Record<string, number> = {};
            usageData.forEach((u) => {
              usageMap[u.service_id] = (usageMap[u.service_id] || 0) + 1;
            });
            setUsage(
              Object.entries(usageMap).map(([service_id, count]) => ({
                service_id,
                count,
              }))
            );
          }
        }

        // Fetch services for name lookup
        const { data: servicesData } = await supabase
          .from("services")
          .select("id, name")
          .eq("barbershop_id", barbershopId)
          .eq("is_active", true);

        if (servicesData) setServices(servicesData);
      } catch (error) {
        console.error("Error fetching subscription data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscriptionData();
  }, [client.client_id, barbershopId]);

  const getServiceName = (serviceId: string): string => {
    const service = services.find((s) => s.id === serviceId);
    return service?.name || "Serviço";
  };

  const getUsageForService = (serviceId: string): number => {
    const usageItem = usage.find((u) => u.service_id === serviceId);
    return usageItem?.count || 0;
  };

  const getRemainingCredits = (serviceId: string, limit: number | null): string => {
    if (limit === 0 || limit === null) return "Ilimitado";
    const used = getUsageForService(serviceId);
    const remaining = Math.max(0, limit - used);
    return `${remaining} restante${remaining !== 1 ? "s" : ""}`;
  };

  if (loading) {
    return (
      <div className="space-y-6 p-4">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome Card */}
      <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-xl border border-primary/20 p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center">
              <User className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">
                Olá, {client.nome || "Cliente"}!
              </h2>
              <p className="text-sm text-muted-foreground">
                Bem-vindo(a) de volta ao {barbershopName}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onLogout} className="text-muted-foreground">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Scissors className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{client.total_cortes || 0}</p>
              <p className="text-xs text-muted-foreground">Serviços realizados</p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground line-clamp-1">
                {formatDate(client.last_visit)}
              </p>
              <p className="text-xs text-muted-foreground">Última visita</p>
            </div>
          </div>
        </div>
      </div>

      {/* Subscription Card */}
      {subscription && plan ? (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-6 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Crown className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">{plan.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {formatPrice(plan.price)}
                  {getIntervalLabel(plan.interval)}
                </p>
              </div>
              <span className="ml-auto px-3 py-1 text-xs font-medium bg-success/10 text-success rounded-full">
                Ativo
              </span>
            </div>
          </div>

          {planItems.length > 0 && (
            <div className="p-6 space-y-4">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Gift className="w-4 h-4 text-primary" />
                Seus Créditos
              </h4>
              <div className="space-y-3">
                {planItems.map((item) => {
                  const usedCount = getUsageForService(item.service_id);
                  const limit = item.quantity_limit;
                  const isUnlimited = limit === 0 || limit === null;
                  const remaining = isUnlimited ? 999 : Math.max(0, (limit || 0) - usedCount);
                  const percentage = isUnlimited ? 100 : ((remaining / (limit || 1)) * 100);

                  return (
                    <div key={item.id} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-foreground font-medium">
                          {getServiceName(item.service_id)}
                        </span>
                        <span className={cn(
                          "text-xs font-medium",
                          isUnlimited ? "text-success" : remaining > 0 ? "text-primary" : "text-destructive"
                        )}>
                          {getRemainingCredits(item.service_id, limit)}
                        </span>
                      </div>
                      {!isUnlimited && (
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              percentage > 50 ? "bg-primary" : percentage > 20 ? "bg-warning" : "bg-destructive"
                            )}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      )}
                      {!isUnlimited && (
                        <p className="text-xs text-muted-foreground">
                          {usedCount} de {limit} usados este mês
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-gradient-to-br from-primary/5 to-transparent rounded-xl border border-dashed border-primary/30 p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Crown className="w-6 h-6 text-primary" />
          </div>
          <h3 className="font-semibold text-foreground mb-2">Ainda não é assinante?</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Conheça nossos planos e economize em seus serviços favoritos!
          </p>
        </div>
      )}

      {/* Book Now CTA */}
      <Button onClick={onNavigateToBooking} className="w-full gap-2" size="lg">
        <Sparkles className="w-4 h-4" />
        {subscription ? "Agendar com meus créditos" : "Fazer um agendamento"}
      </Button>
    </div>
  );
};
