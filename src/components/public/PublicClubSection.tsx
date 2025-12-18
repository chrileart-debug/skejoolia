import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Crown,
  Check,
  Clock,
  Sparkles,
} from "lucide-react";
import { PublicClubCheckoutModal } from "./PublicClubCheckoutModal";

interface BarberPlan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  interval: string | null;
  is_published: boolean | null;
}

interface PlanItem {
  id: string;
  plan_id: string;
  service_id: string;
  quantity_limit: number | null;
  service_name?: string;
}

interface Service {
  id: string;
  name: string;
}

interface PublicClubSectionProps {
  barbershopId: string;
  barbershopName: string;
}

const formatPrice = (price: number): string => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(price);
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

export const PublicClubSection = ({ barbershopId, barbershopName }: PublicClubSectionProps) => {
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<BarberPlan[]>([]);
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<BarberPlan | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const [plansRes, itemsRes, servicesRes] = await Promise.all([
          supabase
            .from("barber_plans")
            .select("*")
            .eq("barbershop_id", barbershopId)
            .eq("is_active", true)
            .order("price"),
          supabase
            .from("barber_plan_items")
            .select("*"),
          supabase
            .from("services")
            .select("id, name")
            .eq("barbershop_id", barbershopId)
            .eq("is_active", true),
        ]);

        if (plansRes.data) setPlans(plansRes.data);
        if (itemsRes.data) setPlanItems(itemsRes.data);
        if (servicesRes.data) setServices(servicesRes.data);
      } catch (error) {
        console.error("Error fetching plans:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();
  }, [barbershopId]);

  const getServiceName = (serviceId: string): string => {
    const service = services.find((s) => s.id === serviceId);
    return service?.name || "Serviço";
  };

  const getPlanItems = (planId: string): PlanItem[] => {
    return planItems.filter((item) => item.plan_id === planId);
  };

  const handleSubscribe = (plan: BarberPlan) => {
    setSelectedPlan(plan);
    setCheckoutOpen(true);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (plans.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Crown className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Clubes de Assinatura</h2>
          <p className="text-sm text-muted-foreground">Assine e economize em seus serviços favoritos</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {plans.map((plan) => {
          const items = getPlanItems(plan.id);
          const isPublished = plan.is_published ?? false;

          return (
            <div
              key={plan.id}
              className={cn(
                "relative bg-card rounded-xl border overflow-hidden transition-all",
                isPublished
                  ? "border-border hover:shadow-lg hover:border-primary/50"
                  : "border-warning/30 bg-warning/5"
              )}
            >
              {/* Draft badge */}
              {!isPublished && (
                <div className="absolute top-3 right-3">
                  <span className="px-2 py-1 text-xs font-medium bg-warning/20 text-warning rounded-full flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Em breve
                  </span>
                </div>
              )}

              <div className="p-6">
                {/* Header */}
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                  {plan.description && (
                    <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                  )}
                </div>

                {/* Price */}
                <div className="mb-6">
                  <span className="text-3xl font-bold text-primary">
                    {formatPrice(plan.price)}
                  </span>
                  <span className="text-muted-foreground">
                    {getIntervalLabel(plan.interval)}
                  </span>
                </div>

                {/* Services included */}
                {items.length > 0 && (
                  <div className="space-y-2 mb-6">
                    <p className="text-sm font-medium text-foreground">Incluso no plano:</p>
                    <ul className="space-y-2">
                      {items.map((item) => (
                        <li key={item.id} className="flex items-center gap-2 text-sm">
                          <Check className="w-4 h-4 text-primary flex-shrink-0" />
                          <span className="text-muted-foreground">
                            {item.quantity_limit === 0 || item.quantity_limit === null
                              ? "Ilimitado"
                              : `${item.quantity_limit}x`}{" "}
                            {getServiceName(item.service_id)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* CTA Button */}
                {isPublished ? (
                  <Button
                    onClick={() => handleSubscribe(plan)}
                    className="w-full gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    Assinar Plano
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <Button
                      disabled
                      variant="outline"
                      className="w-full border-warning/30 text-warning cursor-not-allowed"
                    >
                      <Clock className="w-4 h-4 mr-2" />
                      Assinaturas em breve
                    </Button>
                    <p className="text-xs text-center text-muted-foreground">
                      Estamos preparando novidades para você!
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Checkout Modal */}
      {selectedPlan && (
        <PublicClubCheckoutModal
          open={checkoutOpen}
          onOpenChange={setCheckoutOpen}
          plan={selectedPlan}
          barbershopId={barbershopId}
          barbershopName={barbershopName}
        />
      )}
    </div>
  );
};
