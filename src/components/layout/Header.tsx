import { Moon, Sun, Link, Check, Bell, Clock, AlertCircle } from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

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
}

function getInitials(name: string | null | undefined): string {
  if (!name || name.trim() === "") return "?";
  
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function Header({ title, subtitle, onMenuClick, showCopyLink, barbershopSlug }: HeaderProps) {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const { barbershop } = useBarbershop();
  const [userName, setUserName] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [overdueAppointments, setOverdueAppointments] = useState<OverdueAppointment[]>([]);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  useEffect(() => {
    async function loadUserName() {
      if (!user) return;
      
      const { data } = await supabase
        .from("user_settings")
        .select("nome")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (data?.nome) {
        setUserName(data.nome);
      } else if (user.user_metadata?.nome) {
        setUserName(user.user_metadata.nome);
      }
    }
    
    loadUserName();
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
          service_id
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

        setOverdueAppointments(data.map(a => ({
          ...a,
          service_name: a.service_id ? serviceMap[a.service_id] || null : null
        })));
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
    // Navigate to schedule with the date of the appointment
    const appointmentDate = new Date(appointment.start_time);
    navigate(`/schedule?date=${appointmentDate.toISOString().split('T')[0]}&highlight=${appointment.id_agendamento}`);
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
              <div className="p-3 border-b border-border">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                  Agendamentos Pendentes
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Agendamentos que passaram e ainda estão pendentes
                </p>
              </div>
              
              {hasNotifications ? (
                <div className="max-h-80 overflow-y-auto">
                  <div className="divide-y divide-border">
                    {overdueAppointments.map((appointment) => (
                      <button
                        key={appointment.id_agendamento}
                        onClick={() => handleNotificationClick(appointment)}
                        className="w-full p-3 text-left hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                            <Clock className="w-4 h-4 text-destructive" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {appointment.nome_cliente || "Cliente não informado"}
                            </p>
                            {appointment.service_name && (
                              <p className="text-xs text-muted-foreground truncate">
                                {appointment.service_name}
                              </p>
                            )}
                            <p className="text-xs text-destructive mt-1">
                              Atrasado há {formatDistanceToNow(new Date(appointment.start_time), { locale: ptBR })}
                            </p>
                            <p className="text-xs text-primary mt-0.5">
                              Já concluiu ou remarcou?
                            </p>
                          </div>
                        </div>
                      </button>
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
            className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            {initials}
          </button>
        </div>
      </div>
    </header>
  );
}
