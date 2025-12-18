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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PublicClubSection } from "@/components/public/PublicClubSection";
import { ClientLoginModal } from "@/components/public/ClientLoginModal";
import { ClientPortal } from "@/components/public/ClientPortal";
import { ExistingAppointmentModal } from "@/components/public/ExistingAppointmentModal";
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
  Gift,
  Loader2,
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

interface ClientData {
  client_id: string;
  nome: string | null;
  telefone: string | null;
  email: string | null;
  total_cortes: number | null;
  faturamento_total: number | null;
  last_visit: string | null;
}

interface SubscriberPlanItem {
  service_id: string;
  quantity_limit: number | null;
  used_count: number;
}

interface ExistingAppointment {
  id_agendamento: string;
  start_time: string;
  end_time: string | null;
  status: string | null;
  nome_cliente: string | null;
  service_name?: string;
  professional_name?: string;
  user_id: string;
  service_id: string | null;
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

  // Client recognition states
  const [loggedInClient, setLoggedInClient] = useState<ClientData | null>(null);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [subscriberPlanItems, setSubscriberPlanItems] = useState<SubscriberPlanItem[]>([]);

  // Phone-first flow states
  const [clientPhone, setClientPhone] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [phoneLookupLoading, setPhoneLookupLoading] = useState(false);
  const [foundClient, setFoundClient] = useState<ClientData | null>(null);
  const [existingClientAppointment, setExistingClientAppointment] = useState<ExistingAppointment | null>(null);
  const [showExistingAppointmentModal, setShowExistingAppointmentModal] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleAppointmentId, setRescheduleAppointmentId] = useState<string | null>(null);

  // Wizard states
  const [activeTab, setActiveTab] = useState<string>("agendar");
  const [currentStep, setCurrentStep] = useState(0); // 0 = phone, 1 = service, 2 = professional, 3 = time, 4 = confirm
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedProfessional, setSelectedProfessional] = useState<StaffMember | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(getTodayInBrasilia());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  // Fetch barbershop and initial data
  useEffect(() => {
    const fetchBarbershopData = async () => {
      if (!slug) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      try {
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

  // Fetch subscriber plan items when client logs in
  useEffect(() => {
    const fetchSubscriberData = async () => {
      if (!loggedInClient || !barbershop) {
        setSubscriberPlanItems([]);
        return;
      }

      try {
        const { data: subData } = await supabase
          .from("client_club_subscriptions")
          .select("id, plan_id")
          .eq("client_id", loggedInClient.client_id)
          .eq("barbershop_id", barbershop.id)
          .eq("status", "active")
          .single();

        if (!subData) {
          setSubscriberPlanItems([]);
          return;
        }

        const { data: itemsData } = await supabase
          .from("barber_plan_items")
          .select("service_id, quantity_limit")
          .eq("plan_id", subData.plan_id);

        if (!itemsData) {
          setSubscriberPlanItems([]);
          return;
        }

        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { data: usageData } = await supabase
          .from("client_subscription_usage")
          .select("service_id")
          .eq("subscription_id", subData.id)
          .gte("used_at", startOfMonth.toISOString());

        const usageMap: Record<string, number> = {};
        if (usageData) {
          usageData.forEach((u) => {
            usageMap[u.service_id] = (usageMap[u.service_id] || 0) + 1;
          });
        }

        setSubscriberPlanItems(
          itemsData.map((item) => ({
            service_id: item.service_id,
            quantity_limit: item.quantity_limit,
            used_count: usageMap[item.service_id] || 0,
          }))
        );
      } catch (error) {
        console.error("Error fetching subscriber data:", error);
        setSubscriberPlanItems([]);
      }
    };

    fetchSubscriberData();
  }, [loggedInClient, barbershop]);

  // Pre-fill client data when logged in from Minha Área
  useEffect(() => {
    if (loggedInClient) {
      setClientName(loggedInClient.nome || "");
      setClientPhone(loggedInClient.telefone ? formatPhoneMask(loggedInClient.telefone) : "");
      setClientEmail(loggedInClient.email || "");
      setFoundClient(loggedInClient);
      // Skip phone step if already logged in
      if (currentStep === 0) {
        checkExistingAppointmentAndProceed(loggedInClient.client_id);
      }
    }
  }, [loggedInClient]);

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

  // Check for existing appointment and proceed (used when client is already logged in)
  const checkExistingAppointmentAndProceed = async (clientId: string) => {
    if (!barbershop) return;

    const cleanPhone = normalizePhone(loggedInClient?.telefone || clientPhone);
    
    try {
      // Use DB function to check for active appointment
      const { data: aptData } = await supabase.rpc(
        "get_active_appointment_for_client_phone",
        {
          p_barbershop_id: barbershop.id,
          p_client_id: clientId,
          p_phone: cleanPhone,
        }
      );

      if (aptData && aptData.length > 0) {
        const apt = aptData[0];
        setExistingClientAppointment({
          id_agendamento: apt.id_agendamento,
          start_time: apt.start_time,
          end_time: apt.end_time,
          status: apt.status,
          nome_cliente: apt.nome_cliente,
          service_id: apt.service_id,
          user_id: apt.user_id,
          service_name: apt.service_name,
          professional_name: apt.professional_name,
        });
        setShowExistingAppointmentModal(true);
      } else {
        // No existing appointment, proceed to service selection
        setCurrentStep(1);
      }
    } catch (error) {
      console.error("Error checking existing appointments:", error);
      setCurrentStep(1);
    }
  };

  // Normalize phone - strip all non-numeric characters
  const normalizePhone = (phone: string): string => phone.replace(/\D/g, "");

  // Phone lookup with existing appointment check using database RPC
  const handlePhoneLookup = async () => {
    if (!barbershop) return;
    
    const cleanPhone = normalizePhone(clientPhone);
    if (cleanPhone.length < 10) {
      toast.error("Digite um telefone válido");
      return;
    }

    setPhoneLookupLoading(true);
    try {
      // Use robust DB function to find client by phone (handles all formats)
      const { data: clientData, error: lookupError } = await supabase.rpc(
        "find_client_by_phone",
        {
          p_barbershop_id: barbershop.id,
          p_phone: cleanPhone,
        }
      );

      if (lookupError) {
        console.error("Phone lookup error:", lookupError);
        setFoundClient(null);
        setCurrentStep(1);
        return;
      }

      const matchedClient = clientData && clientData.length > 0 ? clientData[0] : null;

      if (matchedClient) {
        // Found existing client - store in state
        setFoundClient(matchedClient as ClientData);
        setClientName(matchedClient.nome || "");
        setClientEmail(matchedClient.email || "");
        
        // Check for existing active appointment using DB function
        const { data: aptData } = await supabase.rpc(
          "get_active_appointment_for_client_phone",
          {
            p_barbershop_id: barbershop.id,
            p_client_id: matchedClient.client_id,
            p_phone: cleanPhone,
          }
        );

        if (aptData && aptData.length > 0) {
          const apt = aptData[0];
          setExistingClientAppointment({
            id_agendamento: apt.id_agendamento,
            start_time: apt.start_time,
            end_time: apt.end_time,
            status: apt.status,
            nome_cliente: apt.nome_cliente,
            service_id: apt.service_id,
            user_id: apt.user_id,
            service_name: apt.service_name,
            professional_name: apt.professional_name,
          });
          setShowExistingAppointmentModal(true);
        } else {
          // No active appointment, proceed to service selection
          setCurrentStep(1);
        }
      } else {
        // New client - proceed to service selection
        setFoundClient(null);
        setCurrentStep(1);
      }
    } catch (error) {
      console.error("Error looking up phone:", error);
      setFoundClient(null);
      setCurrentStep(1);
    } finally {
      setPhoneLookupLoading(false);
    }
  };

  // Handle reschedule
  const handleReschedule = (appointmentId: string) => {
    setIsRescheduling(true);
    setRescheduleAppointmentId(appointmentId);
    // Skip to service step (keep same service if possible) or just time selection
    setCurrentStep(1);
  };

  // Handle appointment cancelled
  const handleAppointmentCancelled = () => {
    setExistingClientAppointment(null);
    setCurrentStep(1);
  };

  // Check if service is included in subscriber plan with remaining credits
  const isServiceIncludedInPlan = (serviceId: string): { included: boolean; hasCredits: boolean } => {
    const planItem = subscriberPlanItems.find((item) => item.service_id === serviceId);
    if (!planItem) return { included: false, hasCredits: false };
    
    const isUnlimited = planItem.quantity_limit === 0 || planItem.quantity_limit === null;
    const hasCredits = isUnlimited || planItem.used_count < (planItem.quantity_limit || 0);
    
    return { included: true, hasCredits };
  };

  // Get display price for service
  const getDisplayPrice = (service: Service): { price: string; isIncluded: boolean } => {
    const { included, hasCredits } = isServiceIncludedInPlan(service.id);
    if (included && hasCredits) {
      return { price: "R$ 0,00", isIncluded: true };
    }
    return { price: formatPrice(service.price), isIncluded: false };
  };

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

    const proAppointments = existingAppointments.filter(
      (apt) => apt.user_id === selectedProfessional.user_id
    );

    for (let time = startMinutes; time + duration <= endMinutes; time += slotInterval) {
      const slotTime = minutesToTime(time);
      const slotEndMinutes = time + duration;

      if (breakStartMinutes !== null && breakEndMinutes !== null) {
        if (time < breakEndMinutes && slotEndMinutes > breakStartMinutes) {
          slots.push({ time: slotTime, available: false });
          continue;
        }
      }

      let hasConflict = false;
      for (const apt of proAppointments) {
        // Skip the appointment being rescheduled
        if (isRescheduling && apt.id_agendamento === rescheduleAppointmentId) continue;
        
        const aptStart = new Date(apt.start_time);
        const aptEnd = apt.end_time ? new Date(apt.end_time) : new Date(aptStart.getTime() + 30 * 60000);
        const aptStartMinutes = aptStart.getHours() * 60 + aptStart.getMinutes();
        const aptEndMinutes = aptEnd.getHours() * 60 + aptEnd.getMinutes();

        if (time < aptEndMinutes && slotEndMinutes > aptStartMinutes) {
          hasConflict = true;
          break;
        }
      }

      const now = new Date();
      const slotDate = new Date(`${selectedDate}T${slotTime}:00`);
      const isInPast = slotDate < now;

      slots.push({ time: slotTime, available: !hasConflict && !isInPast });
    }

    return slots;
  }, [selectedProfessional, selectedDate, selectedService, staffSchedules, existingAppointments, isRescheduling, rescheduleAppointmentId]);

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
  const handleBack = () => {
    if (currentStep > 0) {
      if (currentStep === 1) {
        setSelectedService(null);
        // Go back to phone if not logged in
        if (!loggedInClient) {
          setCurrentStep(0);
          return;
        }
      }
      if (currentStep === 2) setSelectedProfessional(null);
      if (currentStep === 3) setSelectedTime(null);
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
    // If client is known, go directly to confirmation. Otherwise, show form
    if (foundClient || loggedInClient) {
      setCurrentStep(4);
    } else {
      setCurrentStep(4);
    }
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
    const effectiveClient = foundClient || loggedInClient;
    
    // Validate required fields for new clients
    if (!effectiveClient) {
      if (!clientName.trim()) {
        toast.error("Digite seu nome");
        return;
      }
    }

    if (!barbershop || !selectedService || !selectedProfessional || !selectedTime) {
      toast.error("Dados incompletos");
      return;
    }

    setSubmitting(true);

    try {
      const startDateTime = `${selectedDate}T${selectedTime}:00-03:00`;
      const effectiveName = effectiveClient?.nome || clientName.trim();
      const effectivePhone = clientPhone.replace(/\D/g, "");

      if (isRescheduling && rescheduleAppointmentId) {
        // Use secure reschedule RPC (validates phone ownership)
        const { error } = await supabase.rpc("reschedule_public_appointment", {
          p_barbershop_id: barbershop.id,
          p_appointment_id: rescheduleAppointmentId,
          p_phone: effectivePhone,
          p_service_id: selectedService.id,
          p_user_id: selectedProfessional.user_id,
          p_start_time: startDateTime,
        });

        if (error) {
          console.error("Reschedule error:", error);
          if (error.message.includes("not_allowed")) {
            toast.error("Você não tem permissão para remarcar este agendamento.");
          } else {
            toast.error("Erro ao remarcar. Tente novamente.");
          }
          return;
        }

        setSuccess(true);
        toast.success("Agendamento remarcado com sucesso!");
      } else {
        // Create new appointment
        const { data, error } = await supabase.rpc("handle_public_booking", {
          p_barbershop_id: barbershop.id,
          p_nome: effectiveName,
          p_telefone: effectivePhone, // Already normalized, store as digits only
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
          } else if (error.message.includes("existing_active_appointment")) {
            toast.error("Você já possui um agendamento ativo. Cancele ou remarque antes de criar um novo.");
          } else {
            toast.error("Erro ao realizar agendamento. Tente novamente.");
          }
          return;
        }

        setSuccess(true);
        toast.success("Agendamento realizado com sucesso!");
      }
    } catch (error) {
      console.error("Booking error:", error);
      toast.error("Erro ao realizar agendamento. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleNewBooking = () => {
    setSuccess(false);
    setCurrentStep(loggedInClient ? 1 : 0);
    setSelectedService(null);
    setSelectedProfessional(null);
    setSelectedTime(null);
    setIsRescheduling(false);
    setRescheduleAppointmentId(null);
    if (!loggedInClient) {
      setClientName("");
      setClientPhone("");
      setClientEmail("");
      setFoundClient(null);
    }
  };

  const handleClientLogin = (client: ClientData) => {
    setLoggedInClient(client);
    setActiveTab("minha-area");
  };

  const handleClientLogout = () => {
    setLoggedInClient(null);
    setSubscriberPlanItems([]);
    setClientName("");
    setClientPhone("");
    setClientEmail("");
    setFoundClient(null);
    setCurrentStep(0);
    setActiveTab("agendar");
  };

  const handleNavigateToBooking = () => {
    setActiveTab("agendar");
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
            <h1 className="text-2xl font-bold text-foreground">
              {isRescheduling ? "Agendamento Remarcado!" : "Agendamento Confirmado!"}
            </h1>
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

  // Step indicators for booking flow
  const getSteps = () => {
    const baseSteps = [
      { num: 0, label: "WhatsApp", icon: Phone },
      { num: 1, label: "Serviço", icon: Scissors },
      { num: 2, label: "Profissional", icon: Users },
      { num: 3, label: "Horário", icon: Clock },
      { num: 4, label: "Confirmar", icon: Check },
    ];
    
    // Skip phone step if logged in
    if (loggedInClient) {
      return baseSteps.slice(1);
    }
    return baseSteps;
  };

  const steps = getSteps();
  const effectiveStep = loggedInClient ? currentStep - 1 : currentStep;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
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
                <p className="text-sm text-muted-foreground">
                  {loggedInClient ? `Olá, ${loggedInClient.nome || "Cliente"}!` : "Bem-vindo(a)!"}
                </p>
              </div>
            </div>
            {!loggedInClient && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLoginModalOpen(true)}
                className="gap-2"
              >
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">Minha Área</span>
              </Button>
            )}
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
                Clubes
              </TabsTrigger>
              {loggedInClient && (
                <TabsTrigger
                  value="minha-area"
                  className="h-12 px-0 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none bg-transparent"
                >
                  <User className="w-4 h-4 mr-2" />
                  Minha Área
                </TabsTrigger>
              )}
            </TabsList>
          </div>
        </div>

        {/* Booking Tab */}
        <TabsContent value="agendar" className="mt-0">
          {/* Progress Steps */}
          {currentStep > 0 && (
            <div className="bg-muted/30 border-b border-border">
              <div className="max-w-2xl mx-auto px-4 py-4">
                <div className="flex items-center justify-between">
                  {steps.slice(loggedInClient ? 0 : 1).map((step, idx) => (
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
                          idx + 1
                        )}
                      </div>
                      {idx < steps.slice(loggedInClient ? 0 : 1).length - 1 && (
                        <div
                          className={cn(
                            "w-8 sm:w-16 h-1 mx-1 rounded-full transition-all",
                            currentStep > step.num ? "bg-primary" : "bg-muted"
                          )}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Main Content */}
          <main className="max-w-2xl mx-auto px-4 py-6">
            {/* Back button */}
            {currentStep > (loggedInClient ? 1 : 0) && (
              <Button variant="ghost" size="sm" onClick={handleBack} className="mb-4 -ml-2">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
            )}

            {/* Step 0: Phone Input */}
            {currentStep === 0 && !loggedInClient && (
              <div className="animate-fade-in space-y-6">
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Phone className="w-8 h-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold text-foreground">Qual seu WhatsApp?</h2>
                  <p className="text-muted-foreground">
                    Digite seu número para começar
                  </p>
                </div>

                <div className="space-y-4 max-w-sm mx-auto">
                  <div className="space-y-2">
                    <Label htmlFor="phone-start">WhatsApp</Label>
                    <Input
                      id="phone-start"
                      type="tel"
                      placeholder="(00) 00000-0000"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(formatPhoneMask(e.target.value))}
                      className="h-14 text-center text-lg"
                      autoFocus
                    />
                  </div>

                  <Button
                    onClick={handlePhoneLookup}
                    disabled={phoneLookupLoading || clientPhone.replace(/\D/g, "").length < 10}
                    className="w-full h-12"
                  >
                    {phoneLookupLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Verificando...
                      </>
                    ) : (
                      <>
                        Continuar
                        <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Step 1: Services */}
            {currentStep === 1 && (
              <div className="animate-fade-in space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-foreground">Escolha o serviço</h2>
                  <p className="text-muted-foreground">
                    {foundClient ? `Olá, ${foundClient.nome}! ` : ""}Selecione o que você deseja fazer
                  </p>
                </div>

                {/* Welcome back message */}
                {foundClient && (
                  <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Bem-vindo de volta!</p>
                      <p className="text-sm text-muted-foreground">Bom te ver novamente, {foundClient.nome}.</p>
                    </div>
                  </div>
                )}

                {categories.map((category) => {
                  const categoryServices = servicesByCategory.grouped[category.id];
                  if (!categoryServices?.length) return null;

                  return (
                    <div key={category.id} className="space-y-3">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                        {category.name}
                      </h3>
                      <div className="grid gap-3">
                        {categoryServices.map((service) => {
                          const { price: displayPrice, isIncluded } = getDisplayPrice(service);
                          return (
                            <button
                              key={service.id}
                              onClick={() => handleServiceSelect(service)}
                              className={cn(
                                "w-full bg-card hover:bg-accent rounded-xl border p-4 text-left transition-all hover:shadow-md group",
                                isIncluded ? "border-success/50 bg-success/5" : "border-border"
                              )}
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
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
                                      {service.name}
                                    </p>
                                    {service.is_package && (
                                      <span className="px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded-full">
                                        Combo
                                      </span>
                                    )}
                                    {isIncluded && (
                                      <span className="px-2 py-0.5 text-xs font-medium bg-success/10 text-success rounded-full flex items-center gap-1">
                                        <Gift className="w-3 h-3" />
                                        Incluso no Plano
                                      </span>
                                    )}
                                  </div>
                                  {service.description && (
                                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                      {service.description}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-3 mt-2">
                                    <span className={cn(
                                      "text-lg font-bold",
                                      isIncluded ? "text-success" : "text-primary"
                                    )}>
                                      {displayPrice}
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
                          );
                        })}
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
                      {servicesByCategory.uncategorized.map((service) => {
                        const { price: displayPrice, isIncluded } = getDisplayPrice(service);
                        return (
                          <button
                            key={service.id}
                            onClick={() => handleServiceSelect(service)}
                            className={cn(
                              "w-full bg-card hover:bg-accent rounded-xl border p-4 text-left transition-all hover:shadow-md group",
                              isIncluded ? "border-success/50 bg-success/5" : "border-border"
                            )}
                          >
                            <div className="flex items-start gap-4">
                              <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Scissors className="w-6 h-6 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
                                    {service.name}
                                  </p>
                                  {isIncluded && (
                                    <span className="px-2 py-0.5 text-xs font-medium bg-success/10 text-success rounded-full flex items-center gap-1">
                                      <Gift className="w-3 h-3" />
                                      Incluso
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 mt-2">
                                  <span className={cn("text-lg font-bold", isIncluded ? "text-success" : "text-primary")}>
                                    {displayPrice}
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
                        );
                      })}
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

            {/* Step 4: Confirmation */}
            {currentStep === 4 && (
              <div className="animate-fade-in space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-foreground">
                    {isRescheduling ? "Confirmar Remarcação" : "Confirmar Agendamento"}
                  </h2>
                  <p className="text-muted-foreground">
                    {foundClient || loggedInClient 
                      ? "Revise os detalhes e confirme" 
                      : "Preencha seus dados para finalizar"}
                  </p>
                </div>

                {/* Welcome Back Message for known clients */}
                {(foundClient || loggedInClient) && (
                  <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">
                        {(foundClient?.nome || loggedInClient?.nome)}, tudo pronto!
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Você está identificado(a). Só confirmar abaixo.
                      </p>
                    </div>
                  </div>
                )}

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

                {/* Form - Only for NEW clients */}
                {!foundClient && !loggedInClient && (
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
                )}

                <Button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full h-12 text-lg"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                      {isRescheduling ? "Remarcando..." : "Agendando..."}
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5 mr-2" />
                      {isRescheduling ? "Confirmar Remarcação" : "Confirmar Agendamento"}
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
                loggedInClient={loggedInClient}
              />
            )}
          </main>
        </TabsContent>

        {/* Minha Área Tab */}
        {loggedInClient && (
          <TabsContent value="minha-area" className="mt-0">
            <main className="max-w-2xl mx-auto px-4 py-6">
              {barbershop && (
                <ClientPortal
                  client={loggedInClient}
                  barbershopId={barbershop.id}
                  barbershopName={barbershop.name}
                  onLogout={handleClientLogout}
                  onNavigateToBooking={handleNavigateToBooking}
                />
              )}
            </main>
          </TabsContent>
        )}
      </Tabs>

      {/* Client Login Modal */}
      {barbershop && (
        <ClientLoginModal
          open={loginModalOpen}
          onOpenChange={setLoginModalOpen}
          barbershopId={barbershop.id}
          onClientFound={handleClientLogin}
        />
      )}

      {/* Existing Appointment Modal */}
      <ExistingAppointmentModal
        open={showExistingAppointmentModal}
        onOpenChange={setShowExistingAppointmentModal}
        appointment={existingClientAppointment}
        barbershopId={barbershop?.id || ""}
        clientPhone={clientPhone}
        onReschedule={handleReschedule}
        onCancelled={handleAppointmentCancelled}
      />

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
