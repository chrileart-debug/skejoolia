import { useState, useEffect } from "react";
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
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface Appointment {
  id_agendamento: string;
  nome_cliente: string | null;
  telefone_cliente: string | null;
  dia_do_corte: string;
  horario_corte: string;
  status: string | null;
  id_corte: string | null;
  client_id: string | null;
}

interface Corte {
  id_corte: string;
  nome_corte: string;
}

export default function Schedule() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Corte[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDayDialogOpen, setIsDayDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedDayAppointments, setSelectedDayAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    client: "",
    phone: "",
    service: "",
    date: "",
    time: "",
  });

  // Get first and last day of month for fetching
  const getMonthRange = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    return {
      start: firstDay.toISOString().split('T')[0],
      end: lastDay.toISOString().split('T')[0],
    };
  };

  // Fetch appointments for the entire month
  const fetchAppointments = async () => {
    if (!user) return;

    const { start, end } = getMonthRange(selectedDate);
    
    const { data, error } = await supabase
      .from("agendamentos")
      .select("*")
      .eq("user_id", user.id)
      .gte("dia_do_corte", start)
      .lte("dia_do_corte", end)
      .order("horario_corte", { ascending: true });

    if (error) {
      console.error("Error fetching appointments:", error);
      toast.error("Erro ao carregar agendamentos");
    } else {
      setAppointments(data || []);
    }
    setLoading(false);
  };

  // Fetch services from Supabase
  const fetchServices = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("cortes")
      .select("id_corte, nome_corte")
      .eq("user_id", user.id);

    if (error) {
      console.error("Error fetching services:", error);
    } else {
      setServices(data || []);
    }
  };

  useEffect(() => {
    if (user) {
      fetchAppointments();
      fetchServices();
    }
  }, [user, selectedDate.getMonth(), selectedDate.getFullYear()]);

  const handleCreate = () => {
    setFormData({ client: "", phone: "", service: "", date: "", time: "" });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.service || !formData.date || !formData.time) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    if (!user) {
      toast.error("Você precisa estar logado");
      return;
    }

    let clientId: string | null = null;

    if (formData.client) {
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

    const { error } = await supabase
      .from("agendamentos")
      .insert({
        user_id: user.id,
        nome_cliente: formData.client || null,
        telefone_cliente: formData.phone || null,
        id_corte: formData.service,
        dia_do_corte: formData.date,
        horario_corte: formData.time,
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

  const navigateMonth = (direction: "prev" | "next") => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() + (direction === "next" ? 1 : -1));
    setSelectedDate(newDate);
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const getServiceName = (id_corte: string | null) => {
    if (!id_corte) return "Serviço não definido";
    const service = services.find((s) => s.id_corte === id_corte);
    return service?.nome_corte || "Serviço não encontrado";
  };

  // Generate calendar days
  const generateCalendarDays = () => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const startingDayOfWeek = firstDayOfMonth.getDay();
    const daysInMonth = lastDayOfMonth.getDate();
    
    const days: { date: Date; isCurrentMonth: boolean }[] = [];
    
    // Previous month days
    const prevMonth = new Date(year, month, 0);
    const prevMonthDays = prevMonth.getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthDays - i),
        isCurrentMonth: false,
      });
    }
    
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }
    
    // Next month days to fill the grid
    const remainingDays = 42 - days.length; // 6 rows × 7 days
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }
    
    return days;
  };

  const getAppointmentsForDay = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return appointments.filter((a) => a.dia_do_corte === dateStr);
  };

  const handleDayClick = (date: Date) => {
    const dayAppointments = getAppointmentsForDay(date);
    setSelectedDayAppointments(dayAppointments);
    setFormData((prev) => ({
      ...prev,
      date: date.toISOString().split('T')[0],
    }));
    setIsDayDialogOpen(true);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const calendarDays = generateCalendarDays();

  return (
    <div className="min-h-screen flex flex-col">
      <Header title="Agenda" subtitle="Calendário de agendamentos" />

      <div className="flex-1 p-4 lg:p-6 flex flex-col">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigateMonth("prev")}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigateMonth("next")}>
              <ChevronRight className="w-5 h-5" />
            </Button>
            <h2 className="text-xl font-semibold text-foreground ml-2">
              {monthNames[selectedDate.getMonth()]} {selectedDate.getFullYear()}
            </h2>
          </div>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Hoje
          </Button>
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 bg-card rounded-xl border border-border overflow-hidden">
          {/* Week Days Header */}
          <div className="grid grid-cols-7 border-b border-border">
            {weekDays.map((day) => (
              <div
                key={day}
                className="py-3 text-center text-sm font-medium text-muted-foreground border-r border-border last:border-r-0"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          {loading ? (
            <div className="flex items-center justify-center h-96">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-7 grid-rows-6 flex-1">
              {calendarDays.map((day, index) => {
                const dayAppointments = getAppointmentsForDay(day.date);
                const hasAppointments = dayAppointments.length > 0;
                
                return (
                  <div
                    key={index}
                    onClick={() => handleDayClick(day.date)}
                    className={cn(
                      "min-h-[80px] lg:min-h-[100px] p-1 lg:p-2 border-r border-b border-border last:border-r-0 cursor-pointer transition-colors hover:bg-muted/50",
                      !day.isCurrentMonth && "bg-muted/30"
                    )}
                  >
                    <div className="flex flex-col h-full">
                      <span
                        className={cn(
                          "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full",
                          !day.isCurrentMonth && "text-muted-foreground",
                          isToday(day.date) && "bg-primary text-primary-foreground"
                        )}
                      >
                        {day.date.getDate()}
                      </span>
                      
                      {hasAppointments && (
                        <div className="flex-1 mt-1 space-y-0.5 overflow-hidden">
                          {dayAppointments.slice(0, 3).map((apt) => (
                            <div
                              key={apt.id_agendamento}
                              className={cn(
                                "text-xs px-1.5 py-0.5 rounded truncate",
                                apt.status === "confirmed" && "bg-primary/20 text-primary",
                                apt.status === "pending" && "bg-warning/20 text-warning",
                                apt.status === "completed" && "bg-success/20 text-success",
                                !apt.status && "bg-muted text-muted-foreground"
                              )}
                            >
                              <span className="font-medium">{apt.horario_corte?.slice(0, 5)}</span>
                              <span className="hidden lg:inline"> - {apt.nome_cliente || "Cliente"}</span>
                            </div>
                          ))}
                          {dayAppointments.length > 3 && (
                            <div className="text-xs text-muted-foreground px-1.5">
                              +{dayAppointments.length - 3} mais
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <FAB onClick={handleCreate} />

      {/* Day Details Dialog */}
      <Dialog open={isDayDialogOpen} onOpenChange={setIsDayDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {formData.date && new Date(formData.date + 'T12:00:00').toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            {selectedDayAppointments.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhum agendamento para este dia</p>
                <Button 
                  className="mt-4" 
                  onClick={() => {
                    setIsDayDialogOpen(false);
                    setIsDialogOpen(true);
                  }}
                >
                  Criar Agendamento
                </Button>
              </div>
            ) : (
              <>
                {selectedDayAppointments.map((appointment) => (
                  <div
                    key={appointment.id_agendamento}
                    className="bg-muted/50 rounded-xl p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-center min-w-[50px]">
                          <p className="text-lg font-bold text-foreground">
                            {appointment.horario_corte?.slice(0, 5)}
                          </p>
                        </div>
                        <div className="w-px h-10 bg-border" />
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">
                              {appointment.nome_cliente || "Cliente não informado"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {getServiceName(appointment.id_corte)}
                            </p>
                          </div>
                        </div>
                      </div>
                      <Select
                        value={appointment.status || "pending"}
                        onValueChange={(value) =>
                          handleStatusChange(appointment.id_agendamento, value)
                        }
                      >
                        <SelectTrigger className="w-auto border-0 bg-transparent p-0 h-auto">
                          <StatusBadge status={appointment.status as "pending" | "confirmed" | "completed" || "pending"} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pendente</SelectItem>
                          <SelectItem value="confirmed">Confirmado</SelectItem>
                          <SelectItem value="completed">Concluído</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
                <Button 
                  variant="outline" 
                  className="w-full mt-2"
                  onClick={() => {
                    setIsDayDialogOpen(false);
                    setIsDialogOpen(true);
                  }}
                >
                  Adicionar Agendamento
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* New Appointment Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Agendamento</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Input
                placeholder="Nome do cliente (opcional)"
                value={formData.client}
                onChange={(e) =>
                  setFormData({ ...formData, client: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                placeholder="Telefone do cliente"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Serviço *</Label>
              <Select
                value={formData.service}
                onValueChange={(value) =>
                  setFormData({ ...formData, service: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o serviço" />
                </SelectTrigger>
                <SelectContent>
                  {services.map((service) => (
                    <SelectItem key={service.id_corte} value={service.id_corte}>
                      {service.nome_corte}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data *</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) =>
                    setFormData({ ...formData, date: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Horário *</Label>
                <Input
                  type="time"
                  value={formData.time}
                  onChange={(e) =>
                    setFormData({ ...formData, time: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button className="flex-1" onClick={handleSubmit}>
                Agendar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
