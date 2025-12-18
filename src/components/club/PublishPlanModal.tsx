import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Sparkles, Check, Rocket } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface PublishPlanModalProps {
  open: boolean;
  onClose: () => void;
}

export function PublishPlanModal({ open, onClose }: PublishPlanModalProps) {
  const navigate = useNavigate();

  const handleSubscribe = () => {
    onClose();
    navigate("/plans");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-amber-500/20 to-primary/20 flex items-center justify-center">
            <Crown className="w-8 h-8 text-primary" />
          </div>
          <DialogTitle className="text-xl">Ative seu Clube VIP</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Para publicar seus planos e começar a vender assinaturas para seus clientes, você precisa de uma assinatura Skejool Pro.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium text-foreground">Com o Skejool Pro você pode:</p>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="w-4 h-4 text-primary shrink-0" />
                Publicar planos de assinatura ilimitados
              </li>
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="w-4 h-4 text-primary shrink-0" />
                Receber pagamentos recorrentes automaticamente
              </li>
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="w-4 h-4 text-primary shrink-0" />
                Gerenciar assinantes e fidelizar clientes
              </li>
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="w-4 h-4 text-primary shrink-0" />
                Link público de assinatura para compartilhar
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Button onClick={handleSubscribe} className="w-full gap-2">
            <Sparkles className="w-4 h-4" />
            Assinar agora
          </Button>
          <Button variant="ghost" onClick={onClose} className="w-full">
            Voltar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
