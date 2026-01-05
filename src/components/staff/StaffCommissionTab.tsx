import { useState, useEffect } from "react";
import { Percent, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface StaffCommissionTabProps {
  userId: string;
  barbershopId: string;
  isReadOnly: boolean;
}

export function StaffCommissionTab({
  userId,
  barbershopId,
  isReadOnly
}: StaffCommissionTabProps) {
  const [commission, setCommission] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchCommission = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("user_barbershop_roles")
          .select("commission_percentage")
          .eq("user_id", userId)
          .eq("barbershop_id", barbershopId)
          .single();

        if (error) throw error;
        setCommission(data?.commission_percentage ?? null);
      } catch (error) {
        console.error("Error fetching commission:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCommission();
  }, [userId, barbershopId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("user_barbershop_roles")
        .update({ commission_percentage: commission })
        .eq("user_id", userId)
        .eq("barbershop_id", barbershopId);

      if (error) throw error;
      toast.success("Comissão atualizada com sucesso!");
    } catch (error) {
      console.error("Error saving commission:", error);
      toast.error("Erro ao salvar comissão");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-lg border bg-muted/30">
        <div className="flex items-center gap-2 mb-4">
          <Percent className="w-5 h-5 text-primary" />
          <h3 className="font-medium">Porcentagem de Comissão</h3>
        </div>
        
        <p className="text-sm text-muted-foreground mb-4">
          Defina a porcentagem de comissão que este profissional receberá sobre cada serviço realizado.
        </p>

        <div className="flex items-center gap-3">
          <div className="flex-1 max-w-[200px]">
            <Label htmlFor="commission" className="sr-only">Comissão</Label>
            <div className="relative">
              <Input
                id="commission"
                type="number"
                min="0"
                max="100"
                placeholder="0"
                value={commission ?? ""}
                onChange={(e) => setCommission(e.target.value === "" ? null : Number(e.target.value))}
                disabled={isReadOnly}
                className="pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                %
              </span>
            </div>
          </div>
          
          {!isReadOnly && (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Salvar
            </Button>
          )}
        </div>
      </div>

      <div className="text-sm text-muted-foreground space-y-2">
        <p>💡 <strong>Dica:</strong> A comissão será calculada automaticamente quando um atendimento for marcado como concluído.</p>
        <p>O valor da comissão é baseado no preço do serviço realizado.</p>
      </div>
    </div>
  );
}
