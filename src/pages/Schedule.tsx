import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { FAB } from "@/components/shared/FAB";
import { StatusBadge } from "@/components/shared/StatusBadge";
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
  UserPlus,
  Search,
  ArrowLeft,
  Phone,
  Pencil,
  Trash2,
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
import { formatPhoneMask } from "@/lib/phoneMask";

interface Appointment {
  id_agendamento: string;
  nome_cliente: string | null;
  telefone_cliente: string | null;
  start_time: string;
  end_time: string | null;
  status: string | null;
  service_id: string | null;
  client_id: string | null;
}

interface Service {
  id: string;
  name: string;
}

interface Cliente {
  client_id: string;
  nome: string | null;
  telefone: string | null;
}

interface OutletContextType {
  onMenuClick: () => void;
}

type ModalStep = "selection" | "new-client" | "existing-client" | "form";

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
  const [clients, setClients] = useState<Cliente[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDayDialogOpen, setIsDayDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedDayAppointments, setSelectedDayAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalStep, setModalStep] = useState<ModalStep>("selection");
  const [selectedClient, setSelectedClient] = useState<Cliente | null>(null);
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteAppointmentId, setDeleteAppointmentId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    client: "",
    phone: "",
    service: "",
    date: "",
    time: "",
  });
  const [editFormData, setEditFormData] = useState({
    service: "",
    date: "",
    time: "",
    status: "",
  });

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
    if (!user) return;

    const { start, end } = getMonthRange(selectedDate);
    
    const { data, error } = await supabase
      .from("agendamentos")
      .select("*")
      .eq("user_id", user.id)
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
    if (!barbershop) return;

    const { data, error } = await supabase
      .from("services")
      .select("id, name")
      .eq("barbershop_id", barbershop.id);

    if (error) {
      console.error("Error fetching services:", error);
    } else {
      setServices(data || []);
    }
  };

  const fetchClients = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("clientes")
      .select("client_id, nome, telefone")
      .eq("user_id", user.id)
      .order("nome", { ascending: true });

    if (error) {
      console.error("Error fetching clients:", error);
    } else {
      setClients(data || []);
    }
  };

  useEffect(() => {
    if (user) {
      fetchAppointments();
      fetchClients();
    }
  }, [user, selectedDate.getMonth(), selectedDate.getFullYear()]);

  useEffect(() => {
    if (barbershop) {
      fetchServices();
    }
  }, [barbershop]);

  const handleCreate = () => {
    setFormData({ client: "", phone: "", service: "", date: getTodayInBrasilia(), time: "" });
    setModalStep("selection");
    setSelectedClient(null);
    setClientSearchTerm("");
    setIsDialogOpen(true);
  };

  const handleSelectNewClient = () => {
    setSelectedClient(null);
    setFormData({ ...formData, client: "", phone: "" });
    setModalStep("form");
  };

  const handleSelectExistingClient = () => {
    setClientSearchTerm("");
    setModalStep("existing-client");
  };

  const handleClientSelect = (client: Cliente) => {
    setSelectedClient(client);
    setFormData({
      ...formData,
      client: client.nome || "",
      phone: client.telefone || "",
    });
    setModalStep("form");
  };

  const handleBack = () => {
    if (modalStep === "form" && selectedClient) {
      setModalStep("existing-client");
    } else if (modalStep === "form" || modalStep === "existing-client") {
      setModalStep("selection");
    }
  };

  const handleSubmit = async () => {
    if (!formData.client.trim() || !formData.date || !formData.time) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    if (!user) {
      toast.error("Você precisa estar logado");
      return;
    }

    let clientId: string | null = selectedClient?.client_id || null;

    if (!selectedClient && formData.client) {
      const { data: existingClient } = await supabase
        .from("clientes")
        .select("client_id")
        .eq("user_id", user.id)
        .eq("nome", formData.client)
        .maybeSingle();

      if (existingClient) {
        clientId = existingClient.client_id;
        
        if (formData.phone) {
          await supabase
            .from("clientes")
            .update({ telefone: formData.phone })
            .eq("client_id", clientId);
        }
      } else {
        const { data: newClient, error: clientError } = await supabase
          .from("clientes")
          .insert({
            user_id: user.id,
            nome: formData.client,
            telefone: formData.phone || null,
          })
          .select("client_id")
          .single();

        if (clientError) {
          console.error("Error creating client:", clientError);
          toast.error("Erro ao criar cliente");
          return;
        }
        clientId = newClient.client_id;
      }
    }

    const startTime = createISODateTime(formData.date, formData.time);
    const [hours, minutes] = formData.time.split(":").map(Number);
    const endHours = String((hours + 1) % 24).padStart(2, "0");
    const endTime = `${formData.date}T${endHours}:${String(minutes).padStart(2, "0")}:00-03:00`;

    const { error } = await supabase
      .from("agendamentos")
      .insert({
        user_id: user.id,
        nome_cliente: formData.client || null,
        telefone_cliente: formData.phone || null,
        service_id: formData.service || null,
        start_time: startTime,
        end_time: endTime,
        status: "pending",
        client_id: clientId,
      });

    if (error) {
      console.error("Error creating appointment:", error);
      toast.error("Erro ao criar agendamento");
    } else {
      toast.success("Agendamento criado com sucesso");
      setIsDialogOpen(false);
      fetchAppointments();
      fetchClients();
    }
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

    const startTime = createISODateTime(editFormData.date, editFormData.time);
    const [hours, minutes] = editFormData.time.split(":").map(Number);
    const endHours = String((hours + 1) % 24).padStart(2, "0");
    const endTime = `${editFormData.date}T${endHours}:${String(minutes).padStart(2, "0")}:00-03:00`;

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

  const filteredClients = clients.filter(
    (client) =>
      client.nome?.toLowerCase().includes(clientSearchTerm.toLowerCase()) ||
      client.telefone?.includes(clientSearchTerm)
  );

  const calendarDays = generateCalendarDays();
  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  return (
    <div className="min-h-screen">
      <Header title="Agenda" subtitle="Gerencie seus agendamentos" onMenuClick={onMenuClick} />

      <div className="p-4 lg:p-6">
        {/* Calendar Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navigateMonth("prev")}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h2 className="text-lg font-semibold min-w-[180px] text-center">
              {monthNames[selectedDate.getMonth()]} {selectedDate.getFullYear()}
            </h2>
            <Button variant="outline" size="icon" onClick={() => navigateMonth("next")}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <Button variant="outline" onClick={goToToday}>
            Hoje
          </Button>
        </div>

        {/* Calendar Grid */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {/* Week days header */}
          <div className="grid grid-cols-7 border-b border-border">
            {weekDays.map((day) => (
              <div
                key={day}
                className="p-2 text-center text-sm font-medium text-muted-foreground"
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
                    "min-h-[80px] p-2 border-b border-r border-border text-left transition-colors hover:bg-muted/50",
                    !day.isCurrentMonth && "bg-muted/30 text-muted-foreground",
                    isToday(day.date) && "bg-primary/10"
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex items-center justify-center w-7 h-7 text-sm rounded-full",
                      isToday(day.date) && "bg-primary text-primary-foreground font-semibold"
                    )}
                  >
                    {day.date.getDate()}
                  </span>
                  {hasAppointments && (
                    <div className="mt-1 space-y-1">
                      {dayAppointments.slice(0, 2).map((apt) => (
                        <div
                          key={apt.id_agendamento}
                          className={cn(
                            "text-xs px-1.5 py-0.5 rounded truncate",
                            apt.status === "completed" && "bg-green-500/20 text-green-700 dark:text-green-400",
                            apt.status === "pending" && "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
                            apt.status === "confirmed" && "bg-blue-500/20 text-blue-700 dark:text-blue-400",
                            apt.status === "cancelled" && "bg-red-500/20 text-red-700 dark:text-red-400"
                          )}
                        >
                          {formatTimeFromISO(apt.start_time)} - {apt.nome_cliente || "Cliente"}
                        </div>
                      ))}
                      {dayAppointments.length > 2 && (
                        <div className="text-xs text-muted-foreground px-1.5">
                          +{dayAppointments.length - 2} mais
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

      <FAB onClick={handleCreate} icon={<Calendar className="w-6 h-6" />} />

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
                    <div>
                      <p className="font-medium">{apt.nome_cliente || "Cliente não informado"}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatTimeFromISO(apt.start_time)} - {getServiceName(apt.service_id)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
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
                  <div className="flex items-center gap-2">
                    <StatusBadge status={(apt.status || "pending") as "pending" | "confirmed" | "completed" | "cancelled"} />
                    <Select
                      value={apt.status || "pending"}
                      onValueChange={(value) => handleStatusChange(apt.id_agendamento, value)}
                    >
                      <SelectTrigger className="h-7 text-xs w-auto">
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

      {/* Create Appointment Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {modalStep === "selection" && "Novo Agendamento"}
              {modalStep === "existing-client" && "Selecionar Cliente"}
              {modalStep === "form" && (selectedClient ? "Agendar para Cliente" : "Novo Cliente")}
            </DialogTitle>
          </DialogHeader>

          {modalStep === "selection" && (
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full h-20 flex flex-col gap-1"
                onClick={handleSelectNewClient}
              >
                <UserPlus className="w-6 h-6" />
                <span>Novo Cliente</span>
              </Button>
              <Button
                variant="outline"
                className="w-full h-20 flex flex-col gap-1"
                onClick={handleSelectExistingClient}
              >
                <Search className="w-6 h-6" />
                <span>Cliente Existente</span>
              </Button>
            </div>
          )}

          {modalStep === "existing-client" && (
            <div className="space-y-4">
              <Button variant="ghost" size="sm" onClick={handleBack}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou telefone..."
                  value={clientSearchTerm}
                  onChange={(e) => setClientSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="max-h-[300px] overflow-y-auto space-y-2">
                {filteredClients.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    Nenhum cliente encontrado
                  </p>
                ) : (
                  filteredClients.map((client) => (
                    <button
                      key={client.client_id}
                      onClick={() => handleClientSelect(client)}
                      className="w-full p-3 text-left bg-muted/50 hover:bg-muted rounded-lg transition-colors"
                    >
                      <p className="font-medium">{client.nome || "Sem nome"}</p>
                      {client.telefone && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {client.telefone}
                        </p>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {modalStep === "form" && (
            <div className="space-y-4">
              <Button variant="ghost" size="sm" onClick={handleBack}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>

              <div className="space-y-2">
                <Label htmlFor="client">Cliente *</Label>
                <Input
                  id="client"
                  value={formData.client}
                  onChange={(e) => setFormData({ ...formData, client: e.target.value })}
                  placeholder="Nome do cliente"
                  disabled={!!selectedClient}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: formatPhoneMask(e.target.value) })}
                  placeholder="(11) 99999-9999"
                  maxLength={16}
                  disabled={!!selectedClient}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="service">Serviço</Label>
                <Select
                  value={formData.service}
                  onValueChange={(value) => setFormData({ ...formData, service: value })}
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
                  <Label htmlFor="date">Data *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time">Horário *</Label>
                  <Input
                    id="time"
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  />
                </div>
              </div>

              <Button onClick={handleSubmit} className="w-full">
                Criar Agendamento
              </Button>
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
    </div>
  );
}
