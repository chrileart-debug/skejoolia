import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Loader2 } from "lucide-react";
import { VipCrown } from "@/components/club/VipBadge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FinishAppointmentData {
  id_agendamento: string;
  nome_cliente: string | null;
  service_id: string | null;
  service_name?: string | null;
  client_id: string | null;
  user_id: string;
}

interface FinishAppointmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: FinishAppointmentData | null;
  barbershopId: string;
  onSuccess?: () => void;
}

export function FinishAppointmentModal({
  open,
  onOpenChange,
  appointment,
  barbershopId,
  onSuccess,
}: FinishAppointmentModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingVip, setIsCheckingVip] = useState(false);
  const [isClientVip, setIsClientVip] = useState(false);
  const [vipSubscriptionId, setVipSubscriptionId] = useState<string | null>(null);
  const [serviceName, setServiceName] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    amount: 0,
    paymentMethod: "Dinheiro",
  });

  // Load appointment details when opened
  useEffect(() => {
    if (!open || !appointment || !barbershopId) {
      // Reset state when closed
      setIsClientVip(false);
      setVipSubscriptionId(null);
      setServiceName(null);
      setFormData({ amount: 0, paymentMethod: "Dinheiro" });
      return;
    }

    const loadDetails = async () => {
      setIsCheckingVip(true);

      try {
        // Fetch service details
        if (appointment.service_id) {
          const { data: service } = await supabase
            .from("services")
            .select("name, price")
            .eq("id", appointment.service_id)
            .single();

          if (service) {
            setServiceName(service.name);
            setFormData(prev => ({ ...prev, amount: service.price || 0 }));
          }
        } else if (appointment.service_name) {
          setServiceName(appointment.service_name);
        }

        // Check if client is VIP
        if (appointment.client_id) {
          const { data: subscription } = await supabase
            .from("client_club_subscriptions")
            .select("id, status")
            .eq("client_id", appointment.client_id)
            .eq("barbershop_id", barbershopId)
            .eq("status", "active")
            .maybeSingle();

          const isVip = !!subscription;
          setIsClientVip(isVip);
          setVipSubscriptionId(subscription?.id || null);

          if (isVip) {
            setFormData({
              amount: 0,
              paymentMethod: "Saldo VIP/Clube",
            });
          }
        }
      } catch (error) {
        console.error("Error loading appointment details:", error);
      } finally {
        setIsCheckingVip(false);
      }
    };

    loadDetails();
  }, [open, appointment, barbershopId]);

  const handleSubmit = async () => {
    if (!appointment || !barbershopId) return;

    setIsLoading(true);

    try {
      // STEP 1: Insert transaction
      const { data: transaction, error: transactionError } = await supabase
        .from("client_transactions")
        .insert({
          barbershop_id: barbershopId,
          client_id: appointment.client_id,
          appointment_id: appointment.id_agendamento,
          amount: formData.amount,
          payment_method: formData.paymentMethod,
          status: "pago",
        })
        .select("id")
        .single();

      if (transactionError) throw transactionError;

      // STEP 2: Update appointment status
      const { error: updateError } = await supabase
        .from("agendamentos")
        .update({
          status: "completed",
          transaction_id: transaction.id,
        })
        .eq("id_agendamento", appointment.id_agendamento);

      if (updateError) throw updateError;

      // If VIP, record usage
      if (isClientVip && vipSubscriptionId && appointment.service_id) {
        await supabase
          .from("client_subscription_usage")
          .insert({
            subscription_id: vipSubscriptionId,
            service_id: appointment.service_id,
            appointment_id: appointment.id_agendamento,
          });
      }

      // STEP 3: Calculate and insert commission if applicable
      let commissionAmount = 0;
      if (formData.amount > 0) {
        const { data: roleData } = await supabase
          .from("user_barbershop_roles")
          .select("commission_percentage")
          .eq("user_id", appointment.user_id)
          .eq("barbershop_id", barbershopId)
          .single();

        const commissionPercentage = roleData?.commission_percentage;

        if (commissionPercentage && commissionPercentage > 0) {
          commissionAmount = formData.amount * (commissionPercentage / 100);

          await supabase.from("commissions").insert({
            barbershop_id: barbershopId,
            user_id: appointment.user_id,
            appointment_id: appointment.id_agendamento,
            service_id: appointment.service_id,
            service_amount: formData.amount,
            commission_percentage: commissionPercentage,
            commission_amount: commissionAmount,
            status: "pending",
          });
        }
      }

      const commissionMsg = commissionAmount > 0 
        ? ` Comissão: R$ ${commissionAmount.toFixed(2)}` 
        : "";
      toast.success(`Atendimento concluído!${commissionMsg}`);

      onOpenChange(false);
      onSuccess?.();

    } catch (error) {
      console.error("Erro ao finalizar atendimento:", error);
      toast.error("Erro ao finalizar atendimento");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            Concluir Atendimento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Client Info */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="font-medium">{appointment?.nome_cliente || "Cliente não informado"}</p>
            <p className="text-sm text-muted-foreground">
              {serviceName || "Serviço não definido"}
            </p>
          </div>

          {isCheckingVip ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* VIP Badge */}
              {isClientVip && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <VipCrown status="active" nextDueDate={null} className="w-5 h-5" />
                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                      Membro VIP Detectado
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Serviço incluso no plano. Pagamento zerado automaticamente.
                  </p>
                </div>
              )}

              {/* Amount */}
              <div className="space-y-2">
                <Label htmlFor="finish-amount">Valor (R$)</Label>
                <Input
                  id="finish-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount}
                  onChange={(e) => setFormData({
                    ...formData,
                    amount: parseFloat(e.target.value) || 0
                  })}
                  disabled={isClientVip}
                  className={isClientVip ? "bg-muted" : ""}
                />
              </div>

              {/* Payment Method */}
              <div className="space-y-2">
                <Label htmlFor="finish-method">Método de Pagamento</Label>
                <Select
                  value={formData.paymentMethod}
                  onValueChange={(value) => setFormData({
                    ...formData,
                    paymentMethod: value
                  })}
                  disabled={isClientVip}
                >
                  <SelectTrigger className={isClientVip ? "bg-muted" : ""}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="Pix Manual">Pix Manual</SelectItem>
                    <SelectItem value="Cartão (Maquininha)">Cartão (Maquininha)</SelectItem>
                    <SelectItem value="Saldo VIP/Clube">Saldo VIP/Clube</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Submit Button */}
              <Button
                onClick={handleSubmit}
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Confirmar Conclusão
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
