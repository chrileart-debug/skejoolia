import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { formatPhoneMask } from "@/lib/phoneMask";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Crown,
  Mail,
  Phone,
  User,
  Loader2,
  CheckCircle2,
} from "lucide-react";

interface Plan {
  id: string;
  name: string;
  price: number;
  interval: string | null;
}

interface PublicClubCheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: Plan;
  barbershopId: string;
  barbershopName: string;
  loggedInClientId?: string | null;
}

const formatPrice = (price: number): string => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(price);
};

const getIntervalLabel = (interval: string | null): string => {
  switch (interval) {
    case "week":
      return "/semana";
    case "year":
      return "/ano";
    default:
      return "/mês";
  }
};

export const PublicClubCheckoutModal = ({
  open,
  onOpenChange,
  plan,
  barbershopId,
  barbershopName,
  loggedInClientId,
}: PublicClubCheckoutModalProps) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("🚀 handleSubmit triggered");

    if (!name.trim()) {
      toast.error("Digite seu nome");
      return;
    }

    if (!email.trim() || !email.includes("@")) {
      toast.error("Digite um e-mail válido");
      return;
    }

    if (!phone.trim() || phone.replace(/\D/g, "").length < 10) {
      toast.error("Digite um telefone válido");
      return;
    }

    // Validate required variables
    if (!barbershopId) {
      console.error("❌ Missing barbershopId");
      toast.error("Erro: ID da barbearia não encontrado");
      return;
    }

    if (!plan?.id) {
      console.error("❌ Missing plan.id");
      toast.error("Erro: ID do plano não encontrado");
      return;
    }

    setSubmitting(true);
    console.log("✅ Validation passed, starting submission...");

    try {
      // First, upsert the client in clientes table
      const cleanPhone = phone.replace(/\D/g, "");
      console.log("📞 Clean phone:", cleanPhone);

      const { data: ownerData, error: ownerError } = await supabase
        .from("barbershops")
        .select("owner_id")
        .eq("id", barbershopId)
        .single();

      if (ownerError) {
        console.error("❌ Error fetching owner:", ownerError);
      }
      console.log("👤 Owner data:", ownerData);

      const { data: clientData, error: clientError } = await supabase
        .from("clientes")
        .upsert(
          {
            barbershop_id: barbershopId,
            nome: name.trim(),
            email: email.trim(),
            telefone: cleanPhone,
            user_id: ownerData?.owner_id,
          },
          { onConflict: "barbershop_id,telefone" }
        )
        .select("client_id")
        .single();

      if (clientError) {
        console.error("❌ Error upserting client:", clientError);
      }
      console.log("👤 Client data:", clientData);

      // Build payload
      const payload = {
        action: "subscribe_plan",
        barbershop_id: barbershopId,
        plan_id: plan.id,
        client_id: loggedInClientId || clientData?.client_id || null,
        customer_details: {
          name: name.trim(),
          email: email.trim(),
          phone: cleanPhone,
        },
      };

      console.log("📤 Sending payload to n8n:", payload);

      // Send to webhook with exact payload structure
      const response = await fetch("https://webhook.lernow.com/webhook/asaas-meu-clube", {
        method: "POST",
        mode: "cors",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      console.log("📥 n8n Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Response not ok:", errorText);
        throw new Error(`Failed to submit subscription: ${response.status}`);
      }

      const data = await response.json();
      console.log("📥 n8n Response data:", data);

      // If webhook returns checkout_url, redirect immediately
      if (data.checkout_url) {
        console.log("🔗 Redirecting to checkout:", data.checkout_url);
        window.location.href = data.checkout_url;
        return;
      }

      setSuccess(true);
      toast.success("Solicitação enviada com sucesso!");
    } catch (error) {
      console.error("❌ Subscription error:", error);
      toast.error("Erro ao conectar com o servidor de pagamentos. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setSuccess(false);
      setName("");
      setEmail("");
      setPhone("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {success ? (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto animate-scale-in">
              <CheckCircle2 className="w-8 h-8 text-success" />
            </div>
            <div className="space-y-2">
              <DialogTitle className="text-xl">Solicitação Enviada!</DialogTitle>
              <p className="text-muted-foreground text-sm">
                Entraremos em contato em breve para finalizar sua assinatura do plano{" "}
                <span className="font-medium text-foreground">{plan.name}</span>.
              </p>
            </div>
            <Button onClick={handleClose} className="w-full mt-4">
              Fechar
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Crown className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <DialogTitle>{plan.name}</DialogTitle>
                  <DialogDescription>
                    {formatPrice(plan.price)}
                    {getIntervalLabel(plan.interval)}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome completo</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="name"
                    placeholder="Seu nome"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10"
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">WhatsApp</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="(00) 00000-0000"
                    value={phone}
                    onChange={(e) => setPhone(formatPhoneMask(e.target.value))}
                    className="pl-10"
                    disabled={submitting}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Solicitar Assinatura"
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Ao continuar, você concorda em receber contato de {barbershopName} para finalizar sua assinatura.
              </p>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
