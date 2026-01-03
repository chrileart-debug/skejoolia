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

interface WeekViewProps {
  selectedDate: Date;
  appointments: Appointment[];
  isLoading: boolean;
  onDayClick: (date: Date) => void;
  formatTimeFromISO: (isoString: string) => string;
  formatDateToBrasilia: (date: Date) => string;
  getDateFromISO: (isoString: string) => string;
  isToday: (date: Date) => boolean;
  getServiceName: (serviceId: string | null) => string;
  onTimeSlotClick?: (date: Date, startTime: string, endTime: string) => void;
  onTimeSlotDrag?: (date: Date, startTime: string, endTime: string) => void;
}

const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const hours = Array.from({ length: 14 }, (_, i) => i + 7); // 7h às 20h

export function WeekView({
  selectedDate,
  appointments,
  isLoading,
  onDayClick,
  formatTimeFromISO,
  formatDateToBrasilia,
  getDateFromISO,
  isToday,
  getServiceName,
  onTimeSlotClick,
  onTimeSlotDrag,
}: WeekViewProps) {
  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartCell, setDragStartCell] = useState<{ dayIndex: number; hour: number } | null>(null);
  const [dragEndCell, setDragEndCell] = useState<{ dayIndex: number; hour: number } | null>(null);

  // Calcular os dias da semana baseado na data selecionada
  const getWeekDays = () => {
    const startOfWeek = new Date(selectedDate);
    const dayOfWeek = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);

    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      return date;
    });
  };

  const weekDates = getWeekDays();

  const getAppointmentsForDay = (date: Date) => {
    const dateStr = formatDateToBrasilia(date);
    return appointments.filter((apt) => {
      const aptDateStr = getDateFromISO(apt.start_time);
      return aptDateStr === dateStr;
    });
  };

  const getAppointmentPosition = (apt: Appointment) => {
    const date = new Date(apt.start_time);
    const hour = date.getHours();
    const minutes = date.getMinutes();
    const top = (hour - 7) * 60 + minutes; // Offset de 7h
    
    let duration = 60;
    if (apt.end_time) {
      const endDate = new Date(apt.end_time);
      duration = (endDate.getTime() - date.getTime()) / (1000 * 60);
    }
    
    return { top, height: Math.max(duration, 30) };
  };

  const formatHour = (hour: number) => String(hour).padStart(2, "0") + ":00";

  const handleMouseDown = useCallback((dayIndex: number, hour: number, e: React.MouseEvent) => {
    // Ignore if clicking on an appointment
    if ((e.target as HTMLElement).closest('[data-appointment]')) return;
    
    setIsDragging(true);
    setDragStartCell({ dayIndex, hour });
    setDragEndCell({ dayIndex, hour });
  }, []);

  const handleMouseMove = useCallback((dayIndex: number, hour: number) => {
    if (isDragging && dragStartCell !== null) {
      // Only allow vertical drag within same day
      if (dayIndex === dragStartCell.dayIndex) {
        setDragEndCell({ dayIndex, hour });
      }
    }
  }, [isDragging, dragStartCell]);

  const handleMouseUp = useCallback(() => {
    if (isDragging && dragStartCell !== null && dragEndCell !== null) {
      const startHour = Math.min(dragStartCell.hour, dragEndCell.hour);
      const endHour = Math.max(dragStartCell.hour, dragEndCell.hour) + 1;
      const startTime = formatHour(startHour);
      const endTime = formatHour(endHour);
      const date = weekDates[dragStartCell.dayIndex];

      if (dragStartCell.hour === dragEndCell.hour) {
        // Single click
        onTimeSlotClick?.(date, startTime, endTime);
      } else {
        // Drag selection
        onTimeSlotDrag?.(date, startTime, endTime);
      }
    }
    setIsDragging(false);
    setDragStartCell(null);
    setDragEndCell(null);
  }, [isDragging, dragStartCell, dragEndCell, weekDates, onTimeSlotClick, onTimeSlotDrag]);

  const isCellInDragRange = (dayIndex: number, hour: number) => {
    if (!isDragging || dragStartCell === null || dragEndCell === null) return false;
    if (dayIndex !== dragStartCell.dayIndex) return false;
    const min = Math.min(dragStartCell.hour, dragEndCell.hour);
    const max = Math.max(dragStartCell.hour, dragEndCell.hour);
    return hour >= min && hour <= max;
  };

  const isBlockedAppointment = (apt: Appointment) => 
    apt.status === "blocked" || apt.status === "early_leave";

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="grid grid-cols-8 border-b border-border">
          <div className="p-2 border-r border-border" />
          {weekDays.map((day) => (
            <div key={day} className="p-2 text-center text-xs sm:text-sm font-medium text-muted-foreground animate-pulse">
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
        <div className="h-[500px] flex items-center justify-center">
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
      {/* Header com dias da semana */}
      <div className="grid grid-cols-8 border-b border-border sticky top-0 bg-card z-10">
        <div className="p-2 border-r border-border text-center text-xs text-muted-foreground">
          Hora
        </div>
        {weekDates.map((date, index) => (
          <button
            key={index}
            onClick={() => onDayClick(date)}
            className={cn(
              "p-2 text-center border-r border-border last:border-r-0 hover:bg-muted/50 transition-colors",
              isToday(date) && "bg-primary/10"
            )}
          >
            <div className="text-xs text-muted-foreground">{weekDays[index]}</div>
            <div
              className={cn(
                "text-sm font-medium inline-flex items-center justify-center w-7 h-7 rounded-full",
                isToday(date) && "bg-primary text-primary-foreground"
              )}
            >
              {date.getDate()}
            </div>
          </button>
        ))}
      </div>

      {/* Grade de horários */}
      <ScrollArea className="h-[600px]">
        <div className="relative">
          {hours.map((hour) => (
            <div key={hour} className="grid grid-cols-8 border-b border-border h-[60px]">
              <div className="p-1 border-r border-border text-xs text-muted-foreground text-center flex items-start justify-center pt-1">
                {formatHour(hour)}
              </div>
              {weekDates.map((date, dayIndex) => (
                <div
                  key={dayIndex}
                  className={cn(
                    "border-r border-border last:border-r-0 relative cursor-pointer hover:bg-muted/30 transition-colors",
                    isToday(date) && "bg-primary/5",
                    isCellInDragRange(dayIndex, hour) && "bg-primary/10"
                  )}
                  onMouseDown={(e) => handleMouseDown(dayIndex, hour, e)}
                  onMouseEnter={() => handleMouseMove(dayIndex, hour)}
                />
              ))}
            </div>
          ))}

          {/* Agendamentos sobrepostos */}
          {weekDates.map((date, dayIndex) => {
            const dayAppointments = getAppointmentsForDay(date);
            return dayAppointments.map((apt) => {
              const { top, height } = getAppointmentPosition(apt);
              // Calcular posição horizontal
              const left = `calc(${(dayIndex + 1) * 12.5}% + 2px)`;
              const width = `calc(12.5% - 4px)`;
              const isBlocked = isBlockedAppointment(apt);

              return (
                <button
                  key={apt.id_agendamento}
                  data-appointment
                  onClick={() => onDayClick(date)}
                  style={{
                    position: "absolute",
                    top: `${top}px`,
                    height: `${height}px`,
                    left,
                    width,
                  }}
                  className={cn(
                    "rounded px-1 py-0.5 text-[10px] sm:text-xs overflow-hidden text-left z-10 border transition-all duration-200 hover:shadow-md",
                    isBlocked && "bg-muted/60 border-dashed border-muted-foreground/50",
                    !isBlocked && apt.status === "completed" &&
                      "bg-green-500/20 border-green-500/30 text-green-700 dark:text-green-400",
                    !isBlocked && apt.status === "pending" &&
                      "bg-yellow-500/20 border-yellow-500/30 text-yellow-700 dark:text-yellow-400",
                    !isBlocked && apt.status === "confirmed" &&
                      "bg-blue-500/20 border-blue-500/30 text-blue-700 dark:text-blue-400",
                    !isBlocked && apt.status === "cancelled" &&
                      "bg-red-500/20 border-red-500/30 text-red-700 dark:text-red-400"
                  )}
                >
                  {isBlocked ? (
                    <div className="flex items-center gap-0.5 text-muted-foreground truncate">
                      {apt.status === "early_leave" ? (
                        <LogOut className="w-3 h-3 flex-shrink-0" />
                      ) : (
                        <Ban className="w-3 h-3 flex-shrink-0" />
                      )}
                      <span className="font-medium truncate">
                        {apt.status === "early_leave" ? "Saiu" : "Ausente"}
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-0.5 truncate">
                        {apt.subscription_status === "active" && (
                          <VipCrown
                            status={apt.subscription_status}
                            nextDueDate={apt.subscription_next_due_date || null}
                            className="w-3 h-3 flex-shrink-0"
                          />
                        )}
                        <span className="font-medium truncate">
                          {apt.nome_cliente || "Cliente"}
                        </span>
                      </div>
                      <div className="truncate text-[9px] opacity-80">
                        {formatTimeFromISO(apt.start_time)}
                      </div>
                    </>
                  )}
                </button>
              );
            });
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
