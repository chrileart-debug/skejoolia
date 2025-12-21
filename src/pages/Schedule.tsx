import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { FAB } from "@/components/shared/FAB";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SmartBookingModal } from "@/components/schedule/SmartBookingModal";
import { ReminderConfigModal } from "@/components/schedule/ReminderConfigModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Calendar,
  Clock,
  User,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  Plus,
  Bell,
  CheckCircle2,
  Crown,
  Loader2,
} from "lucide-react";
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
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBarbershop } from "@/hooks/useBarbershop";
import { cn } from "@/lib/utils";

interface Appointment {
  id_agendamento: string;
  nome_cliente: string | null;
  telefone_cliente: string | null;
  start_time: string;
  end_time: string | null;
  status: string | null;
  service_id: string | null;
  client_id: string | null;
  user_id: string;
}

interface Service {
  id: string;
  name: string;
  duration_minutes: number | null;
  price: number | null;
}

interface StaffMember {
  user_id: string;
  name: string | null;
}

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

const getDateFromISO = (isoString: string): string => {
  const date = new Date(isoString);
  const year = date.toLocaleString("en-CA", { year: "numeric", timeZone: BRASILIA_TIMEZONE });
  const month = date.toLocaleString("en-CA", { month: "2-digit", timeZone: BRASILIA_TIMEZONE });
  const day = date.toLocaleString("en-CA", { day: "2-digit", timeZone: BRASILIA_TIMEZONE });
  return `${year}-${month}-${day}`;
};

const createISODateTime = (dateStr: string, timeStr: string): string => {
  return `${dateStr}T${timeStr}:00-03:00`;
};

const getTodayInBrasilia = (): string => {
  const now = new Date();
  const year = now.toLocaleString("en-CA", { year: "numeric", timeZone: BRASILIA_TIMEZONE });
  const month = now.toLocaleString("en-CA", { month: "2-digit", timeZone: BRASILIA_TIMEZONE });
  const day = now.toLocaleString("en-CA", { day: "2-digit", timeZone: BRASILIA_TIMEZONE });
  return `${year}-${month}-${day}`;
};

const formatDateToBrasilia = (date: Date): string => {
  const year = date.toLocaleString("en-CA", { year: "numeric", timeZone: BRASILIA_TIMEZONE });
  const month = date.toLocaleString("en-CA", { month: "2-digit", timeZone: BRASILIA_TIMEZONE });
  const day = date.toLocaleString("en-CA", { day: "2-digit", timeZone: BRASILIA_TIMEZONE });
  return `${year}-${month}-${day}`;
};

export default function Schedule() {
  const { onMenuClick } = useOutletContext<OutletContextType>();
  const { user } = useAuth();
  const { barbershop } = useBarbershop();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isDayDialogOpen, setIsDayDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedDayAppointments, setSelectedDayAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteAppointmentId, setDeleteAppointmentId] = useState<string | null>(null);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    service: "",
    date: "",
    time: "",
    status: "",
  });

  // Finish appointment modal states
  const [isFinishModalOpen, setIsFinishModalOpen] = useState(false);
  const [finishingAppointment, setFinishingAppointment] = useState<Appointment | null>(null);
  const [isClientVip, setIsClientVip] = useState(false);
  const [vipSubscriptionId, setVipSubscriptionId] = useState<string | null>(null);
  const [finishFormData, setFinishFormData] = useState({
    amount: 0,
    paymentMethod: "Dinheiro",
  });
  const [isProcessingFinish, setIsProcessingFinish] = useState(false);

  const getMonthRange = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const monthStr = String(month + 1).padStart(2, "0");
    const lastDay = new Date(year, month + 1, 0).getDate();
    
    return {
      start: `${year}-${monthStr}-01T00:00:00-03:00`,
      end: `${year}-${monthStr}-${String(lastDay).padStart(2, "0")}T23:59:59-03:00`,
    };
  };

  const fetchAppointments = async () => {
    if (!barbershop?.id) return;

    const { start, end } = getMonthRange(selectedDate);
    
    const { data, error } = await supabase
      .from("agendamentos")
      .select("*")
      .eq("barbershop_id", barbershop.id)
      .gte("start_time", start)
      .lte("start_time", end)
      .order("start_time", { ascending: true });

    if (error) {
      console.error("Error fetching appointments:", error);
      toast.error("Erro ao carregar agendamentos");
    } else {
      setAppointments(data || []);
    }
    setLoading(false);
  };

  const fetchServices = async () => {
    if (!barbershop?.id) return;

    const { data, error } = await supabase
      .from("services")
      .select("id, name, duration_minutes, price")
      .eq("barbershop_id", barbershop.id)
      .eq("is_active", true);

    if (error) {
      console.error("Error fetching services:", error);
    } else {
      setServices(data || []);
    }
  };

  const fetchStaffMembers = async () => {
    if (!barbershop?.id) return;

    const { data, error } = await supabase.rpc("get_barbershop_team", {
      p_barbershop_id: barbershop.id
    });

    if (!error && data) {
      const members = data
        .filter((m: any) => m.status === "active")
        .map((m: any) => ({
          user_id: m.user_id,
          name: m.name
        }));
      setStaffMembers(members);
    }
  };

  useEffect(() => {
    if (barbershop?.id) {
      fetchAppointments();
      fetchServices();
      fetchStaffMembers();
    }
  }, [barbershop?.id, selectedDate.getMonth(), selectedDate.getFullYear()]);

  const handleCreate = () => {
    setIsBookingModalOpen(true);
  };

  const handleBookingSuccess = () => {
    fetchAppointments();
  };

  const handleStatusChange = async (id: string, status: string) => {
    const { error } = await supabase
      .from("agendamentos")
      .update({ status })
      .eq("id_agendamento", id);

    if (error) {
      console.error("Error updating status:", error);
      toast.error("Erro ao atualizar status");
    } else {
      setAppointments(
        appointments.map((a) => (a.id_agendamento === id ? { ...a, status } : a))
      );
      setSelectedDayAppointments(
        selectedDayAppointments.map((a) => (a.id_agendamento === id ? { ...a, status } : a))
      );
      toast.success("Status atualizado");
    }
  };

  const handleEditAppointment = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    const dateStr = getDateFromISO(appointment.start_time);
    const timeStr = formatTimeFromISO(appointment.start_time);
    setEditFormData({
      service: appointment.service_id || "",
      date: dateStr,
      time: timeStr,
      status: appointment.status || "pending",
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateAppointment = async () => {
    if (!editingAppointment || !editFormData.date || !editFormData.time) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    const service = services.find(s => s.id === editFormData.service);
    const durationMinutes = service?.duration_minutes || 60;

    const startTime = createISODateTime(editFormData.date, editFormData.time);
    const [hours, minutes] = editFormData.time.split(":").map(Number);
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMins = totalMinutes % 60;
    const endTime = `${editFormData.date}T${String(endHours).padStart(2, "0")}:${String(endMins).padStart(2, "0")}:00-03:00`;

    const { error } = await supabase
      .from("agendamentos")
      .update({
        service_id: editFormData.service || null,
        start_time: startTime,
        end_time: endTime,
        status: editFormData.status,
      })
      .eq("id_agendamento", editingAppointment.id_agendamento);

    if (error) {
      console.error("Error updating appointment:", error);
      toast.error("Erro ao atualizar agendamento");
    } else {
      toast.success("Agendamento atualizado");
      setIsEditDialogOpen(false);
      setEditingAppointment(null);
      fetchAppointments();
      if (isDayDialogOpen) {
        const updatedAppt = {
          ...editingAppointment,
          service_id: editFormData.service || null,
          start_time: startTime,
          end_time: endTime,
          status: editFormData.status,
        };
        setSelectedDayAppointments((prev) =>
          prev.map((a) => (a.id_agendamento === editingAppointment.id_agendamento ? updatedAppt : a))
        );
      }
    }
  };

  const handleDeleteAppointment = async () => {
    if (!deleteAppointmentId) return;

    const { error } = await supabase
      .from("agendamentos")
      .delete()
      .eq("id_agendamento", deleteAppointmentId);

    if (error) {
      console.error("Error deleting appointment:", error);
      toast.error("Erro ao excluir agendamento");
    } else {
      toast.success("Agendamento excluído");
      setDeleteAppointmentId(null);
      fetchAppointments();
      setSelectedDayAppointments((prev) =>
        prev.filter((a) => a.id_agendamento !== deleteAppointmentId)
      );
    }
  };

  // Finish appointment functions
  const handleFinishAppointment = async (appointment: Appointment) => {
    if (!barbershop?.id) {
      toast.error("Dados da barbearia não encontrados");
      return;
    }

    setFinishingAppointment(appointment);
    setIsProcessingFinish(true);
    setIsFinishModalOpen(true);

    // Check if client is VIP (has active subscription)
    if (appointment.client_id) {
      const { data: subscription } = await supabase
        .from("client_club_subscriptions")
        .select("id, status, plan_id")
        .eq("client_id", appointment.client_id)
        .eq("barbershop_id", barbershop.id)
        .eq("status", "active")
        .maybeSingle();

      const isVip = !!subscription;
      setIsClientVip(isVip);
      setVipSubscriptionId(subscription?.id || null);

      if (isVip) {
        setFinishFormData({
          amount: 0,
          paymentMethod: "Saldo VIP/Clube",
        });
      } else {
        const service = services.find(s => s.id === appointment.service_id);
        setFinishFormData({
          amount: service?.price || 0,
          paymentMethod: "Dinheiro",
        });
      }
    } else {
      setIsClientVip(false);
      setVipSubscriptionId(null);
      const service = services.find(s => s.id === appointment.service_id);
      setFinishFormData({
        amount: service?.price || 0,
        paymentMethod: "Dinheiro",
      });
    }

    setIsProcessingFinish(false);
  };

  const handleSubmitFinish = async () => {
    if (!finishingAppointment || !barbershop?.id) return;

    setIsProcessingFinish(true);

    try {
      // STEP 1: Insert transaction into client_transactions
      const { data: transaction, error: transactionError } = await supabase
        .from("client_transactions")
        .insert({
          barbershop_id: barbershop.id,
          client_id: finishingAppointment.client_id,
          appointment_id: finishingAppointment.id_agendamento,
          amount: finishFormData.amount,
          payment_method: finishFormData.paymentMethod,
          status: "pago",
        })
        .select("id")
        .single();

      if (transactionError) throw transactionError;

      // STEP 2: Update appointment with status = 'completed' and transaction_id
      const { error: updateError } = await supabase
        .from("agendamentos")
        .update({
          status: "completed",
          transaction_id: transaction.id,
        })
        .eq("id_agendamento", finishingAppointment.id_agendamento);

      if (updateError) throw updateError;

      // If VIP and has service, record usage
      if (isClientVip && vipSubscriptionId && finishingAppointment.service_id) {
        await supabase
          .from("client_subscription_usage")
          .insert({
            subscription_id: vipSubscriptionId,
            service_id: finishingAppointment.service_id,
            appointment_id: finishingAppointment.id_agendamento,
          });
      }

      toast.success("Atendimento concluído com sucesso!");

      // Update local state
      setAppointments(prev =>
        prev.map(a => a.id_agendamento === finishingAppointment.id_agendamento
          ? { ...a, status: "completed" }
          : a)
      );
      setSelectedDayAppointments(prev =>
        prev.map(a => a.id_agendamento === finishingAppointment.id_agendamento
          ? { ...a, status: "completed" }
          : a)
      );

      // Close modal and reset state
      setIsFinishModalOpen(false);
      setFinishingAppointment(null);
      setIsClientVip(false);
      setVipSubscriptionId(null);

    } catch (error) {
      console.error("Erro ao finalizar atendimento:", error);
      toast.error("Erro ao finalizar atendimento");
    } finally {
      setIsProcessingFinish(false);
    }
  };

  const navigateMonth = (direction: "prev" | "next") => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() + (direction === "next" ? 1 : -1));
    setSelectedDate(newDate);
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const getServiceName = (service_id: string | null) => {
    if (!service_id) return "Serviço não definido";
    const service = services.find((s) => s.id === service_id);
    return service?.name || "Serviço não encontrado";
  };

  const getStaffName = (user_id: string) => {
    const staff = staffMembers.find((s) => s.user_id === user_id);
    return staff?.name || "Profissional";
  };

  const generateCalendarDays = () => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const startingDayOfWeek = firstDayOfMonth.getDay();
    const daysInMonth = lastDayOfMonth.getDate();
    
    const days: { date: Date; isCurrentMonth: boolean }[] = [];
    
    const prevMonth = new Date(year, month, 0);
    const prevMonthDays = prevMonth.getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthDays - i),
        isCurrentMonth: false,
      });
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }
    
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }
    
    return days;
  };

  const getAppointmentsForDay = (date: Date) => {
    const dateStr = formatDateToBrasilia(date);
    return appointments.filter((apt) => {
      const aptDateStr = getDateFromISO(apt.start_time);
      return aptDateStr === dateStr;
    });
  };

  const handleDayClick = (date: Date) => {
    const dayAppointments = getAppointmentsForDay(date);
    setSelectedDayAppointments(dayAppointments);
    setIsDayDialogOpen(true);
  };

  const isToday = (date: Date) => {
    const today = getTodayInBrasilia();
    const dateStr = formatDateToBrasilia(date);
    return today === dateStr;
  };

  const calendarDays = generateCalendarDays();
  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  return (
    <div className="min-h-screen overflow-x-hidden">
      <Header title="Agenda" subtitle="Gerencie seus agendamentos" onMenuClick={onMenuClick} />

      <div className="p-4 lg:p-6">
        {/* Calendar Header */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navigateMonth("prev")}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h2 className="text-lg font-semibold min-w-[160px] text-center">
              {monthNames[selectedDate.getMonth()]} {selectedDate.getFullYear()}
            </h2>
            <Button variant="outline" size="icon" onClick={() => navigateMonth("next")}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={goToToday}>
              Hoje
            </Button>
            <Button variant="outline" onClick={() => setIsReminderModalOpen(true)}>
              <Bell className="w-4 h-4 mr-2" />
              Lembretes
            </Button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {/* Week days header */}
          <div className="grid grid-cols-7 border-b border-border">
            {weekDays.map((day) => (
              <div
                key={day}
                className="p-2 text-center text-xs sm:text-sm font-medium text-muted-foreground"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, index) => {
              const dayAppointments = getAppointmentsForDay(day.date);
              const hasAppointments = dayAppointments.length > 0;

              return (
                <button
                  key={index}
                  onClick={() => handleDayClick(day.date)}
                  className={cn(
                    "min-h-[60px] sm:min-h-[80px] p-1 sm:p-2 border-b border-r border-border text-left transition-colors hover:bg-muted/50",
                    !day.isCurrentMonth && "bg-muted/30 text-muted-foreground",
                    isToday(day.date) && "bg-primary/10"
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 text-xs sm:text-sm rounded-full",
                      isToday(day.date) && "bg-primary text-primary-foreground font-semibold"
                    )}
                  >
                    {day.date.getDate()}
                  </span>
                  {hasAppointments && (
                    <div className="mt-1 space-y-0.5">
                      {dayAppointments.slice(0, 2).map((apt) => (
                        <div
                          key={apt.id_agendamento}
                          className={cn(
                            "text-[10px] sm:text-xs px-1 py-0.5 rounded truncate",
                            apt.status === "completed" && "bg-green-500/20 text-green-700 dark:text-green-400",
                            apt.status === "pending" && "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
                            apt.status === "confirmed" && "bg-blue-500/20 text-blue-700 dark:text-blue-400",
                            apt.status === "cancelled" && "bg-red-500/20 text-red-700 dark:text-red-400"
                          )}
                        >
                          <span className="hidden sm:inline">{formatTimeFromISO(apt.start_time)} - </span>
                          {apt.nome_cliente || "Cliente"}
                        </div>
                      ))}
                      {dayAppointments.length > 2 && (
                        <div className="text-[10px] text-muted-foreground px-1">
                          +{dayAppointments.length - 2}
                        </div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <FAB onClick={handleCreate} icon={<Plus className="w-6 h-6" />} />

      {/* Smart Booking Modal */}
      <SmartBookingModal
        open={isBookingModalOpen}
        onOpenChange={setIsBookingModalOpen}
        onSuccess={handleBookingSuccess}
      />

      {/* Day Detail Dialog */}
      <Dialog open={isDayDialogOpen} onOpenChange={setIsDayDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agendamentos do Dia</DialogTitle>
          </DialogHeader>
          
          {selectedDayAppointments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum agendamento para este dia
            </p>
          ) : (
            <div className="space-y-3">
              {selectedDayAppointments.map((apt) => (
                <div
                  key={apt.id_agendamento}
                  className="p-3 bg-muted/50 rounded-lg space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{apt.nome_cliente || "Cliente não informado"}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatTimeFromISO(apt.start_time)} - {getServiceName(apt.service_id)}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <User className="w-3 h-3" />
                        {getStaffName(apt.user_id)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {(apt.status === "pending" || apt.status === "confirmed") && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30"
                          onClick={() => handleFinishAppointment(apt)}
                          title="Concluir atendimento"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEditAppointment(apt)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => setDeleteAppointmentId(apt.id_agendamento)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={(apt.status || "pending") as "pending" | "confirmed" | "completed" | "cancelled"} />
                    <Select
                      value={apt.status || "pending"}
                      onValueChange={(value) => handleStatusChange(apt.id_agendamento, value)}
                    >
                      <SelectTrigger className="h-7 text-xs w-auto min-w-[100px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="confirmed">Confirmado</SelectItem>
                        <SelectItem value="completed">Concluído</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Appointment Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Agendamento</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-service">Serviço</Label>
              <Select
                value={editFormData.service}
                onValueChange={(value) => setEditFormData({ ...editFormData, service: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um serviço" />
                </SelectTrigger>
                <SelectContent>
                  {services.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-date">Data *</Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={editFormData.date}
                  onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-time">Horário *</Label>
                <Input
                  id="edit-time"
                  type="time"
                  value={editFormData.time}
                  onChange={(e) => setEditFormData({ ...editFormData, time: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select
                value={editFormData.status}
                onValueChange={(value) => setEditFormData({ ...editFormData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="confirmed">Confirmado</SelectItem>
                  <SelectItem value="completed">Concluído</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleUpdateAppointment} className="w-full">
              Salvar Alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteAppointmentId} onOpenChange={() => setDeleteAppointmentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Agendamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este agendamento? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAppointment}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reminder Configuration Modal */}
      {barbershop?.id && (
        <ReminderConfigModal
          open={isReminderModalOpen}
          onOpenChange={setIsReminderModalOpen}
          barbershopId={barbershop.id}
        />
      )}

      {/* Finish Appointment Modal */}
      <Dialog open={isFinishModalOpen} onOpenChange={setIsFinishModalOpen}>
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              Concluir Atendimento
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Client Info */}
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="font-medium">{finishingAppointment?.nome_cliente || "Cliente não informado"}</p>
              <p className="text-sm text-muted-foreground">
                {getServiceName(finishingAppointment?.service_id || null)}
              </p>
            </div>

            {/* VIP Badge */}
            {isClientVip && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <Crown className="w-5 h-5 text-amber-500" />
                  <span className="font-semibold text-amber-600 dark:text-amber-400">
                    Membro VIP Detectado
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Serviço incluso no plano. Pagamento zerado automaticamente.
                </p>
              </div>
            )}

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="finish-amount">Valor (R$)</Label>
              <Input
                id="finish-amount"
                type="number"
                step="0.01"
                min="0"
                value={finishFormData.amount}
                onChange={(e) => setFinishFormData({
                  ...finishFormData,
                  amount: parseFloat(e.target.value) || 0
                })}
                disabled={isClientVip}
                className={isClientVip ? "bg-muted" : ""}
              />
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <Label htmlFor="finish-method">Método de Pagamento</Label>
              <Select
                value={finishFormData.paymentMethod}
                onValueChange={(value) => setFinishFormData({
                  ...finishFormData,
                  paymentMethod: value
                })}
                disabled={isClientVip}
              >
                <SelectTrigger className={isClientVip ? "bg-muted" : ""}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="Pix Manual">Pix Manual</SelectItem>
                  <SelectItem value="Cartão (Maquininha)">Cartão (Maquininha)</SelectItem>
                  <SelectItem value="Saldo VIP/Clube">Saldo VIP/Clube</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Submit Button */}
            <Button
              onClick={handleSubmitFinish}
              className="w-full"
              disabled={isProcessingFinish}
            >
              {isProcessingFinish ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Confirmar Conclusão
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
