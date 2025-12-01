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
  Link2,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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
  const [copied, setCopied] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    client: "",
    phone: "",
    service: "",
    date: "",
    time: "",
  });

  const bookingLink = "barber.app/agendar/barbearia-do-ze";

  // Fetch appointments from Supabase
  const fetchAppointments = async () => {
    if (!user) return;

    const dateStr = selectedDate.toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from("agendamentos")
      .select("*")
      .eq("user_id", user.id)
      .eq("dia_do_corte", dateStr)
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
  }, [user, selectedDate]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`https://${bookingLink}`);
    setCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreate = () => {
    setFormData({ client: "", phone: "", service: "", date: "", time: "" });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.client || !formData.service || !formData.date || !formData.time) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    if (!user) {
      toast.error("Você precisa estar logado");
      return;
    }

    const { data, error } = await supabase
      .from("agendamentos")
      .insert({
        user_id: user.id,
        nome_cliente: formData.client,
        telefone_cliente: formData.phone || null,
        id_corte: formData.service,
        dia_do_corte: formData.date,
        horario_corte: formData.time,
        status: "pending",
      })
      .select()
      .single();

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
      toast.success("Status atualizado");
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  };

  const navigateDate = (direction: "prev" | "next") => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + (direction === "next" ? 1 : -1));
    setSelectedDate(newDate);
  };

  const getServiceName = (id_corte: string | null) => {
    if (!id_corte) return "Serviço não definido";
    const service = services.find((s) => s.id_corte === id_corte);
    return service?.nome_corte || "Serviço não encontrado";
  };

  return (
    <div className="min-h-screen">
      <Header title="Agenda" subtitle="Gerencie seus agendamentos" />

      <div className="p-4 lg:p-6 space-y-6">
        {/* Booking Link Card */}
        <div className="bg-card rounded-2xl shadow-card p-5 animate-fade-in">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Link2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">
                Seu Link de Agendamento
              </h3>
              <p className="text-sm text-muted-foreground">
                Compartilhe com seus clientes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 px-4 py-2.5 bg-muted rounded-xl text-sm text-foreground truncate">
              {bookingLink}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopyLink}
              className="shrink-0"
            >
              {copied ? (
                <Check className="w-4 h-4 text-success" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Date Navigation */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigateDate("prev")}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="text-center">
            <p className="text-lg font-semibold text-foreground capitalize">
              {formatDate(selectedDate)}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => navigateDate("next")}>
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        {/* Appointments List */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Carregando...</p>
            </div>
          ) : appointments.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Nenhum agendamento para este dia
              </p>
            </div>
          ) : (
            appointments.map((appointment, index) => (
              <div
                key={appointment.id_agendamento}
                className="bg-card rounded-2xl shadow-card p-4 hover:shadow-card-hover transition-all duration-300 animate-slide-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Time */}
                    <div className="text-center min-w-[60px]">
                      <p className="text-lg font-bold text-foreground">
                        {appointment.horario_corte?.slice(0, 5)}
                      </p>
                    </div>

                    {/* Divider */}
                    <div className="w-px h-12 bg-border" />

                    {/* Client Info */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
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

                  {/* Status */}
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
            ))
          )}
        </div>
      </div>

      <FAB onClick={handleCreate} />

      {/* New Appointment Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Agendamento</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Input
                placeholder="Nome do cliente"
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
