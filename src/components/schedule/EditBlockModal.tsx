import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Calendar, Clock, Ban, LogOut } from "lucide-react";

interface EditBlockModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blockData: {
    id: string;
    startTime: string;
    endTime: string;
    date: string;
    type: "blocked" | "early_leave";
    reason: string;
  } | null;
  professionalName: string;
  onSave: (data: {
    id: string;
    startTime: string;
    endTime: string;
    type: "blocked" | "early_leave";
    reason: string;
  }) => Promise<void>;
  isLoading?: boolean;
}

export function EditBlockModal({
  open,
  onOpenChange,
  blockData,
  professionalName,
  onSave,
  isLoading = false,
}: EditBlockModalProps) {
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [blockType, setBlockType] = useState<"blocked" | "early_leave">("blocked");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (blockData) {
      setStartTime(blockData.startTime);
      setEndTime(blockData.endTime);
      setBlockType(blockData.type);
      setReason(blockData.reason);
    }
  }, [blockData]);

  const formatDateDisplay = (dateStr: string) => {
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  };

  const handleSave = async () => {
    if (!blockData) return;
    await onSave({
      id: blockData.id,
      startTime,
      endTime,
      type: blockType,
      reason,
    });
  };

  if (!blockData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {blockType === "early_leave" ? (
              <LogOut className="w-5 h-5 text-muted-foreground" />
            ) : (
              <Ban className="w-5 h-5 text-muted-foreground" />
            )}
            Editar Bloqueio
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info do bloqueio */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{formatDateDisplay(blockData.date)}</span>
            </div>
            {professionalName && (
              <div className="text-sm text-muted-foreground">
                Profissional: <span className="font-medium text-foreground">{professionalName}</span>
              </div>
            )}
          </div>

          {/* Tipo de bloqueio */}
          <div className="space-y-2">
            <Label>Tipo</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={blockType === "blocked" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setBlockType("blocked")}
              >
                <Ban className="w-4 h-4 mr-2" />
                Indisponível
              </Button>
              <Button
                type="button"
                variant={blockType === "early_leave" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setBlockType("early_leave")}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Saída antecipada
              </Button>
            </div>
          </div>

          {/* Horários */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-start-time">Início</Label>
              <Input
                id="edit-start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-end-time">Fim</Label>
              <Input
                id="edit-end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          {/* Motivo */}
          <div className="space-y-2">
            <Label htmlFor="edit-reason">
              {blockType === "early_leave"
                ? "Motivo da saída antecipada (opcional)"
                : "Motivo do bloqueio (opcional)"
              }
            </Label>
            <Textarea
              id="edit-reason"
              placeholder="Ex: Compromisso pessoal, reunião..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>

          {/* Botões */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={handleSave}
              disabled={isLoading}
            >
              {isLoading ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
