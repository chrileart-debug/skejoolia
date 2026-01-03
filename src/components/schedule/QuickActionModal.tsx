import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Clock, Ban, LogOut, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickActionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedStartTime: string;
  selectedEndTime: string;
  selectedDate: string;
  professionalName: string;
  onBookAppointment: () => void;
  onCreateBlock: (type: "blocked" | "early_leave", reason?: string) => Promise<void>;
  isLoading?: boolean;
}

export function QuickActionModal({
  open,
  onOpenChange,
  selectedStartTime,
  selectedEndTime,
  selectedDate,
  professionalName,
  onBookAppointment,
  onCreateBlock,
  isLoading = false,
}: QuickActionModalProps) {
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [blockType, setBlockType] = useState<"blocked" | "early_leave">("blocked");
  const [reason, setReason] = useState("");

  const formatDateDisplay = (dateStr: string) => {
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  };

  const handleBlockAction = (type: "blocked" | "early_leave") => {
    setBlockType(type);
    setShowReasonInput(true);
  };

  const handleConfirmBlock = async () => {
    await onCreateBlock(blockType, reason || undefined);
    setShowReasonInput(false);
    setReason("");
    onOpenChange(false);
  };

  const handleClose = () => {
    setShowReasonInput(false);
    setReason("");
    onOpenChange(false);
  };

  const handleBookClick = () => {
    onBookAppointment();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Ação Rápida
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info do horário selecionado */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{formatDateDisplay(selectedDate)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span>
                {selectedStartTime} - {selectedEndTime}
              </span>
            </div>
            {professionalName && (
              <div className="text-sm text-muted-foreground">
                Profissional: <span className="font-medium text-foreground">{professionalName}</span>
              </div>
            )}
          </div>

          {!showReasonInput ? (
            <div className="space-y-2">
              {/* Agendar horário */}
              <Button
                variant="default"
                className="w-full justify-start gap-3 h-12"
                onClick={handleBookClick}
                disabled={isLoading}
              >
                <Plus className="w-5 h-5" />
                <span>Agendar horário</span>
              </Button>

              {/* Marcar como indisponível */}
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-12"
                onClick={() => handleBlockAction("blocked")}
                disabled={isLoading}
              >
                <Ban className="w-5 h-5 text-muted-foreground" />
                <span>Marcar como indisponível</span>
              </Button>

              {/* Sair mais cedo */}
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-12"
                onClick={() => handleBlockAction("early_leave")}
                disabled={isLoading}
              >
                <LogOut className="w-5 h-5 text-muted-foreground" />
                <span>Sair mais cedo</span>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reason">
                  {blockType === "early_leave" 
                    ? "Motivo da saída antecipada (opcional)"
                    : "Motivo do bloqueio (opcional)"
                  }
                </Label>
                <Textarea
                  id="reason"
                  placeholder="Ex: Compromisso pessoal, reunião..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowReasonInput(false);
                    setReason("");
                  }}
                  disabled={isLoading}
                >
                  Voltar
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleConfirmBlock}
                  disabled={isLoading}
                >
                  {isLoading ? "Salvando..." : "Confirmar"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
