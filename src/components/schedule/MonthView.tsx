import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { VipCrown } from "@/components/club/VipBadge";

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
}

interface MonthViewProps {
  calendarDays: { date: Date; isCurrentMonth: boolean }[];
  appointments: Appointment[];
  isLoading: boolean;
  onDayClick: (date: Date) => void;
  formatTimeFromISO: (isoString: string) => string;
  formatDateToBrasilia: (date: Date) => string;
  getDateFromISO: (isoString: string) => string;
  isToday: (date: Date) => boolean;
}

const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function MonthView({
  calendarDays,
  appointments,
  isLoading,
  onDayClick,
  formatTimeFromISO,
  formatDateToBrasilia,
  getDateFromISO,
  isToday,
}: MonthViewProps) {
  const getAppointmentsForDay = (date: Date) => {
    const dateStr = formatDateToBrasilia(date);
    return appointments.filter((apt) => {
      const aptDateStr = getDateFromISO(apt.start_time);
      return aptDateStr === dateStr;
    });
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Week days header */}
      <div className="grid grid-cols-7 border-b border-border">
        {weekDays.map((day) => (
          <div
            key={day}
            className="p-2 text-center text-xs sm:text-sm font-medium text-muted-foreground"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar days */}
      {isLoading ? (
        <div className="grid grid-cols-7">
          {Array(42)
            .fill(0)
            .map((_, index) => (
              <div
                key={index}
                className="min-h-[60px] sm:min-h-[80px] p-1 sm:p-2 border-b border-r border-border animate-pulse"
              >
                <Skeleton className="w-6 h-6 sm:w-7 sm:h-7 rounded-full" />
                {index % 3 === 0 && (
                  <div className="mt-1 space-y-0.5">
                    <Skeleton className="h-4 w-full" />
                  </div>
                )}
              </div>
            ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 animate-fade-in">
          {calendarDays.map((day, index) => {
            const dayAppointments = getAppointmentsForDay(day.date);
            const hasAppointments = dayAppointments.length > 0;

            return (
              <button
                key={index}
                onClick={() => onDayClick(day.date)}
                className={cn(
                  "min-h-[60px] sm:min-h-[80px] p-1 sm:p-2 border-b border-r border-border text-left transition-colors hover:bg-muted/50",
                  !day.isCurrentMonth && "bg-muted/30 text-muted-foreground",
                  isToday(day.date) && "bg-primary/10"
                )}
              >
                <span
                  className={cn(
                    "inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 text-xs sm:text-sm rounded-full",
                    isToday(day.date) && "bg-primary text-primary-foreground font-semibold"
                  )}
                >
                  {day.date.getDate()}
                </span>
                {hasAppointments && (
                  <div className="mt-1 space-y-0.5">
                    {dayAppointments.slice(0, 2).map((apt) => (
                      <div
                        key={apt.id_agendamento}
                        className={cn(
                          "text-[10px] sm:text-xs px-1 py-0.5 rounded truncate flex items-center gap-0.5 transition-all duration-200",
                          apt.status === "completed" &&
                            "bg-green-500/20 text-green-700 dark:text-green-400",
                          apt.status === "pending" &&
                            "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
                          apt.status === "confirmed" &&
                            "bg-blue-500/20 text-blue-700 dark:text-blue-400",
                          apt.status === "cancelled" &&
                            "bg-red-500/20 text-red-700 dark:text-red-400"
                        )}
                      >
                        {apt.subscription_status === "active" && (
                          <VipCrown
                            status={apt.subscription_status}
                            nextDueDate={apt.subscription_next_due_date || null}
                            className="w-3 h-3 flex-shrink-0"
                          />
                        )}
                        <span className="hidden sm:inline">
                          {formatTimeFromISO(apt.start_time)} -{" "}
                        </span>
                        <span className="truncate">{apt.nome_cliente || "Cliente"}</span>
                      </div>
                    ))}
                    {dayAppointments.length > 2 && (
                      <div className="text-[10px] text-muted-foreground px-1">
                        +{dayAppointments.length - 2}
                      </div>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
