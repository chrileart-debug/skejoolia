import { useState, useEffect } from "react";
import { Percent, Loader2, Save, Wallet, Clock, TrendingUp, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  const navigate = useNavigate();
  const [commission, setCommission] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const currentMonth = new Date();
  const monthStart = startOfMonth(currentMonth).toISOString();
  const monthEnd = endOfMonth(currentMonth).toISOString();

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

  // Fetch commission earnings for this user
  const { data: earnings } = useQuery({
    queryKey: ["staff-commission-earnings", userId, barbershopId, monthStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commissions")
        .select("*")
        .eq("barbershop_id", barbershopId)
        .eq("user_id", userId)
        .gte("created_at", monthStart)
        .lte("created_at", monthEnd)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;

      const pending = (data || [])
        .filter(c => c.status === "pending")
        .reduce((sum, c) => sum + Number(c.commission_amount), 0);
      
      const paid = (data || [])
        .filter(c => c.status === "paid")
        .reduce((sum, c) => sum + Number(c.commission_amount), 0);

      return { 
        pending, 
        paid, 
        recent: data || [],
        total: pending + paid
      };
    },
    enabled: !!userId && !!barbershopId,
  });

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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
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
      {/* Commission Percentage Config - Only visible for owner */}
      {!isReadOnly && (
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
            
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Salvar
            </Button>
          </div>
        </div>
      )}

      {/* Current Commission Rate - visible for staff (read only) */}
      {isReadOnly && commission !== null && (
        <div className="p-4 rounded-lg border bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Percent className="w-5 h-5 text-primary" />
              <h3 className="font-medium">Sua Taxa de Comissão</h3>
            </div>
            <Badge variant="secondary" className="text-lg px-3 py-1">
              {commission}%
            </Badge>
          </div>
        </div>
      )}

      {/* Earnings Summary */}
      {earnings && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" />
              Comissões - {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border bg-amber-500/5 border-amber-500/20">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-amber-500" />
                <span className="text-sm text-muted-foreground">Pendente</span>
              </div>
              <p className="text-lg font-bold text-amber-600">
                {formatCurrency(earnings.pending)}
              </p>
            </div>

            <div className="p-3 rounded-lg border bg-green-500/5 border-green-500/20">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="text-sm text-muted-foreground">Pago</span>
              </div>
              <p className="text-lg font-bold text-green-600">
                {formatCurrency(earnings.paid)}
              </p>
            </div>
          </div>

          {/* Recent commissions list */}
          {earnings.recent.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Últimas comissões:</p>
              {earnings.recent.slice(0, 3).map((c: any) => (
                <div key={c.id} className="flex items-center justify-between p-2 rounded bg-muted/50 text-sm">
                  <span className="text-muted-foreground">
                    {format(parseISO(c.created_at), "dd/MM HH:mm")}
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={
                        c.status === "paid"
                          ? "border-green-500/50 text-green-600"
                          : "border-amber-500/50 text-amber-600"
                      }
                    >
                      {c.status === "paid" ? "Pago" : "Pendente"}
                    </Badge>
                    <span className="font-medium">
                      {formatCurrency(Number(c.commission_amount))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Link to full commissions page */}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate("/commissions")}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Ver Histórico Completo
          </Button>
        </div>
      )}

      <div className="text-sm text-muted-foreground space-y-2">
        <p>💡 <strong>Dica:</strong> A comissão é calculada automaticamente quando um atendimento é concluído.</p>
      </div>
    </div>
  );
}
