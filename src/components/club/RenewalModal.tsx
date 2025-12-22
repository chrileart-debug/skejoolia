import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Crown, Loader2, RefreshCw } from "lucide-react";

interface RenewalModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  subscriptionId: string;
  clientName: string;
  planName: string;
  planPrice: number;
  nextDueDate: string;
  barbershopId: string;
  clientId: string;
}

export function RenewalModal({
  open,
  onClose,
  onSuccess,
  subscriptionId,
  clientName,
  planName,
  planPrice,
  nextDueDate,
  barbershopId,
  clientId,
}: RenewalModalProps) {
  const [isRenewing, setIsRenewing] = useState(false);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  const calculateNewDueDate = (currentDueDate: string): string => {
    const date = new Date(currentDueDate);
    date.setDate(date.getDate() + 30);
    return date.toISOString().split("T")[0];
  };

  const handleRenewal = async () => {
    setIsRenewing(true);

    try {
      const newDueDate = calculateNewDueDate(nextDueDate);

      // 1. Update subscription: set next_due_date + 30 days, status = 'active'
      const { error: subError } = await supabase
        .from("client_club_subscriptions")
        .update({
          next_due_date: newDueDate,
          status: "active",
          updated_at: new Date().toISOString(),
        })
        .eq("id", subscriptionId);

      if (subError) throw subError;

      // 2. Create transaction record
      const { error: transError } = await supabase
        .from("client_transactions")
        .insert({
          barbershop_id: barbershopId,
          client_id: clientId,
          subscription_id: subscriptionId,
          amount: planPrice,
          payment_method: "dinheiro",
          status: "pago",
        });

      if (transError) throw transError;

      toast.success("Assinatura renovada com sucesso!");
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error renewing subscription:", error);
      toast.error("Erro ao renovar assinatura");
    } finally {
      setIsRenewing(false);
    }
  };

  const formattedCurrentDueDate = new Date(nextDueDate).toLocaleDateString("pt-BR");
  const formattedNewDueDate = new Date(calculateNewDueDate(nextDueDate)).toLocaleDateString("pt-BR");

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-primary" />
            Renovar Assinatura
          </DialogTitle>
          <DialogDescription>
            Confirme a renovação da assinatura manual
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Client Info */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="font-medium">{clientName}</p>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Crown className="w-3.5 h-3.5 text-amber-500" />
              {planName}
            </p>
          </div>

          {/* Renewal Details */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Vencimento atual:</span>
              <span className="font-medium text-red-500">{formattedCurrentDueDate}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Novo vencimento:</span>
              <span className="font-medium text-green-600">{formattedNewDueDate}</span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-border">
              <span className="text-muted-foreground">Valor a registrar:</span>
              <span className="font-bold text-lg">{formatPrice(planPrice)}</span>
            </div>
          </div>

          {/* Info */}
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <p className="text-xs text-muted-foreground">
              Este valor será registrado como pagamento em dinheiro no faturamento do cliente.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={isRenewing}>
              Cancelar
            </Button>
            <Button
              className="flex-1 gap-2"
              onClick={handleRenewal}
              disabled={isRenewing}
            >
              {isRenewing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Renovando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Confirmar Renovação
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
