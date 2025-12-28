import { useState } from "react";
import { Building2, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatPhoneMask } from "@/lib/phoneMask";
import { sendNewUserWebhook } from "@/lib/webhook";

interface OnboardingModalProps {
  isOpen: boolean;
  barbershopId: string;
  userId: string;
  currentPhone?: string | null;
  onComplete: () => void;
}

export function OnboardingModal({
  isOpen,
  barbershopId,
  userId,
  currentPhone,
  onComplete,
}: OnboardingModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    barbershopName: "",
    phone: currentPhone || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.barbershopName.trim()) {
      toast.error("Digite o nome da sua barbearia");
      return;
    }

    if (!formData.phone.trim()) {
      toast.error("Digite seu WhatsApp");
      return;
    }

    setIsLoading(true);

    try {
      // Update barbershop name
      const { error: barbershopError } = await supabase
        .from("barbershops")
        .update({ name: formData.barbershopName.trim() })
        .eq("id", barbershopId);

      if (barbershopError) throw barbershopError;

      // Update user phone if needed
      if (formData.phone !== currentPhone) {
        const { error: settingsError } = await supabase
          .from("user_settings")
          .update({ numero: formData.phone.trim() })
          .eq("user_id", userId);

        if (settingsError) throw settingsError;
      }

      // Buscar dados do usuário para o webhook
      const { data: { user } } = await supabase.auth.getUser();
      const { data: userSettings } = await supabase
        .from("user_settings")
        .select("nome")
        .eq("user_id", userId)
        .single();

      // Disparar webhook de novo usuário (cadastro via Google)
      sendNewUserWebhook({
        nome: userSettings?.nome || user?.user_metadata?.full_name || "",
        numero: formData.phone.trim(),
        email: user?.email || "",
        origem: "google",
        barbershop_id: barbershopId,
      }).catch((err) => console.error("Erro ao disparar webhook de cadastro:", err));

      toast.success("Dados salvos com sucesso!");
      onComplete();
    } catch (error: any) {
      console.error("Error saving onboarding data:", error);
      toast.error("Erro ao salvar dados. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-md [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            Bem-vindo ao Skejool! 🎉
          </DialogTitle>
          <DialogDescription>
            Complete seu cadastro para começar a usar o sistema.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="barbershopName">Qual o nome da sua Barbearia?</Label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                id="barbershopName"
                type="text"
                placeholder="Ex: Barbearia do João"
                className="pl-10 h-12"
                value={formData.barbershopName}
                onChange={(e) =>
                  setFormData({ ...formData, barbershopName: e.target.value })
                }
                autoFocus
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Seu WhatsApp</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                id="phone"
                type="tel"
                placeholder="(11) 99999-9999"
                className="pl-10 h-12"
                maxLength={16}
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: formatPhoneMask(e.target.value) })
                }
              />
            </div>
          </div>

          <Button
            type="submit"
            size="xl"
            className="w-full mt-6"
            disabled={isLoading}
          >
            {isLoading ? "Salvando..." : "Começar a usar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
