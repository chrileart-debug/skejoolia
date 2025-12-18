import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatPhoneMask } from "@/lib/phoneMask";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PublicClubSection } from "@/components/public/PublicClubSection";
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Check,
  Clock,
  Package,
  Phone,
  Mail,
  User,
  Scissors,
  Users,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  Crown,
} from "lucide-react";

// Types
interface Barbershop {
  id: string;
  name: string;
  logo_url: string | null;
  slug: string;
  phone: string | null;
  address: string | null;
}

interface Service {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number | null;
  image_url: string | null;
  is_package: boolean | null;
  category_id: string | null;
  is_active: boolean | null;
}

interface Category {
  id: string;
  name: string;
  display_order: number | null;
}

interface StaffMember {
  user_id: string;
  name: string | null;
  email: string | null;
}

interface StaffSchedule {
  user_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_working: boolean;
  break_start: string | null;
  break_end: string | null;
}

interface TimeSlot {
  time: string;
  available: boolean;
}

// Constants
const BRASILIA_TIMEZONE = "America/Sao_Paulo";

// Utility functions
const getTodayInBrasilia = (): string => {
  const now = new Date();
  return now.toLocaleDateString("en-CA", { timeZone: BRASILIA_TIMEZONE });
};

const formatPrice = (price: number): string => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(price);
};

const formatDuration = (minutes: number | null): string => {
  if (!minutes) return "";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}min`;
  if (hours > 0) return `${hours}h`;
  return `${mins}min`;
};

const formatDateDisplay = (dateStr: string): string => {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
};

const getDayOfWeek = (dateStr: string): number => {
  const date = new Date(dateStr + "T12:00:00");
  return date.getDay();
};

const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

const minutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
};

const PublicBooking = () => {
  const { slug } = useParams<{ slug: string }>();

  // Loading & error states
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Data states
  const [barbershop, setBarbershop] = useState<Barbershop | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [staffServices, setStaffServices] = useState<{ user_id: string; service_id: string }[]>([]);
  const [staffSchedules, setStaffSchedules] = useState<StaffSchedule[]>([]);
  const [existingAppointments, setExistingAppointments] = useState<any[]>([]);

  // Wizard states
  const [activeTab, setActiveTab] = useState<string>("agendar");
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedProfessional, setSelectedProfessional] = useState<StaffMember | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(getTodayInBrasilia());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  // Client form states
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");

  // Fetch barbershop and initial data
  useEffect(() => {
    const fetchBarbershopData = async () => {
      if (!slug) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      try {
        // Fetch barbershop by slug
        const { data: barbershopData, error: barbershopError } = await supabase
          .from("barbershops")
          .select("*")
          .eq("slug", slug)
          .eq("is_active", true)
          .single();

        if (barbershopError || !barbershopData) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        setBarbershop(barbershopData);

        // Fetch services, categories, staff in parallel
        const [servicesRes, categoriesRes, staffRes, staffServicesRes, staffSchedulesRes] = await Promise.all([
          supabase
            .from("services")
            .select("*")
            .eq("barbershop_id", barbershopData.id)
            .eq("is_active", true)
            .order("name"),
          supabase
            .from("categories")
            .select("*")
            .eq("barbershop_id", barbershopData.id)
            .eq("is_active", true)
            .order("display_order"),
          supabase
            .from("user_barbershop_roles")
            .select("user_id")
            .eq("barbershop_id", barbershopData.id)
            .eq("status", "active"),
          supabase
            .from("staff_services")
            .select("user_id, service_id")
            .eq("barbershop_id", barbershopData.id),
          supabase
            .from("staff_schedules")
            .select("*")
            .eq("barbershop_id", barbershopData.id),
        ]);

        if (servicesRes.data) setServices(servicesRes.data);
        if (categoriesRes.data) setCategories(categoriesRes.data);
        if (staffServicesRes.data) setStaffServices(staffServicesRes.data);
        if (staffSchedulesRes.data) setStaffSchedules(staffSchedulesRes.data);

        // Fetch staff names
        if (staffRes.data && staffRes.data.length > 0) {
          const userIds = staffRes.data.map((r) => r.user_id);
          const { data: settingsData } = await supabase
            .from("user_settings")
            .select("user_id, nome, email")
            .in("user_id", userIds);

          if (settingsData) {
            setStaffMembers(
              settingsData.map((s) => ({
                user_id: s.user_id,
                name: s.nome,
                email: s.email,
              }))
            );
          }
        }

        setLoading(false);
      } catch (error) {
        console.error("Error fetching barbershop:", error);
        setNotFound(true);
        setLoading(false);
      }
    };

    fetchBarbershopData();
  }, [slug]);

  // Fetch appointments when date changes
  useEffect(() => {
    const fetchAppointments = async () => {
      if (!barbershop || !selectedDate) return;

      const startOfDay = `${selectedDate}T00:00:00`;
      const endOfDay = `${selectedDate}T23:59:59`;

      const { data } = await supabase
        .from("agendamentos")
        .select("*")
        .eq("barbershop_id", barbershop.id)
        .gte("start_time", startOfDay)
        .lte("start_time", endOfDay);

      if (data) setExistingAppointments(data);
    };

    fetchAppointments();
  }, [barbershop, selectedDate]);

  // Get professionals for selected service
  const professionalsForService = useMemo(() => {
    if (!selectedService) return [];
    const linkedUserIds = staffServices
      .filter((ss) => ss.service_id === selectedService.id)
      .map((ss) => ss.user_id);
    return staffMembers.filter((sm) => linkedUserIds.includes(sm.user_id));
  }, [selectedService, staffServices, staffMembers]);

  // Check if professional is working on selected date
  const isProfessionalWorking = (userId: string): boolean => {
    const dayOfWeek = getDayOfWeek(selectedDate);
    const schedule = staffSchedules.find(
      (s) => s.user_id === userId && s.day_of_week === dayOfWeek
    );
    return schedule?.is_working ?? false;
  };

  // Get available time slots
  const availableTimeSlots = useMemo((): TimeSlot[] => {
    if (!selectedProfessional || !selectedDate || !selectedService) return [];

    const dayOfWeek = getDayOfWeek(selectedDate);
    const schedule = staffSchedules.find(
      (s) => s.user_id === selectedProfessional.user_id && s.day_of_week === dayOfWeek
    );

    if (!schedule || !schedule.is_working) return [];

    const slots: TimeSlot[] = [];
    const startMinutes = timeToMinutes(schedule.start_time);
    const endMinutes = timeToMinutes(schedule.end_time);
    const duration = selectedService.duration_minutes || 30;
    const slotInterval = 30;

    const breakStartMinutes = schedule.break_start ? timeToMinutes(schedule.break_start) : null;
    const breakEndMinutes = schedule.break_end ? timeToMinutes(schedule.break_end) : null;

    // Filter appointments for this professional
    const proAppointments = existingAppointments.filter(
      (apt) => apt.user_id === selectedProfessional.user_id
    );

    for (let time = startMinutes; time + duration <= endMinutes; time += slotInterval) {
      const slotTime = minutesToTime(time);
      const slotEndMinutes = time + duration;

      // Check break overlap
      if (breakStartMinutes !== null && breakEndMinutes !== null) {
        if (time < breakEndMinutes && slotEndMinutes > breakStartMinutes) {
          slots.push({ time: slotTime, available: false });
          continue;
        }
      }

      // Check existing appointments overlap
      let hasConflict = false;
      for (const apt of proAppointments) {
        const aptStart = new Date(apt.start_time);
        const aptEnd = apt.end_time ? new Date(apt.end_time) : new Date(aptStart.getTime() + 30 * 60000);
        const aptStartMinutes = aptStart.getHours() * 60 + aptStart.getMinutes();
        const aptEndMinutes = aptEnd.getHours() * 60 + aptEnd.getMinutes();

        if (time < aptEndMinutes && slotEndMinutes > aptStartMinutes) {
          hasConflict = true;
          break;
        }
      }

      // Check if slot is in the past
      const now = new Date();
      const slotDate = new Date(`${selectedDate}T${slotTime}:00`);
      const isInPast = slotDate < now;

      slots.push({ time: slotTime, available: !hasConflict && !isInPast });
    }

    return slots;
  }, [selectedProfessional, selectedDate, selectedService, staffSchedules, existingAppointments]);

  // Group services by category
  const servicesByCategory = useMemo(() => {
    const grouped: Record<string, Service[]> = {};
    const uncategorized: Service[] = [];

    services.forEach((service) => {
      if (service.category_id) {
        if (!grouped[service.category_id]) grouped[service.category_id] = [];
        grouped[service.category_id].push(service);
      } else {
        uncategorized.push(service);
      }
    });

    return { grouped, uncategorized };
  }, [services]);

  // Navigation
  const goToStep = (step: number) => setCurrentStep(step);

  const handleBack = () => {
    if (currentStep > 1) {
      if (currentStep === 2) setSelectedService(null);
      if (currentStep === 3) setSelectedProfessional(null);
      if (currentStep === 4) setSelectedTime(null);
      setCurrentStep(currentStep - 1);
    }
  };

  // Handlers
  const handleServiceSelect = (service: Service) => {
    setSelectedService(service);
    setSelectedProfessional(null);
    setSelectedTime(null);
    setCurrentStep(2);
  };

  const handleProfessionalSelect = (pro: StaffMember) => {
    if (!isProfessionalWorking(pro.user_id)) return;
    setSelectedProfessional(pro);
    setSelectedTime(null);
    setCurrentStep(3);
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setCurrentStep(4);
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      const dateStr = date.toLocaleDateString("en-CA", { timeZone: BRASILIA_TIMEZONE });
      setSelectedDate(dateStr);
      setSelectedTime(null);
    }
  };

  // Submit booking
  const handleSubmit = async () => {
    if (!clientName.trim()) {
      toast.error("Digite seu nome");
      return;
    }

    if (!clientPhone.trim() || clientPhone.replace(/\D/g, "").length < 10) {
      toast.error("Digite um telefone válido");
      return;
    }

    if (!barbershop || !selectedService || !selectedProfessional || !selectedTime) {
      toast.error("Dados incompletos");
      return;
    }

    setSubmitting(true);

    try {
      // Build start_time as ISO timestamp with Brasilia offset
      const startDateTime = `${selectedDate}T${selectedTime}:00-03:00`;

      // Call RPC function that handles client upsert + appointment creation atomically
      const { data, error } = await supabase.rpc("handle_public_booking", {
        p_barbershop_id: barbershop.id,
        p_nome: clientName.trim(),
        p_telefone: clientPhone,
        p_service_id: selectedService.id,
        p_start_time: startDateTime,
        p_user_id: selectedProfessional.user_id,
        p_email: clientEmail || null,
      });

      if (error) {
        console.error("RPC error:", error);
        if (error.message.includes("invalid_phone")) {
          toast.error("Telefone inválido");
        } else if (error.message.includes("invalid_name")) {
          toast.error("Nome é obrigatório");
        } else {
          toast.error("Erro ao realizar agendamento. Tente novamente.");
        }
        return;
      }

      setSuccess(true);
      toast.success("Agendamento realizado com sucesso!");
    } catch (error) {
      console.error("Booking error:", error);
      toast.error("Erro ao realizar agendamento. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleNewBooking = () => {
    setSuccess(false);
    setCurrentStep(1);
    setSelectedService(null);
    setSelectedProfessional(null);
    setSelectedTime(null);
    setClientName("");
    setClientPhone("");
    setClientEmail("");
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Skeleton className="h-20 w-20 rounded-full mx-auto" />
          <Skeleton className="h-6 w-48 mx-auto" />
          <Skeleton className="h-4 w-32 mx-auto" />
        </div>
      </div>
    );
  }

  // 404 state
  if (notFound) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto">
            <Scissors className="w-10 h-10 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Página não encontrada</h1>
          <p className="text-muted-foreground">
            O estabelecimento que você está procurando não existe ou não está disponível.
          </p>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-6 max-w-md w-full">
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mx-auto animate-scale-in">
            <CheckCircle2 className="w-12 h-12 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">Agendamento Confirmado!</h1>
            <p className="text-muted-foreground">
              Seu horário foi reservado com sucesso.
            </p>
          </div>

          <div className="bg-card rounded-xl border border-border p-6 text-left space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Scissors className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">{selectedService?.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatPrice(selectedService?.price || 0)} • {formatDuration(selectedService?.duration_minutes)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">{selectedProfessional?.name}</p>
                <p className="text-sm text-muted-foreground">Profissional</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <CalendarIcon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">{formatDateDisplay(selectedDate)}</p>
                <p className="text-sm text-muted-foreground">{selectedTime}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <Button onClick={handleNewBooking} className="w-full">
              <RefreshCw className="w-4 h-4 mr-2" />
              Fazer outro agendamento
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Step indicators
  const steps = [
    { num: 1, label: "Serviço", icon: Scissors },
    { num: 2, label: "Profissional", icon: Users },
    { num: 3, label: "Horário", icon: Clock },
    { num: 4, label: "Seus Dados", icon: User },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            {barbershop?.logo_url ? (
              <img
                src={barbershop.logo_url}
                alt={barbershop.name}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Scissors className="w-6 h-6 text-primary" />
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold text-foreground">{barbershop?.name}</h1>
              <p className="text-sm text-muted-foreground">Bem-vindo(a)!</p>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="border-b border-border bg-muted/30">
          <div className="max-w-2xl mx-auto px-4">
            <TabsList className="h-12 w-full justify-start bg-transparent p-0 gap-4">
              <TabsTrigger
                value="agendar"
                className="h-12 px-0 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none bg-transparent"
              >
                <CalendarIcon className="w-4 h-4 mr-2" />
                Agendar
              </TabsTrigger>
              <TabsTrigger
                value="clube"
                className="h-12 px-0 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none bg-transparent"
              >
                <Crown className="w-4 h-4 mr-2" />
                Clubes de Assinatura
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* Booking Tab */}
        <TabsContent value="agendar" className="mt-0">

      {/* Progress Steps */}
      <div className="bg-muted/30 border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {steps.map((step, idx) => (
              <div key={step.num} className="flex items-center">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all",
                    currentStep > step.num
                      ? "bg-primary text-primary-foreground"
                      : currentStep === step.num
                      ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {currentStep > step.num ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    step.num
                  )}
                </div>
                {idx < steps.length - 1 && (
                  <div
                    className={cn(
                      "w-12 sm:w-20 h-1 mx-1 rounded-full transition-all",
                      currentStep > step.num ? "bg-primary" : "bg-muted"
                    )}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2">
            {steps.map((step) => (
              <p
                key={step.num}
                className={cn(
                  "text-xs font-medium text-center w-16",
                  currentStep === step.num ? "text-primary" : "text-muted-foreground"
                )}
              >
                {step.label}
              </p>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Back button */}
        {currentStep > 1 && (
          <Button variant="ghost" size="sm" onClick={handleBack} className="mb-4 -ml-2">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        )}

        {/* Step 1: Services */}
        {currentStep === 1 && (
          <div className="animate-fade-in space-y-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">Escolha o serviço</h2>
              <p className="text-muted-foreground">Selecione o que você deseja fazer</p>
            </div>

            {categories.map((category) => {
              const categoryServices = servicesByCategory.grouped[category.id];
              if (!categoryServices?.length) return null;

              return (
                <div key={category.id} className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    {category.name}
                  </h3>
                  <div className="grid gap-3">
                    {categoryServices.map((service) => (
                      <button
                        key={service.id}
                        onClick={() => handleServiceSelect(service)}
                        className="w-full bg-card hover:bg-accent rounded-xl border border-border p-4 text-left transition-all hover:shadow-md group"
                      >
                        <div className="flex items-start gap-4">
                          {service.image_url ? (
                            <img
                              src={service.image_url}
                              alt={service.name}
                              className="w-16 h-16 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center">
                              {service.is_package ? (
                                <Package className="w-6 h-6 text-primary" />
                              ) : (
                                <Scissors className="w-6 h-6 text-primary" />
                              )}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
                                {service.name}
                              </p>
                              {service.is_package && (
                                <span className="px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded-full">
                                  Combo
                                </span>
                              )}
                            </div>
                            {service.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                {service.description}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-lg font-bold text-primary">
                                {formatPrice(service.price)}
                              </span>
                              {service.duration_minutes && (
                                <span className="text-sm text-muted-foreground flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatDuration(service.duration_minutes)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}

            {servicesByCategory.uncategorized.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Outros
                </h3>
                <div className="grid gap-3">
                  {servicesByCategory.uncategorized.map((service) => (
                    <button
                      key={service.id}
                      onClick={() => handleServiceSelect(service)}
                      className="w-full bg-card hover:bg-accent rounded-xl border border-border p-4 text-left transition-all hover:shadow-md group"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Scissors className="w-6 h-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
                            {service.name}
                          </p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-lg font-bold text-primary">
                              {formatPrice(service.price)}
                            </span>
                            {service.duration_minutes && (
                              <span className="text-sm text-muted-foreground flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDuration(service.duration_minutes)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Professionals */}
        {currentStep === 2 && (
          <div className="animate-fade-in space-y-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">Escolha o profissional</h2>
              <p className="text-muted-foreground">Quem você prefere para {selectedService?.name}?</p>
            </div>

            {professionalsForService.length === 0 ? (
              <div className="text-center py-12 bg-muted/50 rounded-xl">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhum profissional disponível para este serviço</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {professionalsForService.map((pro) => {
                  const isWorking = isProfessionalWorking(pro.user_id);
                  return (
                    <button
                      key={pro.user_id}
                      onClick={() => handleProfessionalSelect(pro)}
                      disabled={!isWorking}
                      className={cn(
                        "w-full bg-card rounded-xl border border-border p-4 text-left transition-all group",
                        isWorking
                          ? "hover:bg-accent hover:shadow-md"
                          : "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="w-7 h-7 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className={cn(
                            "font-semibold text-foreground transition-colors",
                            isWorking && "group-hover:text-primary"
                          )}>
                            {pro.name || "Profissional"}
                          </p>
                          {!isWorking && (
                            <p className="text-sm text-destructive">Não trabalha neste dia</p>
                          )}
                        </div>
                        {isWorking && (
                          <Sparkles className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Date & Time */}
        {currentStep === 3 && (
          <div className="animate-fade-in space-y-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">Escolha o horário</h2>
              <p className="text-muted-foreground">Selecione a data e horário disponível</p>
            </div>

            <div className="bg-card rounded-xl border border-border p-4">
              <Calendar
                mode="single"
                selected={new Date(selectedDate + "T12:00:00")}
                onSelect={handleDateSelect}
                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                className="rounded-md mx-auto"
              />
            </div>

            <div>
              <h3 className="font-semibold text-foreground mb-3">
                Horários disponíveis - {formatDateDisplay(selectedDate)}
              </h3>

              {availableTimeSlots.length === 0 ? (
                <div className="text-center py-8 bg-muted/50 rounded-xl">
                  <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhum horário disponível neste dia</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {availableTimeSlots.map((slot) => (
                    <button
                      key={slot.time}
                      onClick={() => slot.available && handleTimeSelect(slot.time)}
                      disabled={!slot.available}
                      className={cn(
                        "py-3 px-4 rounded-lg text-sm font-medium transition-all",
                        slot.available
                          ? "bg-card hover:bg-primary hover:text-primary-foreground border border-border"
                          : "bg-muted text-muted-foreground cursor-not-allowed line-through"
                      )}
                    >
                      {slot.time}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Client Details */}
        {currentStep === 4 && (
          <div className="animate-fade-in space-y-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">Seus dados</h2>
              <p className="text-muted-foreground">Preencha suas informações para confirmar</p>
            </div>

            {/* Summary */}
            <div className="bg-muted/50 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Scissors className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium text-foreground">{selectedService?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatPrice(selectedService?.price || 0)} • {formatDuration(selectedService?.duration_minutes)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-primary" />
                <p className="font-medium text-foreground">{selectedProfessional?.name}</p>
              </div>
              <div className="flex items-center gap-3">
                <CalendarIcon className="w-5 h-5 text-primary" />
                <p className="font-medium text-foreground">
                  {formatDateDisplay(selectedDate)} às {selectedTime}
                </p>
              </div>
            </div>

            {/* Form */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Nome completo *
                </Label>
                <Input
                  id="name"
                  placeholder="Digite seu nome"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  WhatsApp *
                </Label>
                <Input
                  id="phone"
                  placeholder="(00) 00000-0000"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(formatPhoneMask(e.target.value))}
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  E-mail (opcional)
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  className="h-12"
                />
              </div>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full h-12 text-lg"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                  Agendando...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5 mr-2" />
                  Confirmar Agendamento
                </>
              )}
            </Button>
          </div>
        )}
      </main>
        </TabsContent>

        {/* Club Tab */}
        <TabsContent value="clube" className="mt-0">
          <main className="max-w-2xl mx-auto px-4 py-6">
            {barbershop && (
              <PublicClubSection
                barbershopId={barbershop.id}
                barbershopName={barbershop.name}
              />
            )}
          </main>
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <footer className="border-t border-border mt-auto">
        <div className="max-w-2xl mx-auto px-4 py-4 text-center">
          <p className="text-xs text-muted-foreground">
            Agendamento online por{" "}
            <span className="font-semibold text-primary">Skejool</span>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default PublicBooking;