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
  barbershopId: string;
  clientPhone: string;
  onReschedule: (appointmentId: string) => void;
  onCancelled: () => void;
}

export const ExistingAppointmentModal = ({
  open,
  onOpenChange,
  appointment,
  barbershopId,
  clientPhone,
  onReschedule,
  onCancelled,
}: ExistingAppointmentModalProps) => {
  const [cancelling, setCancelling] = useState(false);

  if (!appointment) return null;

  const appointmentDate = new Date(appointment.start_time);
  const formattedDate = format(appointmentDate, "EEEE, dd 'de' MMMM", { locale: ptBR });
  const formattedTime = format(appointmentDate, "HH:mm");

  const handleCancel = async () => {
    setCancelling(true);
    try {
      // Use secure cancel RPC that validates phone ownership
      const cleanPhone = clientPhone.replace(/\D/g, "");
      
      const { data: success, error } = await supabase.rpc("cancel_public_appointment", {
        p_barbershop_id: barbershopId,
        p_appointment_id: appointment.id_agendamento,
        p_phone: cleanPhone,
      });

      if (error) throw error;
      
      if (!success) {
        toast.error("Não foi possível cancelar este agendamento.");
        return;
      }

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
          
          {/* Only show cancel button for pending appointments */}
          {appointment.status === "pending" && (
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
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
