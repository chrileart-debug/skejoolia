import { AlertTriangle, ArrowUpCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useNavigate } from "react-router-dom";

interface UpgradeLimitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceType: "agents" | "whatsapp" | "services" | "appointments";
  currentCount: number;
  limit: number;
}

const resourceLabels = {
  agents: {
    singular: "agente",
    plural: "agentes",
    description: "Para criar mais agentes, você precisa fazer upgrade para o plano Corporativo.",
  },
  whatsapp: {
    singular: "integração WhatsApp",
    plural: "integrações WhatsApp",
    description: "Para adicionar mais integrações WhatsApp, você precisa fazer upgrade para o plano Corporativo.",
  },
  services: {
    singular: "serviço",
    plural: "serviços",
    description: "Para cadastrar mais serviços, você precisa fazer upgrade para o plano Corporativo.",
  },
  appointments: {
    singular: "agendamento",
    plural: "agendamentos",
    description: "Você atingiu o limite de agendamentos deste mês. Faça upgrade para ter agendamentos ilimitados.",
  },
};

export function UpgradeLimitModal({
  open,
  onOpenChange,
  resourceType,
  currentCount,
  limit,
}: UpgradeLimitModalProps) {
  const navigate = useNavigate();
  const labels = resourceLabels[resourceType];

  const handleUpgrade = () => {
    onOpenChange(false);
    navigate("/settings?tab=subscription");
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-warning" />
          </div>
          <AlertDialogTitle className="text-center">
            Limite de {labels.plural} atingido
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center space-y-2">
            <p>
              Você está usando <span className="font-semibold text-foreground">{currentCount}</span> de{" "}
              <span className="font-semibold text-foreground">{limit}</span> {labels.plural} disponíveis no seu plano.
            </p>
            <p>{labels.description}</p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:flex-col sm:space-x-0 sm:space-y-2">
          <AlertDialogAction onClick={handleUpgrade} className="w-full gap-2">
            <ArrowUpCircle className="w-4 h-4" />
            Fazer upgrade
          </AlertDialogAction>
          <AlertDialogCancel className="w-full">Voltar</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
