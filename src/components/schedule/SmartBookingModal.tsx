import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft,
  Check,
  Clock,
  User,
  Scissors,
  Calendar,
  Phone,
  Search,
  UserPlus,
  AlertCircle,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPhoneMask } from "@/lib/phoneMask";
import { useSmartBooking, ServiceWithDetails, StaffMember, TimeSlot } from "@/hooks/useSmartBooking";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBarbershop } from "@/hooks/useBarbershop";
import { toast } from "sonner";

interface Cliente {
  client_id: string;
  nome: string | null;
  telefone: string | null;
}

interface SmartBookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  initialDate?: string;
}

type BookingStep = "service" | "professional" | "datetime" | "client";

const BRASILIA_TIMEZONE = 'America/Sao_Paulo';

const getTodayInBrasilia = (): string => {
  const now = new Date();
  const year = now.toLocaleString("en-CA", { year: "numeric", timeZone: BRASILIA_TIMEZONE });
  const month = now.toLocaleString("en-CA", { month: "2-digit", timeZone: BRASILIA_TIMEZONE });
  const day = now.toLocaleString("en-CA", { day: "2-digit", timeZone: BRASILIA_TIMEZONE });
  return `${year}-${month}-${day}`;
};

const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(price);
};

const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
};

export function SmartBookingModal({ open, onOpenChange, onSuccess, initialDate }: SmartBookingModalProps) {
  const { user } = useAuth();
  const { barbershop } = useBarbershop();
  const {
    services,
    staffMembers,
    loading,
    getProfessionalsForService,
    isProfessionalWorkingOnDay,
    getAvailableTimeSlots,
    calculateEndTime,
    isTimeSlotAvailable,
    fetchAppointmentsForDate
  } = useSmartBooking();

  const [step, setStep] = useState<BookingStep>("service");
  const [selectedService, setSelectedService] = useState<ServiceWithDetails | null>(null);
  const [selectedProfessional, setSelectedProfessional] = useState<StaffMember | null>(null);
  const [selectedDate, setSelectedDate] = useState(initialDate || getTodayInBrasilia());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  // Client state
  const [clients, setClients] = useState<Cliente[]>([]);
  const [selectedClient, setSelectedClient] = useState<Cliente | null>(null);
  const [clientMode, setClientMode] = useState<"search" | "new" | null>(null);
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");

  const [submitting, setSubmitting] = useState(false);

  // Fetch clients
  useEffect(() => {
    const fetchClients = async () => {
      if (!barbershop?.id) return;
      const { data } = await supabase
        .from("clientes")
        .select("client_id, nome, telefone")
        .eq("barbershop_id", barbershop.id)
        .order("nome");
      if (data) setClients(data);
    };
    if (open) fetchClients();
  }, [open, barbershop?.id]);

  // Fetch available slots when professional and date change
  useEffect(() => {
    const loadSlots = async () => {
      if (!selectedProfessional || !selectedDate || !selectedService) return;
      
      setSlotsLoading(true);
      await fetchAppointmentsForDate(selectedDate, selectedProfessional.user_id);
      const slots = getAvailableTimeSlots(
        selectedProfessional.user_id,
        selectedDate,
        selectedService.duration_minutes
      );
      setAvailableSlots(slots);
      setSlotsLoading(false);
    };
    loadSlots();
  }, [selectedProfessional, selectedDate, selectedService]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setStep("service");
      setSelectedService(null);
      setSelectedProfessional(null);
      setSelectedDate(initialDate || getTodayInBrasilia());
      setSelectedTime(null);
      setSelectedClient(null);
      setClientMode(null);
      setClientSearchTerm("");
      setNewClientName("");
      setNewClientPhone("");
    }
  }, [open, initialDate]);

  const filteredProfessionals = selectedService
    ? getProfessionalsForService(selectedService.id)
    : staffMembers;

  const filteredClients = clients.filter(
    (client) =>
      client.nome?.toLowerCase().includes(clientSearchTerm.toLowerCase()) ||
      client.telefone?.includes(clientSearchTerm)
  );

  const handleServiceSelect = (service: ServiceWithDetails) => {
    setSelectedService(service);
    setSelectedProfessional(null);
    setSelectedTime(null);
    setStep("professional");
  };

  const handleProfessionalSelect = (professional: StaffMember) => {
    setSelectedProfessional(professional);
    setSelectedTime(null);
    setStep("datetime");
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setStep("client");
  };

  const handleBack = () => {
    switch (step) {
      case "professional":
        setStep("service");
        setSelectedService(null);
        break;
      case "datetime":
        setStep("professional");
        setSelectedProfessional(null);
        break;
      case "client":
        if (clientMode) {
          setClientMode(null);
        } else {
          setStep("datetime");
          setSelectedTime(null);
        }
        break;
    }
  };

  const handleSubmit = async () => {
    if (!user || !barbershop || !selectedService || !selectedProfessional || !selectedDate || !selectedTime) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    // Validate availability one more time
    const availability = isTimeSlotAvailable(
      selectedProfessional.user_id,
      selectedDate,
      selectedTime,
      selectedService.duration_minutes
    );

    if (!availability.available) {
      toast.error(availability.reason || "Horário não disponível");
      return;
    }

    setSubmitting(true);

    try {
      let clientId: string | null = selectedClient?.client_id || null;
      let clientName = selectedClient?.nome || newClientName || null;
      let clientPhone = selectedClient?.telefone || newClientPhone || null;

      // Create new client if needed
      if (!selectedClient && newClientName) {
        const { data: newClient, error: clientError } = await supabase
          .from("clientes")
          .insert({
            user_id: user.id,
            barbershop_id: barbershop.id,
            nome: newClientName,
            telefone: newClientPhone || null,
          })
          .select("client_id")
          .single();

        if (clientError) throw clientError;
        clientId = newClient.client_id;
      }

      const startTime = `${selectedDate}T${selectedTime}:00-03:00`;
      const endTimeStr = calculateEndTime(selectedTime, selectedService.duration_minutes);
      const endTime = `${selectedDate}T${endTimeStr}:00-03:00`;

      const { error } = await supabase
        .from("agendamentos")
        .insert({
          user_id: selectedProfessional.user_id,
          barbershop_id: barbershop.id,
          nome_cliente: clientName,
          telefone_cliente: clientPhone,
          service_id: selectedService.id,
          start_time: startTime,
          end_time: endTime,
          status: "pending",
          client_id: clientId,
        });

      if (error) throw error;

      toast.success("Agendamento criado com sucesso!");
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error("Error creating appointment:", error);
      toast.error("Erro ao criar agendamento");
    } finally {
      setSubmitting(false);
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case "service": return "Selecione o Serviço";
      case "professional": return "Selecione o Profissional";
      case "datetime": return "Escolha Data e Horário";
      case "client": return clientMode === "new" ? "Novo Cliente" : "Selecione o Cliente";
    }
  };

  const getStepNumber = () => {
    switch (step) {
      case "service": return 1;
      case "professional": return 2;
      case "datetime": return 3;
      case "client": return 4;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-lg max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2 border-b border-border">
          <div className="flex items-center gap-2">
            {step !== "service" && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleBack}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <DialogTitle className="flex-1">{getStepTitle()}</DialogTitle>
            <Badge variant="secondary" className="text-xs">
              Passo {getStepNumber()}/4
            </Badge>
          </div>

          {/* Selection Summary */}
          {(selectedService || selectedProfessional || selectedTime) && (
            <div className="flex flex-wrap gap-2 mt-2">
              {selectedService && (
                <Badge variant="outline" className="text-xs">
                  <Scissors className="w-3 h-3 mr-1" />
                  {selectedService.name}
                </Badge>
              )}
              {selectedProfessional && (
                <Badge variant="outline" className="text-xs">
                  <User className="w-3 h-3 mr-1" />
                  {selectedProfessional.name || "Sem nome"}
                </Badge>
              )}
              {selectedTime && (
                <Badge variant="outline" className="text-xs">
                  <Clock className="w-3 h-3 mr-1" />
                  {selectedDate} às {selectedTime}
                </Badge>
              )}
            </div>
          )}
        </DialogHeader>

        <ScrollArea className="flex-1 p-4">
          {/* Step 1: Service Selection */}
          {step === "service" && (
            <div className="space-y-2">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Carregando serviços...</div>
              ) : services.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum serviço cadastrado
                </div>
              ) : (
                services.map((service) => (
                  <button
                    key={service.id}
                    onClick={() => handleServiceSelect(service)}
                    className="w-full p-3 text-left bg-muted/50 hover:bg-muted rounded-lg transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      {service.is_package ? (
                        <Package className="w-5 h-5 text-primary" />
                      ) : (
                        <Scissors className="w-5 h-5 text-muted-foreground" />
                      )}
                      <div>
                        <p className="font-medium">{service.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDuration(service.duration_minutes)}
                        </p>
                      </div>
                    </div>
                    <span className="font-semibold text-primary">
                      {formatPrice(service.price)}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Step 2: Professional Selection */}
          {step === "professional" && (
            <div className="space-y-2">
              {filteredProfessionals.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">
                    Nenhum profissional disponível para este serviço
                  </p>
                </div>
              ) : (
                filteredProfessionals.map((professional) => {
                  const worksToday = isProfessionalWorkingOnDay(professional.user_id, selectedDate);
                  return (
                    <button
                      key={professional.user_id}
                      onClick={() => handleProfessionalSelect(professional)}
                      className="w-full p-3 text-left bg-muted/50 hover:bg-muted rounded-lg transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{professional.name || "Sem nome"}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {professional.role === "owner" ? "Proprietário" : "Funcionário"}
                          </p>
                        </div>
                      </div>
                      {!worksToday && (
                        <Badge variant="secondary" className="text-xs">
                          Folga hoje
                        </Badge>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          )}

          {/* Step 3: Date & Time Selection */}
          {step === "datetime" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Data</Label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setSelectedTime(null);
                  }}
                  min={getTodayInBrasilia()}
                />
              </div>

              {selectedProfessional && !isProfessionalWorkingOnDay(selectedProfessional.user_id, selectedDate) && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg text-destructive text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>O profissional não trabalha neste dia. Selecione outra data.</span>
                </div>
              )}

              {selectedProfessional && isProfessionalWorkingOnDay(selectedProfessional.user_id, selectedDate) && (
                <div className="space-y-2">
                  <Label>Horários Disponíveis</Label>
                  {slotsLoading ? (
                    <div className="text-center py-4 text-muted-foreground">Carregando horários...</div>
                  ) : availableSlots.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      Nenhum horário disponível nesta data
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-2">
                      {availableSlots.map((slot) => (
                        <button
                          key={slot.time}
                          onClick={() => slot.available && handleTimeSelect(slot.time)}
                          disabled={!slot.available}
                          className={cn(
                            "p-2 text-sm rounded-lg border transition-colors",
                            slot.available
                              ? "border-border hover:border-primary hover:bg-primary/5 cursor-pointer"
                              : "border-border/50 bg-muted/30 text-muted-foreground cursor-not-allowed",
                            selectedTime === slot.time && "border-primary bg-primary/10"
                          )}
                          title={slot.reason}
                        >
                          {slot.time}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 4: Client Selection */}
          {step === "client" && (
            <div className="space-y-4">
              {!clientMode && (
                <div className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full h-16 flex flex-col gap-1"
                    onClick={() => setClientMode("search")}
                  >
                    <Search className="w-5 h-5" />
                    <span>Cliente Existente</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full h-16 flex flex-col gap-1"
                    onClick={() => setClientMode("new")}
                  >
                    <UserPlus className="w-5 h-5" />
                    <span>Novo Cliente</span>
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={handleSubmit}
                    disabled={submitting}
                  >
                    Continuar sem cliente
                  </Button>
                </div>
              )}

              {clientMode === "search" && (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome ou telefone..."
                      value={clientSearchTerm}
                      onChange={(e) => setClientSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {filteredClients.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4">
                        Nenhum cliente encontrado
                      </p>
                    ) : (
                      filteredClients.map((client) => (
                        <button
                          key={client.client_id}
                          onClick={() => setSelectedClient(client)}
                          className={cn(
                            "w-full p-3 text-left bg-muted/50 hover:bg-muted rounded-lg transition-colors",
                            selectedClient?.client_id === client.client_id && "ring-2 ring-primary"
                          )}
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

                  {selectedClient && (
                    <Button onClick={handleSubmit} className="w-full" disabled={submitting}>
                      {submitting ? "Criando..." : "Criar Agendamento"}
                    </Button>
                  )}
                </div>
              )}

              {clientMode === "new" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="newClientName">Nome *</Label>
                    <Input
                      id="newClientName"
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      placeholder="Nome do cliente"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newClientPhone">Telefone</Label>
                    <Input
                      id="newClientPhone"
                      value={newClientPhone}
                      onChange={(e) => setNewClientPhone(formatPhoneMask(e.target.value))}
                      placeholder="(11) 99999-9999"
                      maxLength={16}
                    />
                  </div>
                  <Button
                    onClick={handleSubmit}
                    className="w-full"
                    disabled={!newClientName.trim() || submitting}
                  >
                    {submitting ? "Criando..." : "Criar Agendamento"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
