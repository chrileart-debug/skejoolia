import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBarbershop } from "@/hooks/useBarbershop";

export interface ServiceWithDetails {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
  is_package: boolean;
  category_id: string | null;
}

export interface StaffMember {
  user_id: string;
  name: string | null;
  role: "owner" | "staff";
}

export interface StaffSchedule {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_working: boolean;
  break_start: string | null;
  break_end: string | null;
}

export interface TimeSlot {
  time: string;
  available: boolean;
  reason?: string;
}

const BRASILIA_TIMEZONE = 'America/Sao_Paulo';

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
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
};

const getCurrentMinutesInBrasilia = (): number => {
  const now = new Date();
  const hours = parseInt(now.toLocaleString("en-US", { hour: "2-digit", hour12: false, timeZone: BRASILIA_TIMEZONE }));
  const minutes = parseInt(now.toLocaleString("en-US", { minute: "2-digit", timeZone: BRASILIA_TIMEZONE }));
  return hours * 60 + minutes;
};

const getTodayInBrasilia = (): string => {
  const now = new Date();
  const year = now.toLocaleString("en-CA", { year: "numeric", timeZone: BRASILIA_TIMEZONE });
  const month = now.toLocaleString("en-CA", { month: "2-digit", timeZone: BRASILIA_TIMEZONE });
  const day = now.toLocaleString("en-CA", { day: "2-digit", timeZone: BRASILIA_TIMEZONE });
  return `${year}-${month}-${day}`;
};

export function useSmartBooking() {
  const { barbershop } = useBarbershop();
  const [services, setServices] = useState<ServiceWithDetails[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [staffServices, setStaffServices] = useState<{ user_id: string; service_id: string }[]>([]);
  const [staffSchedules, setStaffSchedules] = useState<Map<string, StaffSchedule[]>>(new Map());
  const [existingAppointments, setExistingAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch all services
  const fetchServices = async () => {
    if (!barbershop?.id) return;

    const { data, error } = await supabase
      .from("services")
      .select("id, name, price, duration_minutes, is_package, category_id")
      .eq("barbershop_id", barbershop.id)
      .eq("is_active", true)
      .order("name");

    if (!error && data) {
      setServices(data.map(s => ({
        ...s,
        duration_minutes: s.duration_minutes || 30,
        price: Number(s.price) || 0,
        is_package: s.is_package || false
      })));
    }
  };

  // Fetch all staff members who are service providers
  const fetchStaffMembers = async () => {
    if (!barbershop?.id) return;

    const { data, error } = await supabase.rpc("get_barbershop_team", {
      p_barbershop_id: barbershop.id
    });

    if (!error && data) {
      // Only include active members who are service providers
      // First get the is_service_provider status from user_barbershop_roles
      const { data: rolesData } = await supabase
        .from("user_barbershop_roles")
        .select("user_id, is_service_provider")
        .eq("barbershop_id", barbershop.id)
        .eq("status", "active")
        .eq("is_service_provider", true);

      const serviceProviderIds = new Set(rolesData?.map(r => r.user_id) || []);

      const activeMembers = data
        .filter((m: any) => m.status === "active" && serviceProviderIds.has(m.user_id))
        .map((m: any) => ({
          user_id: m.user_id,
          name: m.name,
          role: m.role as "owner" | "staff"
        }));
      setStaffMembers(activeMembers);
    }
  };

  // Fetch staff-service relationships
  const fetchStaffServices = async () => {
    if (!barbershop?.id) return;

    const { data, error } = await supabase
      .from("staff_services")
      .select("user_id, service_id")
      .eq("barbershop_id", barbershop.id);

    if (!error && data) {
      setStaffServices(data);
    }
  };

  // Fetch all staff schedules
  const fetchStaffSchedules = async () => {
    if (!barbershop?.id) return;

    const { data, error } = await supabase
      .from("staff_schedules")
      .select("user_id, day_of_week, start_time, end_time, is_working, break_start, break_end")
      .eq("barbershop_id", barbershop.id);

    if (!error && data) {
      const scheduleMap = new Map<string, StaffSchedule[]>();
      data.forEach((schedule: any) => {
        const existing = scheduleMap.get(schedule.user_id) || [];
        existing.push({
          day_of_week: schedule.day_of_week,
          start_time: schedule.start_time,
          end_time: schedule.end_time,
          is_working: schedule.is_working,
          break_start: schedule.break_start,
          break_end: schedule.break_end
        });
        scheduleMap.set(schedule.user_id, existing);
      });
      setStaffSchedules(scheduleMap);
    }
  };

  // Fetch existing appointments for conflict detection
  const fetchAppointmentsForDate = async (dateStr: string, professionalId?: string) => {
    if (!barbershop?.id) return;

    const startOfDay = `${dateStr}T00:00:00-03:00`;
    const endOfDay = `${dateStr}T23:59:59-03:00`;

    let query = supabase
      .from("agendamentos")
      .select("*")
      .eq("barbershop_id", barbershop.id)
      .gte("start_time", startOfDay)
      .lte("start_time", endOfDay)
      .neq("status", "cancelled");

    if (professionalId) {
      query = query.eq("user_id", professionalId);
    }

    const { data, error } = await query;

    if (!error && data) {
      setExistingAppointments(data);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      if (!barbershop?.id) return;
      setLoading(true);
      await Promise.all([
        fetchServices(),
        fetchStaffMembers(),
        fetchStaffServices(),
        fetchStaffSchedules()
      ]);
      setLoading(false);
    };
    loadData();
  }, [barbershop?.id]);

  // Get professionals who can perform a specific service
  const getProfessionalsForService = (serviceId: string | null): StaffMember[] => {
    if (!serviceId) return staffMembers;

    // Find staff who have this service linked
    const staffWithService = staffServices
      .filter(ss => ss.service_id === serviceId)
      .map(ss => ss.user_id);

    // If no staff has this service linked, return all staff (default behavior)
    if (staffWithService.length === 0) return staffMembers;

    return staffMembers.filter(staff => staffWithService.includes(staff.user_id));
  };

  // Check if a professional works on a specific day
  const isProfessionalWorkingOnDay = (professionalId: string, dateStr: string): boolean => {
    const dayOfWeek = getDayOfWeek(dateStr);
    const schedules = staffSchedules.get(professionalId);
    
    if (!schedules || schedules.length === 0) {
      // No schedule defined - assume available (default behavior for new staff)
      return true;
    }

    const daySchedule = schedules.find(s => s.day_of_week === dayOfWeek);
    return daySchedule?.is_working ?? false;
  };

  // Get working hours for a professional on a specific day
  const getWorkingHours = (professionalId: string, dateStr: string): { start: string; end: string; breakStart?: string; breakEnd?: string } | null => {
    const dayOfWeek = getDayOfWeek(dateStr);
    const schedules = staffSchedules.get(professionalId);
    
    if (!schedules || schedules.length === 0) {
      // Default working hours if no schedule defined
      return { start: "09:00", end: "18:00" };
    }

    const daySchedule = schedules.find(s => s.day_of_week === dayOfWeek);
    
    if (!daySchedule?.is_working) return null;

    return {
      start: daySchedule.start_time,
      end: daySchedule.end_time,
      breakStart: daySchedule.break_start || undefined,
      breakEnd: daySchedule.break_end || undefined
    };
  };

  // Generate available time slots for a professional on a date
  const getAvailableTimeSlots = (
    professionalId: string,
    dateStr: string,
    durationMinutes: number,
    slotInterval?: number
  ): TimeSlot[] => {
    const workingHours = getWorkingHours(professionalId, dateStr);
    
    if (!workingHours) {
      return [];
    }

    const slots: TimeSlot[] = [];
    const startMinutes = timeToMinutes(workingHours.start);
    const endMinutes = timeToMinutes(workingHours.end);
    const breakStartMinutes = workingHours.breakStart ? timeToMinutes(workingHours.breakStart) : null;
    const breakEndMinutes = workingHours.breakEnd ? timeToMinutes(workingHours.breakEnd) : null;

    // Get appointments for this professional on this date
    const dayAppointments = existingAppointments.filter(apt => apt.user_id === professionalId);

    // Use service duration as default interval (same logic as PublicBooking)
    const interval = slotInterval ?? Math.max(1, durationMinutes);

    // Check if date is today to filter past slots
    const isToday = dateStr === getTodayInBrasilia();
    const currentMinutes = isToday ? getCurrentMinutesInBrasilia() : 0;

    for (let minutes = startMinutes; minutes + durationMinutes <= endMinutes; minutes += interval) {
      const slotStart = minutesToTime(minutes);
      const slotEnd = minutes + durationMinutes;

      // Check if slot is in the past (only for today)
      if (isToday && minutes <= currentMinutes) {
        slots.push({ time: slotStart, available: false, reason: "Horário passado" });
        continue;
      }

      // Check if slot is during break
      if (breakStartMinutes !== null && breakEndMinutes !== null) {
        if (minutes < breakEndMinutes && slotEnd > breakStartMinutes) {
          slots.push({ time: slotStart, available: false, reason: "Horário de intervalo" });
          continue;
        }
      }

      // Check for conflicts with existing appointments
      const hasConflict = dayAppointments.some(apt => {
        const aptStart = new Date(apt.start_time);
        const aptEnd = apt.end_time ? new Date(apt.end_time) : new Date(aptStart.getTime() + 60 * 60 * 1000);
        
        const aptStartMinutes = aptStart.getHours() * 60 + aptStart.getMinutes();
        const aptEndMinutes = aptEnd.getHours() * 60 + aptEnd.getMinutes();

        // Check overlap
        return minutes < aptEndMinutes && slotEnd > aptStartMinutes;
      });

      if (hasConflict) {
        slots.push({ time: slotStart, available: false, reason: "Horário ocupado" });
      } else {
        slots.push({ time: slotStart, available: true });
      }
    }

    return slots;
  };

  // Calculate end time based on start time and service duration
  const calculateEndTime = (startTime: string, durationMinutes: number): string => {
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = startMinutes + durationMinutes;
    return minutesToTime(endMinutes);
  };

  // Check if a specific time slot is available
  const isTimeSlotAvailable = (
    professionalId: string,
    dateStr: string,
    startTime: string,
    durationMinutes: number
  ): { available: boolean; reason?: string } => {
    const workingHours = getWorkingHours(professionalId, dateStr);
    
    if (!workingHours) {
      return { available: false, reason: "Profissional não trabalha neste dia" };
    }

    const slotStart = timeToMinutes(startTime);
    const slotEnd = slotStart + durationMinutes;
    const workStart = timeToMinutes(workingHours.start);
    const workEnd = timeToMinutes(workingHours.end);

    // Check if within working hours
    if (slotStart < workStart || slotEnd > workEnd) {
      return { available: false, reason: "Fora do horário de trabalho" };
    }

    // Check break time
    if (workingHours.breakStart && workingHours.breakEnd) {
      const breakStart = timeToMinutes(workingHours.breakStart);
      const breakEnd = timeToMinutes(workingHours.breakEnd);
      if (slotStart < breakEnd && slotEnd > breakStart) {
        return { available: false, reason: "Horário de intervalo" };
      }
    }

    // Check conflicts with existing appointments
    const dayAppointments = existingAppointments.filter(apt => apt.user_id === professionalId);
    const hasConflict = dayAppointments.some(apt => {
      const aptStart = new Date(apt.start_time);
      const aptEnd = apt.end_time ? new Date(apt.end_time) : new Date(aptStart.getTime() + 60 * 60 * 1000);
      
      const aptStartMinutes = aptStart.getHours() * 60 + aptStart.getMinutes();
      const aptEndMinutes = aptEnd.getHours() * 60 + aptEnd.getMinutes();

      return slotStart < aptEndMinutes && slotEnd > aptStartMinutes;
    });

    if (hasConflict) {
      return { available: false, reason: "Conflito com outro agendamento" };
    }

    return { available: true };
  };

  return {
    services,
    staffMembers,
    loading,
    getProfessionalsForService,
    isProfessionalWorkingOnDay,
    getWorkingHours,
    getAvailableTimeSlots,
    calculateEndTime,
    isTimeSlotAvailable,
    fetchAppointmentsForDate,
    refreshData: async () => {
      await Promise.all([
        fetchServices(),
        fetchStaffMembers(),
        fetchStaffServices(),
        fetchStaffSchedules()
      ]);
    }
  };
}
