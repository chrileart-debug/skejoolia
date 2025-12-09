import { Header } from "@/components/layout/Header";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import {
  Scissors,
  DollarSign,
  Calendar,
  TrendingUp,
  Clock,
  User,
} from "lucide-react";
import { format, startOfDay, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Dashboard() {
  const { user } = useAuth();
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const monthStart = format(startOfMonth(today), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(today), "yyyy-MM-dd");

  // Fetch today's appointments
  const { data: todayAppointments = [] } = useQuery({
    queryKey: ["appointments-today", user?.id, todayStr],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("agendamentos")
        .select("*, cortes(nome_corte, preco_corte)")
        .eq("user_id", user.id)
        .eq("dia_do_corte", todayStr)
        .order("horario_corte", { ascending: true });
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
        .select("*, cortes(nome_corte, preco_corte)")
        .eq("user_id", user.id)
        .gte("dia_do_corte", monthStart)
        .lte("dia_do_corte", monthEnd);
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

  // Calculate stats
  const todayCuts = todayAppointments.length;
  const todayRevenue = todayAppointments.reduce((sum, apt) => {
    return sum + (apt.cortes?.preco_corte || 0);
  }, 0);

  const monthCuts = monthAppointments.length;
  const monthRevenue = monthAppointments.reduce((sum, apt) => {
    return sum + (apt.cortes?.preco_corte || 0);
  }, 0);

  const pendingAppointments = todayAppointments.filter(
    (apt) => apt.status === "pending" || apt.status === "confirmed"
  );

  // Get next appointment (upcoming from now)
  const now = format(new Date(), "HH:mm:ss");
  const nextAppointment = todayAppointments.find(
    (apt) => apt.horario_corte >= now && (apt.status === "pending" || apt.status === "confirmed")
  );

  const formatTime = (time: string) => {
    return time.substring(0, 5);
  };

  const getStatusForBadge = (status: string | null) => {
    if (status === "confirmed") return "confirmed";
    if (status === "pending") return "pending";
    if (status === "completed") return "completed";
    return "pending";
  };

  return (
    <div className="min-h-screen">
      <Header
        title="Dashboard"
        subtitle="Visão geral da sua barbearia"
      />

      <div className="p-4 lg:p-6 space-y-6">
        {/* Stats Grid */}
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

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Upcoming Appointments */}
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
                          {appointment.cortes?.nome_corte || "Serviço"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right hidden sm:block">
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          {formatTime(appointment.horario_corte)}
                        </div>
                      </div>
                      <StatusBadge status={getStatusForBadge(appointment.status)} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            {/* Next Appointment */}
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
                      <p className="text-sm opacity-90">{nextAppointment.cortes?.nome_corte || "Serviço"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4" />
                    <span>{formatTime(nextAppointment.horario_corte)}</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  Nenhum cliente agendado
                </div>
              )}
            </div>

            {/* Agent Status */}
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

            {/* Monthly Summary */}
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
