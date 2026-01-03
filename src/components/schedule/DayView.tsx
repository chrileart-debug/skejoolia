import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { VipCrown } from "@/components/club/VipBadge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Ban, LogOut } from "lucide-react";

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
  subscription_status?: string | null;
  subscription_next_due_date?: string | null;
  block_reason?: string | null;
}

interface DayViewProps {
  selectedDate: Date;
  appointments: Appointment[];
  isLoading: boolean;
  onAppointmentClick: (appointment: Appointment) => void;
  formatTimeFromISO: (isoString: string) => string;
  formatDateToBrasilia: (date: Date) => string;
  getDateFromISO: (isoString: string) => string;
  getServiceName: (serviceId: string | null) => string;
  getStaffName: (userId: string) => string;
  onTimeSlotClick?: (startTime: string, endTime: string) => void;
  onTimeSlotDrag?: (startTime: string, endTime: string) => void;
}

const hours = Array.from({ length: 14 }, (_, i) => i + 7); // 7h às 20h

export function DayView({
  selectedDate,
  appointments,
  isLoading,
  onAppointmentClick,
  formatTimeFromISO,
  formatDateToBrasilia,
  getDateFromISO,
  getServiceName,
  getStaffName,
  onTimeSlotClick,
  onTimeSlotDrag,
}: DayViewProps) {
  const dateStr = formatDateToBrasilia(selectedDate);
  const dayAppointments = appointments.filter((apt) => {
    const aptDateStr = getDateFromISO(apt.start_time);
    return aptDateStr === dateStr;
  });

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartHour, setDragStartHour] = useState<number | null>(null);
  const [dragEndHour, setDragEndHour] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const getAppointmentPosition = (apt: Appointment) => {
    const date = new Date(apt.start_time);
    const hour = date.getHours();
    const minutes = date.getMinutes();
    const top = (hour - 7) * 80 + (minutes / 60) * 80; // 80px por hora

    let duration = 60;
    if (apt.end_time) {
      const endDate = new Date(apt.end_time);
      duration = (endDate.getTime() - date.getTime()) / (1000 * 60);
    }

    return { top, height: Math.max((duration / 60) * 80, 40) };
  };

  const formatHour = (hour: number) => String(hour).padStart(2, "0") + ":00";

  const handleMouseDown = useCallback((hour: number, e: React.MouseEvent) => {
    // Ignore if clicking on an appointment
    if ((e.target as HTMLElement).closest('[data-appointment]')) return;
    
    setIsDragging(true);
    setDragStartHour(hour);
    setDragEndHour(hour);
  }, []);

  const handleMouseMove = useCallback((hour: number) => {
    if (isDragging && dragStartHour !== null) {
      setDragEndHour(hour);
    }
  }, [isDragging, dragStartHour]);

  const handleMouseUp = useCallback(() => {
    if (isDragging && dragStartHour !== null && dragEndHour !== null) {
      const startHour = Math.min(dragStartHour, dragEndHour);
      const endHour = Math.max(dragStartHour, dragEndHour) + 1;
      const startTime = formatHour(startHour);
      const endTime = formatHour(endHour);

      if (startHour === dragEndHour) {
        // Single click
        onTimeSlotClick?.(startTime, endTime);
      } else {
        // Drag selection
        onTimeSlotDrag?.(startTime, endTime);
      }
    }
    setIsDragging(false);
    setDragStartHour(null);
    setDragEndHour(null);
  }, [isDragging, dragStartHour, dragEndHour, onTimeSlotClick, onTimeSlotDrag]);

  const isHourInDragRange = (hour: number) => {
    if (!isDragging || dragStartHour === null || dragEndHour === null) return false;
    const min = Math.min(dragStartHour, dragEndHour);
    const max = Math.max(dragStartHour, dragEndHour);
    return hour >= min && hour <= max;
  };

  const weekDays = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
  const monthNames = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
  ];

  const isBlockedAppointment = (apt: Appointment) => 
    apt.status === "blocked" || apt.status === "early_leave";

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border animate-pulse">
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="h-[600px] flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div 
      className="bg-card border border-border rounded-xl overflow-hidden animate-fade-in select-none"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Header com data completa */}
      <div className="p-4 border-b border-border bg-muted/30">
        <h3 className="text-lg font-semibold">
          {weekDays[selectedDate.getDay()]}, {selectedDate.getDate()} de {monthNames[selectedDate.getMonth()]}
        </h3>
        <p className="text-sm text-muted-foreground">
          {dayAppointments.length} agendamento{dayAppointments.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Grade de horários */}
      <ScrollArea className="h-[600px]">
        <div ref={gridRef} className="relative min-h-[1120px]"> {/* 14 horas * 80px */}
          {hours.map((hour) => (
            <div
              key={hour}
              className={cn(
                "grid grid-cols-[60px_1fr] border-b border-border h-[80px] cursor-pointer transition-colors",
                isHourInDragRange(hour) && "bg-primary/10"
              )}
              onMouseDown={(e) => handleMouseDown(hour, e)}
              onMouseEnter={() => handleMouseMove(hour)}
            >
              <div className="p-2 border-r border-border text-sm text-muted-foreground flex items-start justify-center pointer-events-none">
                {formatHour(hour)}
              </div>
              <div className="relative hover:bg-muted/30 transition-colors" />
            </div>
          ))}

          {/* Agendamentos */}
          {dayAppointments.map((apt) => {
            const { top, height } = getAppointmentPosition(apt);
            const isBlocked = isBlockedAppointment(apt);

            return (
              <button
                key={apt.id_agendamento}
                data-appointment
                onClick={() => onAppointmentClick(apt)}
                style={{
                  position: "absolute",
                  top: `${top}px`,
                  height: `${height}px`,
                  left: "68px",
                  right: "8px",
                }}
                className={cn(
                  "rounded-lg px-3 py-2 text-left overflow-hidden border transition-all duration-200 hover:shadow-md",
                  isBlocked && "bg-muted/60 border-dashed border-muted-foreground/50",
                  !isBlocked && apt.status === "completed" &&
                    "bg-green-500/20 border-green-500/30 hover:bg-green-500/30",
                  !isBlocked && apt.status === "pending" &&
                    "bg-yellow-500/20 border-yellow-500/30 hover:bg-yellow-500/30",
                  !isBlocked && apt.status === "confirmed" &&
                    "bg-blue-500/20 border-blue-500/30 hover:bg-blue-500/30",
                  !isBlocked && apt.status === "cancelled" &&
                    "bg-red-500/20 border-red-500/30 hover:bg-red-500/30"
                )}
              >
                {isBlocked ? (
                  <div className="flex flex-col h-full justify-center">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      {apt.status === "early_leave" ? (
                        <LogOut className="w-4 h-4" />
                      ) : (
                        <Ban className="w-4 h-4" />
                      )}
                      <span className="font-medium">
                        {apt.status === "early_leave" ? "Saiu mais cedo" : "Ausente"}
                      </span>
                    </div>
                    {apt.block_reason && height > 50 && (
                      <div className="text-xs text-muted-foreground/70 truncate mt-1">
                        {apt.block_reason}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      {apt.subscription_status === "active" && (
                        <VipCrown
                          status={apt.subscription_status}
                          nextDueDate={apt.subscription_next_due_date || null}
                          className="w-4 h-4 flex-shrink-0"
                        />
                      )}
                      <span className="font-semibold truncate">
                        {apt.nome_cliente || "Cliente não informado"}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground truncate mt-0.5">
                      {formatTimeFromISO(apt.start_time)} • {getServiceName(apt.service_id)}
                    </div>
                    {height > 60 && (
                      <div className="text-xs text-muted-foreground truncate mt-0.5">
                        {getStaffName(apt.user_id)}
                      </div>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
