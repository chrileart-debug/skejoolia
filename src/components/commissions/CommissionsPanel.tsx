import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Wallet, CheckCircle2, User } from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CommissionsPanelProps {
  barbershopId: string;
}

interface CommissionSummary {
  user_id: string;
  user_name: string;
  pending_count: number;
  pending_amount: number;
  paid_amount: number;
}

export function CommissionsPanel({ barbershopId }: CommissionsPanelProps) {
  const queryClient = useQueryClient();
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isPaying, setIsPaying] = useState(false);

  const currentMonth = new Date();
  const monthStart = startOfMonth(currentMonth).toISOString();
  const monthEnd = endOfMonth(currentMonth).toISOString();

  // Fetch commission summary by user
  const { data: commissions = [], isLoading } = useQuery({
    queryKey: ["commissions-summary", barbershopId, monthStart],
    queryFn: async () => {
      // Get all commissions for this month
      const { data: commissionsData, error } = await supabase
        .from("commissions")
        .select("*")
        .eq("barbershop_id", barbershopId)
        .gte("created_at", monthStart)
        .lte("created_at", monthEnd);

      if (error) throw error;

      // Get user names
      const userIds = [...new Set((commissionsData || []).map(c => c.user_id))];
      
      let userNames: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: settings } = await supabase
          .from("user_settings")
          .select("user_id, nome")
          .in("user_id", userIds);
        
        if (settings) {
          settings.forEach(s => {
            userNames[s.user_id] = s.nome || "Profissional";
          });
        }
      }

      // Group by user
      const summaryMap: Record<string, CommissionSummary> = {};
      
      (commissionsData || []).forEach(c => {
        if (!summaryMap[c.user_id]) {
          summaryMap[c.user_id] = {
            user_id: c.user_id,
            user_name: userNames[c.user_id] || "Profissional",
            pending_count: 0,
            pending_amount: 0,
            paid_amount: 0,
          };
        }
        
        if (c.status === "pending") {
          summaryMap[c.user_id].pending_count++;
          summaryMap[c.user_id].pending_amount += Number(c.commission_amount);
        } else {
          summaryMap[c.user_id].paid_amount += Number(c.commission_amount);
        }
      });

      return Object.values(summaryMap).filter(s => s.pending_count > 0);
    },
    enabled: !!barbershopId,
  });

  const handleToggleUser = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handlePaySelected = async () => {
    if (selectedUsers.length === 0) {
      toast.error("Selecione pelo menos um profissional");
      return;
    }

    setIsPaying(true);

    try {
      const { error } = await supabase
        .from("commissions")
        .update({ 
          status: "paid",
          paid_at: new Date().toISOString()
        })
        .eq("barbershop_id", barbershopId)
        .eq("status", "pending")
        .in("user_id", selectedUsers)
        .gte("created_at", monthStart)
        .lte("created_at", monthEnd);

      if (error) throw error;

      toast.success(`Comissões pagas para ${selectedUsers.length} profissional(is)`);
      setSelectedUsers([]);
      queryClient.invalidateQueries({ queryKey: ["commissions-summary"] });
    } catch (error) {
      console.error("Error paying commissions:", error);
      toast.error("Erro ao pagar comissões");
    } finally {
      setIsPaying(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const totalPending = commissions.reduce((sum, c) => sum + c.pending_amount, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" />
              Comissões Pendentes
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
            </p>
          </div>
          {totalPending > 0 && (
            <Badge variant="secondary" className="text-base px-3 py-1">
              {formatCurrency(totalPending)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {commissions.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-green-500" />
            <p>Todas as comissões foram pagas!</p>
          </div>
        ) : (
          <>
            {commissions.map((commission) => (
              <div 
                key={commission.user_id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={selectedUsers.includes(commission.user_id)}
                    onCheckedChange={() => handleToggleUser(commission.user_id)}
                  />
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{commission.user_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {commission.pending_count} atendimento{commission.pending_count !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <p className="font-semibold text-primary">
                  {formatCurrency(commission.pending_amount)}
                </p>
              </div>
            ))}

            <Button
              onClick={handlePaySelected}
              disabled={selectedUsers.length === 0 || isPaying}
              className="w-full mt-4"
            >
              {isPaying ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Pagando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Marcar Selecionados como Pagos
                </>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
