import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SubscriptionCard } from "@/components/subscription/SubscriptionCard";
import { InstallBanner } from "@/components/pwa/InstallBanner";
import { SmartBookingModal } from "@/components/schedule/SmartBookingModal";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBarbershop } from "@/hooks/useBarbershop";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  Wallet,
  TrendingUp,
  Clock,
  User,
  Plus,
  UserPlus,
  Receipt,
  ChevronRight,
  CalendarDays,
} from "lucide-react";
import { startOfDay, endOfDay, subDays, format, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

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

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { onMenuClick } = useOutletContext<OutletContextType>();
  const { user } = useAuth();
  const { barbershop } = useBarbershop();
  const queryClient = useQueryClient();
  const [bookingModalOpen, setBookingModalOpen] = useState(false);

  const today = new Date();
  const todayStart = startOfDay(today).toISOString();
  const todayEnd = endOfDay(today).toISOString();
  const weekStart = subDays(startOfDay(today), 6).toISOString();

  // Handle pending OAuth plan update
  useEffect(() => {
    const updatePendingPlan = async () => {
      if (!user?.id) return;
      
      const pendingPlan = localStorage.getItem("pending_plan_slug");
      if (!pendingPlan) return;
      
      const { error } = await supabase
        .from("subscriptions")
        .update({ plan_slug: pendingPlan })
        .eq("user_id", user.id);
      
      if (!error) {
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

  // Fetch user settings for professional names
  const { data: staffMap = {} } = useQuery({
    queryKey: ["staff-map", barbershop?.id],
    queryFn: async () => {
      if (!barbershop?.id) return {};
      const { data, error } = await supabase
        .from("user_barbershop_roles")
        .select("user_id")
        .eq("barbershop_id", barbershop.id);
      if (error) throw error;
      
      const userIds = (data || []).map(d => d.user_id);
      if (userIds.length === 0) return {};
      
      const { data: settings } = await supabase
        .from("user_settings")
        .select("user_id, nome")
        .in("user_id", userIds);
      
      return (settings || []).reduce((acc, s) => {
        acc[s.user_id] = s.nome || "Profissional";
        return acc;
      }, {} as Record<string, string>);
    },
    enabled: !!barbershop?.id,
  });

  // Fetch today's appointments
  const { data: todayAppointments = [] } = useQuery({
    queryKey: ["appointments-today", barbershop?.id, todayStart],
    queryFn: async () => {
      if (!barbershop?.id) return [];
      const { data, error } = await supabase
        .from("agendamentos")
        .select("*")
        .eq("barbershop_id", barbershop.id)
        .gte("start_time", todayStart)
        .lte("start_time", todayEnd)
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!barbershop?.id,
  });

  // Fetch last 7 days appointments for chart
  const { data: weekAppointments = [] } = useQuery({
    queryKey: ["appointments-week", barbershop?.id, weekStart],
    queryFn: async () => {
      if (!barbershop?.id) return [];
      const { data, error } = await supabase
        .from("agendamentos")
        .select("start_time")
        .eq("barbershop_id", barbershop.id)
        .gte("start_time", weekStart)
        .lte("start_time", todayEnd);
      if (error) throw error;
      return data || [];
    },
    enabled: !!barbershop?.id,
  });

  // Fetch agent status
  const { data: agent } = useQuery({
    queryKey: ["agent-status", barbershop?.id],
    queryFn: async () => {
      if (!barbershop?.id) return null;
      const { data, error } = await supabase
        .from("agentes")
        .select("*")
        .eq("barbershop_id", barbershop.id)
        .eq("ativo", true)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!barbershop?.id,
  });

  // Calculate KPIs
  const todayCount = todayAppointments.length;
  const todayRevenue = todayAppointments.reduce((sum, apt) => {
    const service = apt.service_id ? servicesMap[apt.service_id] : null;
    return sum + (service?.price || 0);
  }, 0);
  const avgTicket = todayCount > 0 ? todayRevenue / todayCount : 0;

  // Get upcoming appointments (from now onwards)
  const now = new Date().toISOString();
  const upcomingAppointments = todayAppointments.filter(
    (apt) => apt.start_time >= now && (apt.status === "pending" || apt.status === "confirmed")
  ).slice(0, 5);

  // Build weekly chart data
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(today, 6 - i);
    const dateStr = format(date, 'yyyy-MM-dd');
    const count = weekAppointments.filter(apt => {
      const aptDate = format(new Date(apt.start_time), 'yyyy-MM-dd');
      return aptDate === dateStr;
    }).length;
    
    return {
      day: format(date, 'EEE', { locale: ptBR }),
      fullDate: format(date, 'dd/MM'),
      count,
      isToday: isToday(date),
    };
  });

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

  const getProfessionalName = (userId: string) => {
    return staffMap[userId] || "Profissional";
  };

  const handleBookingSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["appointments-today"] });
    queryClient.invalidateQueries({ queryKey: ["appointments-week"] });
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

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2">
          <Button 
            onClick={() => setBookingModalOpen(true)}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            Novo Agendamento
          </Button>
          <Button 
            variant="outline" 
            onClick={() => navigate("/clients")}
            className="gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Cadastrar Cliente
          </Button>
          <Button 
            variant="outline" 
            onClick={() => navigate("/billing")}
            className="gap-2"
          >
            <Receipt className="w-4 h-4" />
            Ver Financeiro
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Appointments Today */}
          <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-primary" />
              </div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Hoje</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{todayCount}</p>
            <p className="text-sm text-muted-foreground">Agendamentos</p>
          </div>

          {/* Revenue Today */}
          <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                <Wallet className="w-6 h-6 text-success" />
              </div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Hoje</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{formatCurrency(todayRevenue)}</p>
            <p className="text-sm text-muted-foreground">Faturamento Estimado</p>
          </div>

          {/* Average Ticket */}
          <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-amber-500" />
              </div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Hoje</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{formatCurrency(avgTicket)}</p>
            <p className="text-sm text-muted-foreground">Ticket Médio</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Timeline & Chart */}
          <div className="lg:col-span-2 space-y-6">
            {/* Happening Now Timeline */}
            <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="p-5 border-b border-border flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Acontecendo Agora</h2>
                  <p className="text-sm text-muted-foreground">Próximos agendamentos do dia</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate("/schedule")} className="gap-1">
                  Ver todos
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              <div className="divide-y divide-border">
                {upcomingAppointments.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">Nenhum agendamento pendente</p>
                    <p className="text-sm mt-1">Aproveite o tempo livre!</p>
                  </div>
                ) : (
                  upcomingAppointments.map((apt, index) => (
                    <div
                      key={apt.id_agendamento}
                      className={`flex items-center gap-4 p-4 transition-colors hover:bg-muted/30 ${index === 0 ? 'bg-primary/5' : ''}`}
                    >
                      {/* Time */}
                      <div className="w-16 text-center flex-shrink-0">
                        <p className={`text-lg font-semibold ${index === 0 ? 'text-primary' : 'text-foreground'}`}>
                          {formatTimeFromISO(apt.start_time)}
                        </p>
                        {index === 0 && (
                          <span className="text-[10px] uppercase tracking-wider font-medium text-primary">Próximo</span>
                        )}
                      </div>

                      {/* Divider line */}
                      <div className="w-px h-12 bg-border relative">
                        <div className={`absolute top-1/2 -translate-y-1/2 -left-1.5 w-3 h-3 rounded-full border-2 ${index === 0 ? 'bg-primary border-primary' : 'bg-background border-muted-foreground/30'}`} />
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground truncate">
                            {apt.nome_cliente || "Cliente"}
                          </p>
                          <StatusBadge status={getStatusForBadge(apt.status)} />
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {getServiceName(apt.service_id)}
                        </p>
                      </div>

                      {/* Professional Avatar */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                          <User className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <span className="text-xs text-muted-foreground hidden sm:inline">
                          {getProfessionalName(apt.user_id)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Weekly Chart */}
            <div className="bg-card rounded-2xl border border-border shadow-sm p-5">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-foreground">Atividade Semanal</h2>
                <p className="text-sm text-muted-foreground">Agendamentos nos últimos 7 dias</p>
              </div>

              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis 
                      dataKey="day" 
                      axisLine={false} 
                      tickLine={false}
                      tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false}
                      tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                      allowDecimals={false}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const data = payload[0].payload;
                        return (
                          <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg">
                            <p className="text-sm font-medium">{data.fullDate}</p>
                            <p className="text-xs text-muted-foreground">
                              {data.count} agendamento{data.count !== 1 ? 's' : ''}
                            </p>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.isToday ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.3)'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-4">
            <SubscriptionCard />

            {/* Agent Status */}
            <div className="bg-card rounded-2xl border border-border shadow-sm p-5">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                Status do Agente IA
              </h3>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${agent ? "bg-success/10" : "bg-muted"} flex items-center justify-center`}>
                    <div className={`w-3 h-3 rounded-full ${agent ? "bg-success animate-pulse" : "bg-muted-foreground"}`} />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{agent ? "Ativo" : "Inativo"}</p>
                    <p className="text-sm text-muted-foreground">
                      {agent?.nome || "Nenhum agente"}
                    </p>
                  </div>
                </div>
                <StatusBadge status={agent ? "online" : "offline"} />
              </div>
            </div>

            {/* Today's Summary */}
            <div className="bg-card rounded-2xl border border-border shadow-sm p-5">
              <h3 className="text-sm font-medium text-muted-foreground mb-4">
                Resumo do Dia
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Confirmados</span>
                  <span className="font-semibold text-foreground">
                    {todayAppointments.filter(a => a.status === 'confirmed').length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Pendentes</span>
                  <span className="font-semibold text-foreground">
                    {todayAppointments.filter(a => a.status === 'pending').length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Concluídos</span>
                  <span className="font-semibold text-foreground">
                    {todayAppointments.filter(a => a.status === 'completed').length}
                  </span>
                </div>
                <div className="border-t border-border pt-3 mt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">Total</span>
                    <span className="font-bold text-primary">{todayCount}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <SmartBookingModal
        open={bookingModalOpen}
        onOpenChange={setBookingModalOpen}
        onSuccess={handleBookingSuccess}
      />
    </div>
  );
}
