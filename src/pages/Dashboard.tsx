import { useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SubscriptionCard } from "@/components/subscription/SubscriptionCard";
import { InstallBanner } from "@/components/pwa/InstallBanner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBarbershop } from "@/hooks/useBarbershop";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";
import {
  Scissors,
  DollarSign,
  Calendar,
  TrendingUp,
  Clock,
  User,
} from "lucide-react";
import { startOfDay, endOfDay, startOfMonth, endOfMonth } from "date-fns";

interface OutletContextType {
  onMenuClick: () => void;
}

const BRASILIA_TIMEZONE = 'America/Sao_Paulo';

const formatTimeFromISO = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleTimeString("pt-BR", { 
    hour: "2-digit", 
    minute: "2-digit",
    timeZone: BRASILIA_TIMEZONE 
  });
};

export default function Dashboard() {
  const { onMenuClick } = useOutletContext<OutletContextType>();
  const { user } = useAuth();
  const { barbershop } = useBarbershop();
  const queryClient = useQueryClient();
  const today = new Date();
  const todayStart = startOfDay(today).toISOString();
  const todayEnd = endOfDay(today).toISOString();
  const monthStart = startOfMonth(today).toISOString();
  const monthEnd = endOfMonth(today).toISOString();

  useEffect(() => {
    const updatePendingPlan = async () => {
      if (!user?.id) return;
      
      const pendingPlan = localStorage.getItem("pending_plan_slug");
      if (!pendingPlan) return;
      
      console.log("Atualizando plano pendente do OAuth:", pendingPlan);
      
      const { error } = await supabase
        .from("subscriptions")
        .update({ plan_slug: pendingPlan })
        .eq("user_id", user.id);
      
      if (error) {
        console.error("Erro ao atualizar plano:", error);
      } else {
        console.log("Plano atualizado com sucesso:", pendingPlan);
        localStorage.removeItem("pending_plan_slug");
        queryClient.invalidateQueries({ queryKey: ["subscription"] });
      }
    };
    
    updatePendingPlan();
  }, [user?.id, queryClient]);

  // Fetch services for price lookup
  const { data: servicesMap = {} } = useQuery({
    queryKey: ["services-map", barbershop?.id],
    queryFn: async () => {
      if (!barbershop?.id) return {};
      const { data, error } = await supabase
        .from("services")
        .select("id, name, price")
        .eq("barbershop_id", barbershop.id);
      if (error) throw error;
      return (data || []).reduce((acc, s) => {
        acc[s.id] = s;
        return acc;
      }, {} as Record<string, { id: string; name: string; price: number }>);
    },
    enabled: !!barbershop?.id,
  });

  // Fetch today's appointments
  const { data: todayAppointments = [] } = useQuery({
    queryKey: ["appointments-today", user?.id, todayStart],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("agendamentos")
        .select("*")
        .eq("user_id", user.id)
        .gte("start_time", todayStart)
        .lte("start_time", todayEnd)
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Fetch month appointments for stats
  const { data: monthAppointments = [] } = useQuery({
    queryKey: ["appointments-month", user?.id, monthStart, monthEnd],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("agendamentos")
        .select("*")
        .eq("user_id", user.id)
        .gte("start_time", monthStart)
        .lte("start_time", monthEnd);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Fetch agent status
  const { data: agent } = useQuery({
    queryKey: ["agent-status", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("agentes")
        .select("*")
        .eq("user_id", user.id)
        .eq("ativo", true)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Calculate stats using the services map
  const todayCuts = todayAppointments.length;
  const todayRevenue = todayAppointments.reduce((sum, apt) => {
    const service = apt.service_id ? servicesMap[apt.service_id] : null;
    return sum + (service?.price || 0);
  }, 0);

  const monthCuts = monthAppointments.length;
  const monthRevenue = monthAppointments.reduce((sum, apt) => {
    const service = apt.service_id ? servicesMap[apt.service_id] : null;
    return sum + (service?.price || 0);
  }, 0);

  const pendingAppointments = todayAppointments.filter(
    (apt) => apt.status === "pending" || apt.status === "confirmed"
  );

  const now = new Date().toISOString();
  const nextAppointment = todayAppointments.find(
    (apt) => apt.start_time >= now && (apt.status === "pending" || apt.status === "confirmed")
  );

  const getStatusForBadge = (status: string | null) => {
    if (status === "confirmed") return "confirmed";
    if (status === "pending") return "pending";
    if (status === "completed") return "completed";
    return "pending";
  };

  const getServiceName = (serviceId: string | null) => {
    if (!serviceId) return "Serviço";
    return servicesMap[serviceId]?.name || "Serviço";
  };

  return (
    <div className="min-h-screen">
      <Header
        title="Dashboard"
        subtitle="Visão geral da sua barbearia"
        onMenuClick={onMenuClick}
      />

      <div className="p-4 lg:p-6 space-y-6">
        <InstallBanner />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Cortes hoje"
            value={String(todayCuts)}
            icon={<Scissors className="w-5 h-5" />}
          />
          <StatCard
            title="Faturamento diário"
            value={`R$ ${todayRevenue.toFixed(0)}`}
            icon={<DollarSign className="w-5 h-5" />}
          />
          <StatCard
            title="Faturamento mensal"
            value={`R$ ${monthRevenue.toFixed(0)}`}
            icon={<TrendingUp className="w-5 h-5" />}
          />
          <StatCard
            title="Agendamentos"
            value={String(pendingAppointments.length)}
            icon={<Calendar className="w-5 h-5" />}
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-card rounded-2xl shadow-card p-5 animate-slide-up">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-foreground">
                Agendamentos de hoje
              </h2>
              <a
                href="/schedule"
                className="text-sm text-primary font-medium hover:underline"
              >
                Ver todos
              </a>
            </div>

            {todayAppointments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum agendamento para hoje
              </div>
            ) : (
              <div className="space-y-3">
                {todayAppointments.slice(0, 5).map((appointment) => (
                  <div
                    key={appointment.id_agendamento}
                    className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {appointment.nome_cliente || "Cliente"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {getServiceName(appointment.service_id)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right hidden sm:block">
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          {formatTimeFromISO(appointment.start_time)}
                        </div>
                      </div>
                      <StatusBadge status={getStatusForBadge(appointment.status)} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <SubscriptionCard />
            <div className="bg-card rounded-2xl shadow-card p-5 animate-slide-up">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                Próximo cliente
              </h3>
              {nextAppointment ? (
                <div className="gradient-primary rounded-xl p-4 text-primary-foreground">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                      <User className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-semibold">{nextAppointment.nome_cliente || "Cliente"}</p>
                      <p className="text-sm opacity-90">{getServiceName(nextAppointment.service_id)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4" />
                    <span>{formatTimeFromISO(nextAppointment.start_time)}</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  Nenhum cliente agendado
                </div>
              )}
            </div>

            <div className="bg-card rounded-2xl shadow-card p-5 animate-slide-up">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                Status do Agente IA
              </h3>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${agent ? "bg-success/10" : "bg-muted"} flex items-center justify-center`}>
                    <div className={`w-3 h-3 rounded-full ${agent ? "bg-success animate-pulse-soft" : "bg-muted-foreground"}`} />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{agent ? "Ativo" : "Inativo"}</p>
                    <p className="text-sm text-muted-foreground">
                      {agent?.nome || "Nenhum agente configurado"}
                    </p>
                  </div>
                </div>
                <StatusBadge status={agent ? "online" : "offline"} />
              </div>
            </div>

            <div className="bg-card rounded-2xl shadow-card p-5 animate-slide-up">
              <h3 className="text-sm font-medium text-muted-foreground mb-4">
                Resumo do mês
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total de cortes</span>
                  <span className="font-semibold text-foreground">{monthCuts}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Faturamento</span>
                  <span className="font-semibold text-foreground">R$ {monthRevenue.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Ticket médio</span>
                  <span className="font-semibold text-foreground">
                    R$ {monthCuts > 0 ? (monthRevenue / monthCuts).toFixed(2) : "0,00"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
