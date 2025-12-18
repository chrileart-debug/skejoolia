import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Crown,
  Check,
  Clock,
  Sparkles,
  Loader2,
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

interface ClientData {
  client_id: string;
  nome: string | null;
  telefone: string | null;
  email: string | null;
}

interface PublicClubSectionProps {
  barbershopId: string;
  barbershopName: string;
  loggedInClient?: ClientData | null;
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

export const PublicClubSection = ({ barbershopId, barbershopName, loggedInClient }: PublicClubSectionProps) => {
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<BarberPlan[]>([]);
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<BarberPlan | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [directCheckoutLoading, setDirectCheckoutLoading] = useState<string | null>(null);

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

  // Direct webhook call for identified clients
  const handleDirectCheckout = async (plan: BarberPlan) => {
    if (!loggedInClient) return;

    console.log("🚀 Direct checkout for identified client:", loggedInClient.client_id);
    setDirectCheckoutLoading(plan.id);

    try {
      const cleanPhone = loggedInClient.telefone?.replace(/\D/g, "") || "";
      
      const payload = {
        action: "subscribe_plan",
        barbershop_id: barbershopId,
        plan_id: plan.id,
        client_id: loggedInClient.client_id,
        customer_details: {
          name: loggedInClient.nome || "",
          email: loggedInClient.email || "",
          phone: cleanPhone,
        },
      };

      console.log("📤 Sending direct payload to n8n:", payload);

      const response = await fetch("https://webhook.lernow.com/webhook/asaas-meu-clube", {
        method: "POST",
        mode: "cors",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      console.log("📥 n8n Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Response not ok:", errorText);
        throw new Error(`Failed to submit subscription: ${response.status}`);
      }

      const data = await response.json();
      console.log("📥 n8n Response data:", data);

      if (data.checkout_url) {
        console.log("🔗 Redirecting to checkout:", data.checkout_url);
        window.location.href = data.checkout_url;
        return;
      }

      toast.success("Solicitação enviada com sucesso!");
    } catch (error) {
      console.error("❌ Direct checkout error:", error);
      toast.error("Erro ao conectar com o servidor de pagamentos. Tente novamente.");
    } finally {
      setDirectCheckoutLoading(null);
    }
  };

  const handleSubscribe = (plan: BarberPlan) => {
    // Path B: Client already identified - skip modal, send directly
    if (loggedInClient?.client_id && loggedInClient?.nome && loggedInClient?.telefone) {
      handleDirectCheckout(plan);
      return;
    }

    // Path A: Client not identified - show modal
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
                    disabled={directCheckoutLoading === plan.id}
                  >
                    {directCheckoutLoading === plan.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Preparando seu checkout...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Assinar Plano
                      </>
                    )}
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

      {/* Checkout Modal - only for non-identified clients */}
      {selectedPlan && (
        <PublicClubCheckoutModal
          open={checkoutOpen}
          onOpenChange={setCheckoutOpen}
          plan={selectedPlan}
          barbershopId={barbershopId}
          barbershopName={barbershopName}
          loggedInClientId={loggedInClient?.client_id}
        />
      )}
    </div>
  );
};
