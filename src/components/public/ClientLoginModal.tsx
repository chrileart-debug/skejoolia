import { useState } from "react";
import { toast } from "sonner";
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
import { Phone, Loader2, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ClientData {
  client_id: string;
  nome: string | null;
  telefone: string | null;
  email: string | null;
  total_cortes: number | null;
  faturamento_total: number | null;
  last_visit: string | null;
}

interface ClientLoginModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  barbershopId: string;
  onClientFound: (client: ClientData) => void;
}

export const ClientLoginModal = ({
  open,
  onOpenChange,
  barbershopId,
  onClientFound,
}: ClientLoginModalProps) => {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      toast.error("Digite um telefone válido");
      return;
    }

    setLoading(true);

    try {
      // Use robust DB function to find client by phone (handles all formats)
      const { data, error } = await supabase.rpc("find_client_by_phone", {
        p_barbershop_id: barbershopId,
        p_phone: cleanPhone,
      });

      if (error) {
        console.error("Phone lookup error:", error);
        toast.error("Erro ao buscar cliente. Tente novamente.");
        return;
      }

      if (!data || data.length === 0) {
        toast.error("Cliente não encontrado. Faça um agendamento para se cadastrar!");
        return;
      }

      const clientData = data[0] as ClientData;
      onClientFound(clientData);
      onOpenChange(false);
      toast.success(`Bem-vindo de volta, ${clientData.nome || "Cliente"}!`);
    } catch (error) {
      console.error("Error looking up client:", error);
      toast.error("Erro ao buscar cliente. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setPhone("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Minha Área</DialogTitle>
              <DialogDescription>
                Entre com seu WhatsApp para acessar
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
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
                disabled={loading}
                autoFocus
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Use o mesmo número que você usou para agendar
            </p>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Buscando...
              </>
            ) : (
              "Entrar"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
