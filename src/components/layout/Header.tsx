import { Moon, Sun, Link, Check, Bell, Clock, AlertCircle, X, Calendar, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { HamburgerMenuButton } from "./HamburgerMenuButton";
import { useBarbershop } from "@/hooks/useBarbershop";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FinishAppointmentModal } from "@/components/schedule/FinishAppointmentModal";

interface HeaderProps {
  title: string;
  subtitle?: string;
  onMenuClick?: () => void;
  showCopyLink?: boolean;
  barbershopSlug?: string | null;
}

interface OverdueAppointment {
  id_agendamento: string;
  nome_cliente: string | null;
  start_time: string;
  service_name: string | null;
  service_id: string | null;
  client_id: string | null;
  user_id: string;
}

const DISMISSED_STORAGE_KEY = "dismissed_overdue_notifications";

function getInitials(name: string | null | undefined): string {
  if (!name || name.trim() === "") return "?";
  
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function loadDismissedIds(): string[] {
  try {
    const saved = localStorage.getItem(DISMISSED_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveDismissedIds(ids: string[]) {
  localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(ids));
}

export function Header({ title, subtitle, onMenuClick, showCopyLink, barbershopSlug }: HeaderProps) {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const { barbershop } = useBarbershop();
  const [userName, setUserName] = useState<string | null>(null);
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [copied, setCopied] = useState(false);
  const [overdueAppointments, setOverdueAppointments] = useState<OverdueAppointment[]>([]);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<string[]>(loadDismissedIds);
  
  // Finish modal state
  const [isFinishModalOpen, setIsFinishModalOpen] = useState(false);
  const [finishingAppointment, setFinishingAppointment] = useState<OverdueAppointment | null>(null);

  useEffect(() => {
    async function loadUserData() {
      if (!user) {
        setIsLoadingProfile(false);
        return;
      }
      
      setIsLoadingProfile(true);
      const { data } = await supabase
        .from("user_settings")
        .select("nome, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (data?.nome) {
        setUserName(data.nome);
      } else if (user.user_metadata?.nome) {
        setUserName(user.user_metadata.nome);
      }
      
      if ((data as any)?.avatar_url) {
        setUserAvatarUrl((data as any).avatar_url);
      }
      setIsLoadingProfile(false);
    }
    
    loadUserData();
  }, [user]);

  // Fetch overdue appointments
  useEffect(() => {
    async function loadOverdueAppointments() {
      if (!barbershop?.id) return;
      
      const now = new Date().toISOString();
      
      const { data, error } = await supabase
        .from("agendamentos")
        .select(`
          id_agendamento,
          nome_cliente,
          start_time,
          service_id,
          client_id,
          user_id
        `)
        .eq("barbershop_id", barbershop.id)
        .eq("status", "pending")
        .lt("start_time", now)
        .is("block_reason", null)
        .order("start_time", { ascending: false })
        .limit(20);
      
      if (error) {
        console.error("Error fetching overdue appointments:", error);
        return;
      }

      if (data && data.length > 0) {
        // Fetch service names
        const serviceIds = [...new Set(data.filter(a => a.service_id).map(a => a.service_id))] as string[];
        
        let serviceMap: Record<string, string> = {};
        if (serviceIds.length > 0) {
          const { data: services } = await supabase
            .from("services")
            .select("id, name")
            .in("id", serviceIds);
          
          if (services) {
            serviceMap = Object.fromEntries(services.map(s => [s.id, s.name]));
          }
        }

        // Filter out dismissed notifications
        const currentDismissed = loadDismissedIds();
        const filtered = data
          .filter(a => !currentDismissed.includes(a.id_agendamento))
          .map(a => ({
            id_agendamento: a.id_agendamento,
            nome_cliente: a.nome_cliente,
            start_time: a.start_time,
            service_id: a.service_id,
            client_id: a.client_id,
            user_id: a.user_id,
            service_name: a.service_id ? serviceMap[a.service_id] || null : null
          }));
        
        setOverdueAppointments(filtered);
      } else {
        setOverdueAppointments([]);
      }
    }
    
    loadOverdueAppointments();
    
    // Refresh every 5 minutes
    const interval = setInterval(loadOverdueAppointments, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [barbershop?.id]);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const copyBookingLink = () => {
    if (!barbershopSlug) return;
    
    const link = `${window.location.origin}/a/${barbershopSlug}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success("Link de agendamento copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNotificationClick = (appointment: OverdueAppointment) => {
    setIsNotificationOpen(false);
    const appointmentDate = new Date(appointment.start_time);
    navigate(`/schedule?date=${appointmentDate.toISOString().split('T')[0]}&highlight=${appointment.id_agendamento}`);
  };

  const handleComplete = (e: React.MouseEvent, appointment: OverdueAppointment) => {
    e.stopPropagation();
    
    // Open finish modal directly
    setFinishingAppointment(appointment);
    setIsFinishModalOpen(true);
  };

  const handleFinishSuccess = () => {
    // Remove the completed appointment from notifications
    if (finishingAppointment) {
      setOverdueAppointments(prev => 
        prev.filter(a => a.id_agendamento !== finishingAppointment.id_agendamento)
      );
    }
    setFinishingAppointment(null);
  };

  const handleDismiss = (e: React.MouseEvent, appointmentId: string) => {
    e.stopPropagation();
    
    const newDismissed = [...dismissedIds, appointmentId];
    setDismissedIds(newDismissed);
    saveDismissedIds(newDismissed);
    setOverdueAppointments(prev => prev.filter(a => a.id_agendamento !== appointmentId));
  };

  const handleDismissAll = () => {
    const allIds = overdueAppointments.map(a => a.id_agendamento);
    const newDismissed = [...new Set([...dismissedIds, ...allIds])];
    setDismissedIds(newDismissed);
    saveDismissedIds(newDismissed);
    setOverdueAppointments([]);
  };

  const handleReschedule = (e: React.MouseEvent, appointment: OverdueAppointment) => {
    e.stopPropagation();
    setIsNotificationOpen(false);
    const appointmentDate = new Date(appointment.start_time);
    navigate(`/schedule?date=${appointmentDate.toISOString().split('T')[0]}&edit=${appointment.id_agendamento}`);
  };

  const initials = getInitials(userName);
  const hasNotifications = overdueAppointments.length > 0;

  return (
    <header className="bg-background/95 backdrop-blur-lg border-b border-border">
      <div className="flex items-center justify-between h-16 px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <HamburgerMenuButton isOpen={false} onClick={onMenuClick || (() => {})} />
          <div>
            <h1 className="text-lg font-semibold text-foreground">{title}</h1>
            {subtitle && (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Copy Booking Link Button */}
          {showCopyLink && barbershopSlug && (
            <Button
              variant="outline"
              size="sm"
              onClick={copyBookingLink}
              className="hidden sm:flex items-center gap-2"
            >
              {copied ? (
                <Check className="w-4 h-4 text-primary" />
              ) : (
                <Link className="w-4 h-4" />
              )}
              <span className="hidden md:inline">Copiar Link</span>
            </Button>
          )}
          
          {/* Notifications Bell */}
          <Popover open={isNotificationOpen} onOpenChange={setIsNotificationOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full relative"
              >
                <Bell className="w-5 h-5" />
                {hasNotifications && (
                  <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-destructive text-destructive-foreground text-xs font-bold rounded-full flex items-center justify-center">
                    {overdueAppointments.length > 9 ? "9+" : overdueAppointments.length}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <div className="p-3 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-destructive" />
                    Agendamentos Pendentes
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Passaram e ainda estão pendentes
                  </p>
                </div>
                {hasNotifications && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDismissAll}
                    className="text-xs h-7 px-2"
                  >
                    Limpar
                  </Button>
                )}
              </div>
              
              {hasNotifications ? (
                <div className="max-h-80 overflow-y-auto">
                  <div className="divide-y divide-border">
                    {overdueAppointments.map((appointment) => (
                      <div
                        key={appointment.id_agendamento}
                        className="p-3 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                            <Clock className="w-4 h-4 text-destructive" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-medium text-sm truncate">
                                {appointment.nome_cliente || "Cliente não informado"}
                              </p>
                              <button
                                onClick={(e) => handleDismiss(e, appointment.id_agendamento)}
                                className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                                title="Dispensar notificação"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                            {appointment.service_name && (
                              <p className="text-xs text-muted-foreground truncate">
                                {appointment.service_name}
                              </p>
                            )}
                            <p className="text-xs text-destructive mt-1">
                              Atrasado há {formatDistanceToNow(new Date(appointment.start_time), { locale: ptBR })}
                            </p>
                            
                            <div className="flex items-center gap-2 mt-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs flex-1"
                                onClick={(e) => handleComplete(e, appointment)}
                              >
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Concluir
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs flex-1"
                                onClick={(e) => handleReschedule(e, appointment)}
                              >
                                <Calendar className="w-3 h-3 mr-1" />
                                Remarcar
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center">
                  <Bell className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Nenhum agendamento pendente
                  </p>
                </div>
              )}
            </PopoverContent>
          </Popover>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="rounded-full"
          >
            {theme === "dark" ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
          </Button>
          <button
            onClick={() => navigate("/settings")}
            className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center hover:opacity-90 transition-opacity"
          >
            {isLoadingProfile ? (
              <span className="w-full h-full gradient-primary flex items-center justify-center">
                <Loader2 className="w-4 h-4 text-primary-foreground animate-spin" />
              </span>
            ) : userAvatarUrl ? (
              <img 
                src={userAvatarUrl} 
                alt="Perfil" 
                className="w-full h-full object-cover animate-fade-in"
              />
            ) : (
              <span className="w-full h-full gradient-primary flex items-center justify-center text-primary-foreground font-semibold text-sm animate-fade-in">
                {initials}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Finish Appointment Modal */}
      <FinishAppointmentModal
        open={isFinishModalOpen}
        onOpenChange={setIsFinishModalOpen}
        appointment={finishingAppointment ? {
          id_agendamento: finishingAppointment.id_agendamento,
          nome_cliente: finishingAppointment.nome_cliente,
          service_id: finishingAppointment.service_id,
          service_name: finishingAppointment.service_name,
          client_id: finishingAppointment.client_id,
          user_id: finishingAppointment.user_id,
        } : null}
        barbershopId={barbershop?.id || ""}
        onSuccess={handleFinishSuccess}
      />
    </header>
  );
}
