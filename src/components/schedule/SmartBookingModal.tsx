import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPhoneMask } from "@/lib/phoneMask";
import { useSmartBooking, ServiceWithDetails, StaffMember, TimeSlot } from "@/hooks/useSmartBooking";
import { useSubscriptionUsage } from "@/hooks/useSubscriptionUsage";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBarbershop } from "@/hooks/useBarbershop";
import { toast } from "sonner";
import { VipCrown } from "@/components/club/VipBadge";

interface Cliente {
  client_id: string;
  nome: string | null;
  telefone: string | null;
  subscription_status?: string | null;
  subscription_next_due_date?: string | null;
}

interface ServiceCredit {
  serviceId: string;
  quantityLimit: number;
  currentUsage: number;
  remaining: number;
}

interface SmartBookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  initialDate?: string;
}

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

const formatDateDisplay = (dateStr: string): string => {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
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
  const { checkSubscriptionUsage, recordUsage } = useSubscriptionUsage();

  const [currentStep, setCurrentStep] = useState(1);
  const [animating, setAnimating] = useState(false);
  const [animationDirection, setAnimationDirection] = useState<'forward' | 'back'>('forward');

  // Selections
  const [selectedClient, setSelectedClient] = useState<Cliente | null>(null);
  const [selectedService, setSelectedService] = useState<ServiceWithDetails | null>(null);
  const [selectedProfessional, setSelectedProfessional] = useState<StaffMember | null>(null);
  const [selectedDate, setSelectedDate] = useState(initialDate || getTodayInBrasilia());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  // Client state
  const [clients, setClients] = useState<Cliente[]>([]);
  const [clientMode, setClientMode] = useState<"search" | "new" | null>(null);
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");

  const [submitting, setSubmitting] = useState(false);

  // Subscription limit alert state
  const [limitAlertOpen, setLimitAlertOpen] = useState(false);
  const [pendingAppointmentData, setPendingAppointmentData] = useState<{
    appointmentId: string;
    subscriptionId: string;
    serviceId: string;
    currentUsage: number;
    quantityLimit: number;
  } | null>(null);

  // Client subscription credits state
  const [clientServiceCredits, setClientServiceCredits] = useState<ServiceCredit[]>([]);
  const [loadingCredits, setLoadingCredits] = useState(false);

  // Fetch clients with VIP status
  useEffect(() => {
    const fetchClients = async () => {
      if (!barbershop?.id) return;
      
      // Fetch clients
      const { data: clientsData } = await supabase
        .from("clientes")
        .select("client_id, nome, telefone")
        .eq("barbershop_id", barbershop.id)
        .order("nome");
      
      if (!clientsData) return;
      
      // Fetch active subscriptions
      const { data: subscriptions } = await supabase
        .from("client_club_subscriptions")
        .select("client_id, status, next_due_date")
        .eq("barbershop_id", barbershop.id)
        .eq("status", "active");
      
      // Merge data
      const clientsWithVip = clientsData.map(client => {
        const sub = subscriptions?.find(s => s.client_id === client.client_id);
        return {
          ...client,
          subscription_status: sub?.status || null,
          subscription_next_due_date: sub?.next_due_date || null,
        };
      });
      
      setClients(clientsWithVip);
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
      setCurrentStep(1);
      setSelectedService(null);
      setSelectedProfessional(null);
      setSelectedDate(initialDate || getTodayInBrasilia());
      setSelectedTime(null);
      setSelectedClient(null);
      setClientMode(null);
      setClientSearchTerm("");
      setNewClientName("");
      setNewClientPhone("");
      setLimitAlertOpen(false);
      setPendingAppointmentData(null);
      setClientServiceCredits([]);
    }
  }, [open, initialDate]);

  // Fetch client subscription credits when client is selected
  useEffect(() => {
    const fetchClientCredits = async () => {
      if (!selectedClient || selectedClient.client_id === "new" || !barbershop?.id) {
        setClientServiceCredits([]);
        return;
      }

      setLoadingCredits(true);
      try {
        // Get active subscription for this client
        const { data: subscription } = await supabase
          .from("client_club_subscriptions")
          .select("id, plan_id, status")
          .eq("client_id", selectedClient.client_id)
          .eq("barbershop_id", barbershop.id)
          .eq("status", "active")
          .maybeSingle();

        if (!subscription) {
          setClientServiceCredits([]);
          setLoadingCredits(false);
          return;
        }

        // Get plan items (services included in the plan)
        const { data: planItems } = await supabase
          .from("barber_plan_items")
          .select("service_id, quantity_limit")
          .eq("plan_id", subscription.plan_id);

        if (!planItems || planItems.length === 0) {
          setClientServiceCredits([]);
          setLoadingCredits(false);
          return;
        }

        // Get current month usage for each service
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

        const credits: ServiceCredit[] = [];
        
        for (const item of planItems) {
          const { count } = await supabase
            .from("client_subscription_usage")
            .select("*", { count: "exact", head: true })
            .eq("subscription_id", subscription.id)
            .eq("service_id", item.service_id)
            .gte("used_at", firstDayOfMonth.toISOString())
            .lte("used_at", lastDayOfMonth.toISOString());

          const currentUsage = count || 0;
          const quantityLimit = item.quantity_limit || 0;
          // If limit is 0, it means unlimited
          const remaining = quantityLimit === 0 ? -1 : Math.max(0, quantityLimit - currentUsage);

          credits.push({
            serviceId: item.service_id,
            quantityLimit,
            currentUsage,
            remaining,
          });
        }

        setClientServiceCredits(credits);
      } catch (error) {
        console.error("Error fetching client credits:", error);
        setClientServiceCredits([]);
      } finally {
        setLoadingCredits(false);
      }
    };

    fetchClientCredits();
  }, [selectedClient, barbershop?.id]);

  const filteredProfessionals = selectedService
    ? getProfessionalsForService(selectedService.id)
    : staffMembers;

  const filteredClients = clients.filter(
    (client) =>
      client.nome?.toLowerCase().includes(clientSearchTerm.toLowerCase()) ||
      client.telefone?.includes(clientSearchTerm)
  );

  const goToStep = (step: number, direction: 'forward' | 'back' = 'forward') => {
    setAnimationDirection(direction);
    setAnimating(true);
    setTimeout(() => {
      setCurrentStep(step);
      setAnimating(false);
    }, 150);
  };

  const handleClientSelect = (client: Cliente) => {
    setSelectedClient(client);
    setClientMode(null);
    goToStep(2);
  };

  const handleNewClientConfirm = () => {
    if (!newClientName.trim()) {
      toast.error("Digite o nome do cliente");
      return;
    }
    setSelectedClient({
      client_id: "new",
      nome: newClientName,
      telefone: newClientPhone || null
    });
    goToStep(2);
  };

  const handleServiceSelect = (service: ServiceWithDetails) => {
    setSelectedService(service);
    setSelectedProfessional(null);
    setSelectedTime(null);
    goToStep(3);
  };

  const handleProfessionalSelect = (professional: StaffMember) => {
    setSelectedProfessional(professional);
    setSelectedTime(null);
    goToStep(4);
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
  };

  const handleBack = () => {
    if (currentStep === 1 && clientMode) {
      setClientMode(null);
      return;
    }
    
    switch (currentStep) {
      case 2:
        goToStep(1, 'back');
        setSelectedService(null);
        break;
      case 3:
        goToStep(2, 'back');
        setSelectedProfessional(null);
        break;
      case 4:
        goToStep(3, 'back');
        setSelectedTime(null);
        break;
    }
  };

  const handleSubmit = async () => {
    if (!user || !barbershop || !selectedService || !selectedProfessional || !selectedDate || !selectedTime) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

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
      let clientId: string | null = null;
      let clientName = selectedClient?.nome || null;
      let clientPhone = selectedClient?.telefone || null;

      // Create new client if needed
      if (selectedClient?.client_id === "new" && selectedClient.nome) {
        const { data: newClient, error: clientError } = await supabase
          .from("clientes")
          .insert({
            user_id: user.id,
            barbershop_id: barbershop.id,
            nome: selectedClient.nome,
            telefone: selectedClient.telefone || null,
          })
          .select("client_id")
          .single();

        if (clientError) throw clientError;
        clientId = newClient.client_id;
      } else if (selectedClient?.client_id && selectedClient.client_id !== "new") {
        clientId = selectedClient.client_id;
      }

      const startTime = `${selectedDate}T${selectedTime}:00-03:00`;
      const endTimeStr = calculateEndTime(selectedTime, selectedService.duration_minutes);
      const endTime = `${selectedDate}T${endTimeStr}:00-03:00`;

      // Step A: Create the appointment
      const { data: appointmentData, error } = await supabase
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
        })
        .select("id_agendamento")
        .single();

      if (error) throw error;

      const appointmentId = appointmentData.id_agendamento;

      // Step B, C, D: Check subscription usage (only if client has an ID)
      if (clientId) {
        const usageCheck = await checkSubscriptionUsage(
          clientId,
          barbershop.id,
          selectedService.id
        );

        if (usageCheck.hasActiveSubscription && usageCheck.isServiceInPlan) {
          if (usageCheck.isWithinLimit) {
            // Scenario 1: Within limit - auto-record usage
            await recordUsage(usageCheck.subscriptionId!, selectedService.id, appointmentId);
            toast.success("Agendamento criado com sucesso! Uso do plano registrado.");
          } else {
            // Scenario 2: Limit reached - show alert
            setPendingAppointmentData({
              appointmentId,
              subscriptionId: usageCheck.subscriptionId!,
              serviceId: selectedService.id,
              currentUsage: usageCheck.currentUsage,
              quantityLimit: usageCheck.quantityLimit,
            });
            setLimitAlertOpen(true);
            setSubmitting(false);
            return; // Don't close modal yet
          }
        } else {
          toast.success("Agendamento criado com sucesso!");
        }
      } else {
        toast.success("Agendamento criado com sucesso!");
      }

      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error("Error creating appointment:", error);
      toast.error("Erro ao criar agendamento");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle charging separately (do not record usage)
  const handleChargeSeparately = () => {
    setLimitAlertOpen(false);
    setPendingAppointmentData(null);
    toast.success("Agendamento criado! Será cobrado separadamente.");
    onOpenChange(false);
    onSuccess();
  };

  // Handle manual override (record usage anyway)
  const handleManualOverride = async () => {
    if (!pendingAppointmentData) return;

    const success = await recordUsage(
      pendingAppointmentData.subscriptionId,
      pendingAppointmentData.serviceId,
      pendingAppointmentData.appointmentId
    );

    setLimitAlertOpen(false);
    setPendingAppointmentData(null);

    if (success) {
      toast.success("Agendamento criado! Uso registrado além do limite.");
    } else {
      toast.warning("Agendamento criado, mas houve erro ao registrar uso.");
    }

    onOpenChange(false);
    onSuccess();
  };

  const stepTitles = [
    "Identificação",
    "O que vamos fazer?",
    "Com quem?",
    "Quando?"
  ];

  const canConfirm = selectedClient && selectedService && selectedProfessional && selectedTime;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-2xl lg:max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header with Step Indicator */}
        <div className="p-4 border-b border-border bg-muted/30">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Novo Agendamento</h2>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4].map((step) => (
                <div
                  key={step}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all duration-300",
                    currentStep >= step ? "bg-primary" : "bg-muted-foreground/30",
                    currentStep === step && "w-6"
                  )}
                />
              ))}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Passo {currentStep} de 4 — {stepTitles[currentStep - 1]}
          </p>
        </div>

        {/* Main Content - Two Column Layout on Desktop */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
          {/* Left Column - Summary Timeline (Hidden on mobile) */}
          <div className="hidden lg:flex flex-col w-64 border-r border-border bg-muted/20 p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">Resumo</p>
            <div className="space-y-3">
              {/* Client Summary */}
              <SummaryItem
                icon={<User className="w-4 h-4" />}
                label="Cliente"
                value={selectedClient?.nome}
                active={currentStep === 1}
                completed={!!selectedClient}
              />
              {/* Service Summary */}
              <SummaryItem
                icon={<Scissors className="w-4 h-4" />}
                label="Serviço"
                value={selectedService?.name}
                subValue={selectedService ? formatPrice(selectedService.price) : undefined}
                active={currentStep === 2}
                completed={!!selectedService}
              />
              {/* Professional Summary */}
              <SummaryItem
                icon={<User className="w-4 h-4" />}
                label="Profissional"
                value={selectedProfessional?.name}
                active={currentStep === 3}
                completed={!!selectedProfessional}
              />
              {/* DateTime Summary */}
              <SummaryItem
                icon={<Calendar className="w-4 h-4" />}
                label="Data e Hora"
                value={selectedTime ? `${formatDateDisplay(selectedDate)} às ${selectedTime}` : undefined}
                active={currentStep === 4}
                completed={!!selectedTime}
              />
            </div>
          </div>

          {/* Right Column - Step Content */}
          <ScrollArea className="flex-1">
            <div className="p-4 lg:p-6">
              <div
                className={cn(
                  "transition-all duration-200",
                  animating && animationDirection === 'forward' && "opacity-0 translate-x-4",
                  animating && animationDirection === 'back' && "opacity-0 -translate-x-4",
                  !animating && "opacity-100 translate-x-0"
                )}
              >
                {/* Step 1: Client */}
                {currentStep === 1 && (
                  <Step1Client
                    clientMode={clientMode}
                    setClientMode={setClientMode}
                    clientSearchTerm={clientSearchTerm}
                    setClientSearchTerm={setClientSearchTerm}
                    filteredClients={filteredClients}
                    onClientSelect={handleClientSelect}
                    newClientName={newClientName}
                    setNewClientName={setNewClientName}
                    newClientPhone={newClientPhone}
                    setNewClientPhone={setNewClientPhone}
                    onNewClientConfirm={handleNewClientConfirm}
                  />
                )}

                {/* Step 2: Service */}
                {currentStep === 2 && (
                  <Step2Service
                    services={services}
                    loading={loading || loadingCredits}
                    onServiceSelect={handleServiceSelect}
                    selectedService={selectedService}
                    clientServiceCredits={clientServiceCredits}
                  />
                )}

                {/* Step 3: Professional */}
                {currentStep === 3 && (
                  <Step3Professional
                    professionals={filteredProfessionals}
                    onProfessionalSelect={handleProfessionalSelect}
                    selectedProfessional={selectedProfessional}
                    selectedDate={selectedDate}
                    isProfessionalWorkingOnDay={isProfessionalWorkingOnDay}
                  />
                )}

                {/* Step 4: DateTime */}
                {currentStep === 4 && (
                  <Step4DateTime
                    selectedDate={selectedDate}
                    setSelectedDate={(date) => {
                      setSelectedDate(date);
                      setSelectedTime(null);
                    }}
                    selectedTime={selectedTime}
                    onTimeSelect={handleTimeSelect}
                    availableSlots={availableSlots}
                    slotsLoading={slotsLoading}
                    selectedProfessional={selectedProfessional}
                    isProfessionalWorkingOnDay={isProfessionalWorkingOnDay}
                  />
                )}
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* Footer Navigation */}
        <div className="p-4 border-t border-border bg-background flex items-center justify-between gap-3">
          {(currentStep > 1 || clientMode) ? (
            <Button variant="ghost" onClick={handleBack} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </Button>
          ) : (
            <div />
          )}
          
          {currentStep === 4 && (
            <Button
              onClick={handleSubmit}
              disabled={!canConfirm || submitting}
              className="gap-2"
            >
              {submitting ? "Salvando..." : "Confirmar Agendamento"}
              <Check className="w-4 h-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* Subscription Limit Alert */}
    <AlertDialog open={limitAlertOpen} onOpenChange={setLimitAlertOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="w-5 h-5" />
            Limite do Plano Atingido
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              O cliente atingiu o limite de uso do plano para este serviço.
            </p>
            {pendingAppointmentData && (
              <p className="font-medium text-foreground">
                Uso atual: {pendingAppointmentData.currentUsage}/{pendingAppointmentData.quantityLimit}
              </p>
            )}
            <p>Como deseja proceder?</p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel onClick={handleChargeSeparately}>
            Cobrar Separadamente
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleManualOverride} className="bg-amber-600 hover:bg-amber-700">
            Registrar Mesmo Assim
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
  );
}

// Summary Item Component
function SummaryItem({ 
  icon, 
  label, 
  value, 
  subValue,
  active, 
  completed 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value?: string | null; 
  subValue?: string;
  active: boolean; 
  completed: boolean;
}) {
  return (
    <div className={cn(
      "flex items-start gap-3 p-2 rounded-lg transition-colors",
      active && "bg-primary/10"
    )}>
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors",
        completed ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
      )}>
        {completed ? <Check className="w-4 h-4" /> : icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn(
          "text-sm font-medium truncate",
          !value && "text-muted-foreground italic"
        )}>
          {value || "Não selecionado"}
        </p>
        {subValue && <p className="text-xs text-primary">{subValue}</p>}
      </div>
    </div>
  );
}

// Step 1: Client Selection
function Step1Client({
  clientMode,
  setClientMode,
  clientSearchTerm,
  setClientSearchTerm,
  filteredClients,
  onClientSelect,
  newClientName,
  setNewClientName,
  newClientPhone,
  setNewClientPhone,
  onNewClientConfirm,
}: {
  clientMode: "search" | "new" | null;
  setClientMode: (mode: "search" | "new" | null) => void;
  clientSearchTerm: string;
  setClientSearchTerm: (term: string) => void;
  filteredClients: Cliente[];
  onClientSelect: (client: Cliente) => void;
  newClientName: string;
  setNewClientName: (name: string) => void;
  newClientPhone: string;
  setNewClientPhone: (phone: string) => void;
  onNewClientConfirm: () => void;
}) {
  if (!clientMode) {
    return (
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente por nome ou telefone..."
            value={clientSearchTerm}
            onChange={(e) => {
              setClientSearchTerm(e.target.value);
              if (e.target.value) setClientMode("search");
            }}
            className="pl-10 h-12 text-base"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => setClientMode("search")}
            className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors text-left"
          >
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Search className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="font-medium">Cliente Existente</p>
              <p className="text-sm text-muted-foreground">Buscar na base</p>
            </div>
          </button>

          <button
            onClick={() => setClientMode("new")}
            className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors text-left"
          >
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <UserPlus className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="font-medium">Novo Cliente</p>
              <p className="text-sm text-muted-foreground">Cadastrar agora</p>
            </div>
          </button>
        </div>
      </div>
    );
  }

  if (clientMode === "search") {
    return (
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente..."
            value={clientSearchTerm}
            onChange={(e) => setClientSearchTerm(e.target.value)}
            className="pl-10 h-12 text-base"
            autoFocus
          />
        </div>

        <div className="space-y-2">
          {filteredClients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <User className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>Nenhum cliente encontrado</p>
              <Button
                variant="link"
                onClick={() => setClientMode("new")}
                className="mt-2"
              >
                Cadastrar novo cliente
              </Button>
            </div>
          ) : (
            filteredClients.map((client) => (
              <button
                key={client.client_id}
                onClick={() => onClientSelect(client)}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-muted/50 hover:border-primary/50 transition-all text-left group"
              >
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    <User className="w-6 h-6 text-muted-foreground" />
                  </div>
                  {client.subscription_status === "active" && (
                    <div className="absolute -top-1 -right-1">
                      <VipCrown 
                        status={client.subscription_status} 
                        nextDueDate={client.subscription_next_due_date || null}
                      />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{client.nome || "Sem nome"}</p>
                  {client.telefone && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {formatPhoneMask(client.telefone)}
                    </p>
                  )}
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  // New client form
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium mb-1.5 block">Nome do Cliente *</label>
          <Input
            placeholder="Digite o nome"
            value={newClientName}
            onChange={(e) => setNewClientName(e.target.value)}
            className="h-12"
            autoFocus
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">WhatsApp (opcional)</label>
          <Input
            placeholder="(00) 00000-0000"
            value={newClientPhone}
            onChange={(e) => setNewClientPhone(formatPhoneMask(e.target.value))}
            className="h-12"
          />
        </div>
      </div>

      <Button onClick={onNewClientConfirm} className="w-full h-12 gap-2">
        <UserPlus className="w-5 h-5" />
        Continuar com este cliente
      </Button>
    </div>
  );
}

// Step 2: Service Selection
function Step2Service({
  services,
  loading,
  onServiceSelect,
  selectedService,
  clientServiceCredits,
}: {
  services: ServiceWithDetails[];
  loading: boolean;
  onServiceSelect: (service: ServiceWithDetails) => void;
  selectedService: ServiceWithDetails | null;
  clientServiceCredits: ServiceCredit[];
}) {
  const getServiceCredit = (serviceId: string): ServiceCredit | undefined => {
    return clientServiceCredits.find(c => c.serviceId === serviceId);
  };

  if (loading) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        Carregando serviços...
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Scissors className="w-10 h-10 mx-auto mb-2 opacity-50" />
        <p>Nenhum serviço cadastrado</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {services.map((service) => {
        const credit = getServiceCredit(service.id);
        const hasActivePlan = !!credit;

        return (
          <button
            key={service.id}
            onClick={() => onServiceSelect(service)}
            className={cn(
              "flex flex-col p-4 rounded-xl border transition-all text-left group relative",
              selectedService?.id === service.id
                ? "border-primary bg-primary/5"
                : hasActivePlan
                  ? "border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20 hover:border-emerald-500 hover:bg-emerald-100/50 dark:hover:bg-emerald-950/30"
                  : "border-border bg-card hover:bg-muted/50 hover:border-primary/50"
            )}
          >
            {/* Plan Badge */}
            {hasActivePlan && (
              <div className="absolute -top-2 -right-2">
                <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white text-[10px] px-1.5 py-0.5">
                  Plano Ativo
                </Badge>
              </div>
            )}
            
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                hasActivePlan ? "bg-emerald-500/10" : "bg-primary/10"
              )}>
                {service.is_package ? (
                  <Package className={cn("w-5 h-5", hasActivePlan ? "text-emerald-600" : "text-primary")} />
                ) : (
                  <Scissors className={cn("w-5 h-5", hasActivePlan ? "text-emerald-600" : "text-primary")} />
                )}
              </div>
              <span className={cn(
                "text-lg font-semibold",
                hasActivePlan ? "text-emerald-600" : "text-primary"
              )}>
                {formatPrice(service.price)}
              </span>
            </div>
            <p className="font-medium mb-1">{service.name}</p>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDuration(service.duration_minutes)}
            </p>
            
            {/* Credits remaining info */}
            {hasActivePlan && credit && (
              <div className="mt-2 flex items-center gap-1.5">
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-xs font-medium",
                    credit.remaining === -1 
                      ? "border-emerald-500 text-emerald-600" 
                      : credit.remaining > 0 
                        ? "border-emerald-500 text-emerald-600"
                        : "border-amber-500 text-amber-600"
                  )}
                >
                  {credit.remaining === -1 
                    ? "✓ Ilimitado" 
                    : credit.remaining > 0 
                      ? `${credit.remaining} restante${credit.remaining > 1 ? 's' : ''}`
                      : "Limite atingido"}
                </Badge>
              </div>
            )}
            
            {service.is_package && !hasActivePlan && (
              <Badge variant="secondary" className="mt-2 w-fit text-xs">
                Pacote
              </Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Step 3: Professional Selection
function Step3Professional({
  professionals,
  onProfessionalSelect,
  selectedProfessional,
  selectedDate,
  isProfessionalWorkingOnDay,
}: {
  professionals: StaffMember[];
  onProfessionalSelect: (professional: StaffMember) => void;
  selectedProfessional: StaffMember | null;
  selectedDate: string;
  isProfessionalWorkingOnDay: (userId: string, date: string) => boolean;
}) {
  if (professionals.length === 0) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
        <p className="text-muted-foreground">
          Nenhum profissional disponível para este serviço
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {professionals.map((professional) => {
        const worksToday = isProfessionalWorkingOnDay(professional.user_id, selectedDate);
        return (
          <button
            key={professional.user_id}
            onClick={() => onProfessionalSelect(professional)}
            className={cn(
              "flex flex-col items-center p-4 rounded-xl border transition-all",
              selectedProfessional?.user_id === professional.user_id
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:bg-muted/50 hover:border-primary/50"
            )}
          >
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-3">
              <User className="w-8 h-8 text-primary" />
            </div>
            <p className="font-medium text-center text-sm truncate w-full">
              {professional.name || "Sem nome"}
            </p>
            <p className="text-xs text-muted-foreground capitalize">
              {professional.role === "owner" ? "Proprietário" : "Funcionário"}
            </p>
            {!worksToday && (
              <Badge variant="secondary" className="mt-2 text-xs">
                Folga hoje
              </Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Step 4: Date & Time Selection
function Step4DateTime({
  selectedDate,
  setSelectedDate,
  selectedTime,
  onTimeSelect,
  availableSlots,
  slotsLoading,
  selectedProfessional,
  isProfessionalWorkingOnDay,
}: {
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  selectedTime: string | null;
  onTimeSelect: (time: string) => void;
  availableSlots: TimeSlot[];
  slotsLoading: boolean;
  selectedProfessional: StaffMember | null;
  isProfessionalWorkingOnDay: (userId: string, date: string) => boolean;
}) {
  const today = getTodayInBrasilia();
  const isWorking = selectedProfessional 
    ? isProfessionalWorkingOnDay(selectedProfessional.user_id, selectedDate)
    : false;

  return (
    <div className="space-y-6">
      {/* Date Selection */}
      <div>
        <label className="text-sm font-medium mb-2 block">Selecione a Data</label>
        <Input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          min={today}
          className="h-12"
        />
      </div>

      {/* Warning if professional doesn't work that day */}
      {selectedProfessional && !isWorking && (
        <div className="flex items-center gap-3 p-4 bg-destructive/10 rounded-xl text-destructive">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">O profissional não trabalha neste dia. Selecione outra data.</p>
        </div>
      )}

      {/* Time Slots */}
      {selectedProfessional && isWorking && (
        <div>
          <label className="text-sm font-medium mb-3 block">Horários Disponíveis</label>
          
          {slotsLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Carregando horários...
            </div>
          ) : availableSlots.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>Nenhum horário disponível nesta data</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-6 gap-2">
              {availableSlots.map((slot) => (
                <button
                  key={slot.time}
                  onClick={() => slot.available && onTimeSelect(slot.time)}
                  disabled={!slot.available}
                  title={slot.reason}
                  className={cn(
                    "p-3 text-sm font-medium rounded-lg border transition-all",
                    slot.available
                      ? selectedTime === slot.time
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:border-primary hover:bg-primary/5"
                      : "border-border/50 bg-muted/30 text-muted-foreground cursor-not-allowed"
                  )}
                >
                  {slot.time}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
