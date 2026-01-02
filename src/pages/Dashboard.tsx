import { useEffect, useState, useRef } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SubscriptionCard } from "@/components/subscription/SubscriptionCard";

import { SmartBookingModal } from "@/components/schedule/SmartBookingModal";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFacebookPixel, generateEventId } from "@/hooks/useFacebookPixel";

import {
  Calendar,
  Wallet,
  Clock,
  User,
  Plus,
  UserPlus,
  Receipt,
  ChevronRight,
  CalendarDays,
  Rocket,
  ArrowRight,
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
  const { onMenuClick, barbershop } = useOutletContext<OutletContextType>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const { trackCompleteRegistration } = useFacebookPixel();
  const hasHandledOAuthRef = useRef(false);

  const today = new Date();
  const todayStart = startOfDay(today).toISOString();
  const todayEnd = endOfDay(today).toISOString();
  const weekStart = subDays(startOfDay(today), 6).toISOString();

  // Check if asaas_api_key exists for financial activation card
  const { data: hasAsaasApiKey = true } = useQuery({
    queryKey: ["barbershop-asaas-key", barbershop?.id],
    queryFn: async () => {
      if (!barbershop?.id) return true;
      const { data, error } = await supabase
        .from("barbershops")
        .select("asaas_api_key")
        .eq("id", barbershop.id)
        .single();
      if (error) return true;
      return !!(data?.asaas_api_key);
    },
    enabled: !!barbershop?.id,
    refetchInterval: 10000, // Auto-refresh every 10 seconds to detect webhook updates
  });

  // Handle pending OAuth plan update AND Facebook Pixel event
  useEffect(() => {
    const handleOAuthRegistration = async () => {
      if (!user?.id) return;
      
      // Guard to prevent duplicate handling
      if (hasHandledOAuthRef.current) return;
      
      const pendingPlan = localStorage.getItem("pending_plan_slug");
      const pendingEventId = localStorage.getItem("pending_fb_event_id");
      const alreadyTracked = localStorage.getItem(`fb_tracked_${user.id}`);
      
      // CASE 1: Has pending localStorage data (normal OAuth flow)
      if (pendingPlan && pendingEventId) {
        hasHandledOAuthRef.current = true;
        
        // Update subscription with selected plan
        const { error } = await supabase
          .from("subscriptions")
          .update({ plan_slug: pendingPlan })
          .eq("user_id", user.id);
        
        if (error) {
          console.error("Error updating subscription:", error);
          hasHandledOAuthRef.current = false;
          return;
        }
        
        // Clear localStorage BEFORE firing events
        localStorage.removeItem("pending_plan_slug");
        localStorage.removeItem("pending_fb_event_id");
        
        // DISPARO HÍBRIDO: Browser + CAPI
        await trackCompleteRegistration({
          eventId: pendingEventId,
          userRole: "owner",
          email: user.email,
          userId: user.id,
        });
        
        localStorage.setItem(`fb_tracked_${user.id}`, "true");
        queryClient.invalidateQueries({ queryKey: ["subscription"] });
        console.log("[Dashboard] OAuth registration handled, FB events fired");
        return;
      }
      
      // CASE 2: FALLBACK - User is new (created < 2 min ago) but localStorage was lost
      if (!alreadyTracked && user.created_at) {
        const userCreatedAt = new Date(user.created_at);
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
        
        if (userCreatedAt > twoMinutesAgo) {
          hasHandledOAuthRef.current = true;
          const newEventId = generateEventId(user.id);
          
          await trackCompleteRegistration({
            eventId: newEventId,
            userRole: "owner",
            email: user.email,
            userId: user.id,
          });
          
          localStorage.setItem(`fb_tracked_${user.id}`, "true");
          console.log("[Dashboard] New user detected (fallback), FB events fired");
        }
      }
    };
    
    handleOAuthRegistration();
  }, [user?.id, user?.email, user?.created_at, queryClient, trackCompleteRegistration]);

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

  // Get upcoming appointments (from now onwards)
  const now = new Date().toISOString();
  const upcomingAppointments = todayAppointments.filter(
    (apt) => apt.start_time >= now && (apt.status === "pending" || apt.status === "confirmed")
  ).slice(0, 5);

  // Next client (first upcoming appointment)
  const nextClient = upcomingAppointments[0] || null;

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
        

        {/* Financial Activation Card - Hidden for now, keeping code for future reactivation */}
        {false && !hasAsaasApiKey && (
          <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/10 p-6 shadow-lg">
            {/* Decorative elements */}
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute -bottom-4 -left-4 h-24 w-24 rounded-full bg-primary/5 blur-2xl" />
            
            <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/25">
                <Rocket className="w-7 h-7 text-primary-foreground" />
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-foreground mb-1">
                  Potencialize seu faturamento com o Clube de Assinaturas 🚀
                </h3>
                <p className="text-sm text-muted-foreground">
                  Chega de cobrar clientes manualmente! Ative recebimentos automáticos via Cartão e Pix e profissionalize sua barbearia.
                </p>
              </div>
              
              <Button 
                onClick={() => {
                  navigate("/settings");
                  // Use setTimeout to ensure navigation completes before setting tab
                  setTimeout(() => {
                    const event = new CustomEvent('navigate-settings-tab', { detail: 'banking' });
                    window.dispatchEvent(event);
                  }, 100);
                }}
                className="flex-shrink-0 gap-2 shadow-lg shadow-primary/25"
                size="lg"
              >
                Ativar Pagamentos Automáticos
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

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

          {/* Next Client */}
          <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <User className="w-6 h-6 text-amber-500" />
              </div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Próximo</span>
            </div>
            {nextClient ? (
              <>
                <p className="text-2xl font-bold text-foreground truncate">{nextClient.nome_cliente || "Cliente"}</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatTimeFromISO(nextClient.start_time)} - {getServiceName(nextClient.service_id)}
                </p>
              </>
            ) : (
              <>
                <p className="text-xl font-medium text-muted-foreground">Nenhum</p>
                <p className="text-sm text-muted-foreground">Agenda livre!</p>
              </>
            )}
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
