import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { VipCrown } from "@/components/club/VipBadge";
import { ScrollArea } from "@/components/ui/scroll-area";

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
}: DayViewProps) {
  const dateStr = formatDateToBrasilia(selectedDate);
  const dayAppointments = appointments.filter((apt) => {
    const aptDateStr = getDateFromISO(apt.start_time);
    return aptDateStr === dateStr;
  });

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

  const weekDays = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
  const monthNames = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
  ];

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
    <div className="bg-card border border-border rounded-xl overflow-hidden animate-fade-in">
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
        <div className="relative min-h-[1120px]"> {/* 14 horas * 80px */}
          {hours.map((hour) => (
            <div
              key={hour}
              className="grid grid-cols-[60px_1fr] border-b border-border h-[80px]"
            >
              <div className="p-2 border-r border-border text-sm text-muted-foreground flex items-start justify-center">
                {String(hour).padStart(2, "0")}:00
              </div>
              <div className="relative" />
            </div>
          ))}

          {/* Agendamentos */}
          {dayAppointments.map((apt) => {
            const { top, height } = getAppointmentPosition(apt);

            return (
              <button
                key={apt.id_agendamento}
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
                  apt.status === "completed" &&
                    "bg-green-500/20 border-green-500/30 hover:bg-green-500/30",
                  apt.status === "pending" &&
                    "bg-yellow-500/20 border-yellow-500/30 hover:bg-yellow-500/30",
                  apt.status === "confirmed" &&
                    "bg-blue-500/20 border-blue-500/30 hover:bg-blue-500/30",
                  apt.status === "cancelled" &&
                    "bg-red-500/20 border-red-500/30 hover:bg-red-500/30"
                )}
              >
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
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
