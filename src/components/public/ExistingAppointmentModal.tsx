import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Calendar, Clock, Scissors, User, RefreshCw, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Appointment {
  id_agendamento: string;
  start_time: string;
  end_time: string | null;
  status: string | null;
  nome_cliente: string | null;
  service_name?: string;
  professional_name?: string;
}

interface ExistingAppointmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: Appointment | null;
  onReschedule: (appointmentId: string) => void;
  onCancelled: () => void;
  onProceedNewBooking: () => void;
}

export const ExistingAppointmentModal = ({
  open,
  onOpenChange,
  appointment,
  onReschedule,
  onCancelled,
  onProceedNewBooking,
}: ExistingAppointmentModalProps) => {
  const [cancelling, setCancelling] = useState(false);

  if (!appointment) return null;

  const appointmentDate = new Date(appointment.start_time);
  const formattedDate = format(appointmentDate, "EEEE, dd 'de' MMMM", { locale: ptBR });
  const formattedTime = format(appointmentDate, "HH:mm");

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const { error } = await supabase
        .from("agendamentos")
        .update({ status: "cancelled" })
        .eq("id_agendamento", appointment.id_agendamento);

      if (error) throw error;

      toast.success("Agendamento cancelado com sucesso");
      onCancelled();
      onOpenChange(false);
    } catch (error) {
      console.error("Error cancelling appointment:", error);
      toast.error("Erro ao cancelar agendamento");
    } finally {
      setCancelling(false);
    }
  };

  const handleReschedule = () => {
    onReschedule(appointment.id_agendamento);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Você já tem um agendamento!</DialogTitle>
              <DialogDescription>
                O que você deseja fazer?
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="bg-muted/50 rounded-xl p-4 space-y-3 my-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-primary" />
            <div>
              <p className="font-medium text-foreground capitalize">{formattedDate}</p>
              <p className="text-sm text-muted-foreground">às {formattedTime}</p>
            </div>
          </div>
          {appointment.service_name && (
            <div className="flex items-center gap-3">
              <Scissors className="w-5 h-5 text-primary" />
              <p className="font-medium text-foreground">{appointment.service_name}</p>
            </div>
          )}
          {appointment.professional_name && (
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-primary" />
              <p className="font-medium text-foreground">{appointment.professional_name}</p>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <Button
            onClick={handleReschedule}
            className="w-full"
            variant="outline"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Remarcar horário
          </Button>
          
          <Button
            onClick={handleCancel}
            variant="destructive"
            className="w-full"
            disabled={cancelling}
          >
            {cancelling ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Cancelando...
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4 mr-2" />
                Cancelar agendamento
              </>
            )}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">ou</span>
            </div>
          </div>

          <Button
            onClick={onProceedNewBooking}
            variant="ghost"
            className="w-full text-muted-foreground"
          >
            Fazer novo agendamento mesmo assim
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
