import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBarbershop } from "@/hooks/useBarbershop";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  Wallet,
  CheckCircle2,
  User,
  Clock,
  Calendar,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import {
  format,
  startOfMonth,
  endOfMonth,
  subMonths,
  parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";

interface Commission {
  id: string;
  user_id: string;
  appointment_id: string;
  service_id: string | null;
  service_amount: number;
  commission_percentage: number;
  commission_amount: number;
  status: string;
  created_at: string;
  paid_at: string | null;
}

interface CommissionWithDetails extends Commission {
  service_name?: string;
  client_name?: string;
  professional_name?: string;
}

interface CommissionSummary {
  user_id: string;
  user_name: string;
  pending_count: number;
  pending_amount: number;
  paid_amount: number;
}

export default function Commissions() {
  const { barbershop, isOwner } = useBarbershop();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isPaying, setIsPaying] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(0); // 0 = current, 1 = last month, etc.

  const currentDate = subMonths(new Date(), selectedMonth);
  const monthStart = startOfMonth(currentDate).toISOString();
  const monthEnd = endOfMonth(currentDate).toISOString();

  const monthOptions = [
    { value: "0", label: format(new Date(), "MMMM yyyy", { locale: ptBR }) },
    { value: "1", label: format(subMonths(new Date(), 1), "MMMM yyyy", { locale: ptBR }) },
    { value: "2", label: format(subMonths(new Date(), 2), "MMMM yyyy", { locale: ptBR }) },
    { value: "3", label: format(subMonths(new Date(), 3), "MMMM yyyy", { locale: ptBR }) },
  ];

  // Fetch commission summary for owner (grouped by user)
  const { data: commissionSummary = [], isLoading: isLoadingSummary } = useQuery({
    queryKey: ["commissions-summary", barbershop?.id, monthStart],
    queryFn: async () => {
      if (!barbershop?.id) return [];

      const { data: commissionsData, error } = await supabase
        .from("commissions")
        .select("*")
        .eq("barbershop_id", barbershop.id)
        .gte("created_at", monthStart)
        .lte("created_at", monthEnd);

      if (error) throw error;

      // Get user names
      const userIds = [...new Set((commissionsData || []).map((c) => c.user_id))];

      let userNames: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: settings } = await supabase
          .from("user_settings")
          .select("user_id, nome")
          .in("user_id", userIds);

        if (settings) {
          settings.forEach((s) => {
            userNames[s.user_id] = s.nome || "Profissional";
          });
        }
      }

      // Group by user
      const summaryMap: Record<string, CommissionSummary> = {};

      (commissionsData || []).forEach((c) => {
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

      return Object.values(summaryMap);
    },
    enabled: !!barbershop?.id && isOwner,
  });

  // Fetch detailed commissions (for staff or owner history)
  const { data: detailedCommissions = [], isLoading: isLoadingDetails } = useQuery({
    queryKey: ["commissions-details", barbershop?.id, user?.id, isOwner, monthStart],
    queryFn: async () => {
      if (!barbershop?.id || !user?.id) return [];

      let query = supabase
        .from("commissions")
        .select("*")
        .eq("barbershop_id", barbershop.id)
        .gte("created_at", monthStart)
        .lte("created_at", monthEnd)
        .order("created_at", { ascending: false });

      // Staff only sees their own commissions
      if (!isOwner) {
        query = query.eq("user_id", user.id);
      }

      const { data: commissionsData, error } = await query;
      if (error) throw error;

      // Get service names
      const serviceIds = [...new Set((commissionsData || []).filter(c => c.service_id).map((c) => c.service_id))];
      let serviceNames: Record<string, string> = {};
      if (serviceIds.length > 0) {
        const { data: services } = await supabase
          .from("services")
          .select("id, name")
          .in("id", serviceIds as string[]);

        if (services) {
          services.forEach((s) => {
            serviceNames[s.id] = s.name;
          });
        }
      }

      // Get appointment details for client names
      const appointmentIds = [...new Set((commissionsData || []).map((c) => c.appointment_id))];
      let clientNames: Record<string, string> = {};
      if (appointmentIds.length > 0) {
        const { data: appointments } = await supabase
          .from("agendamentos")
          .select("id_agendamento, nome_cliente")
          .in("id_agendamento", appointmentIds);

        if (appointments) {
          appointments.forEach((a) => {
            clientNames[a.id_agendamento] = a.nome_cliente || "Cliente";
          });
        }
      }

      return (commissionsData || []).map((c) => ({
        ...c,
        service_name: c.service_id ? serviceNames[c.service_id] : "Serviço",
        client_name: clientNames[c.appointment_id] || "Cliente",
      })) as CommissionWithDetails[];
    },
    enabled: !!barbershop?.id && !!user?.id,
  });

  const handleToggleUser = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handlePaySelected = async () => {
    if (selectedUsers.length === 0 || !barbershop?.id) {
      toast.error("Selecione pelo menos um profissional");
      return;
    }

    setIsPaying(true);

    try {
      const { error } = await supabase
        .from("commissions")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
        })
        .eq("barbershop_id", barbershop.id)
        .eq("status", "pending")
        .in("user_id", selectedUsers)
        .gte("created_at", monthStart)
        .lte("created_at", monthEnd);

      if (error) throw error;

      toast.success(`Comissões pagas para ${selectedUsers.length} profissional(is)`);
      setSelectedUsers([]);
      queryClient.invalidateQueries({ queryKey: ["commissions-summary"] });
      queryClient.invalidateQueries({ queryKey: ["commissions-details"] });
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

  const pendingCommissions = commissionSummary.filter((c) => c.pending_count > 0);
  const totalPending = pendingCommissions.reduce((sum, c) => sum + c.pending_amount, 0);
  const totalPaid = commissionSummary.reduce((sum, c) => sum + c.paid_amount, 0);

  // Staff stats
  const staffPending = detailedCommissions
    .filter((c) => c.status === "pending")
    .reduce((sum, c) => sum + Number(c.commission_amount), 0);
  const staffPaid = detailedCommissions
    .filter((c) => c.status === "paid")
    .reduce((sum, c) => sum + Number(c.commission_amount), 0);

  const isLoading = isLoadingSummary || isLoadingDetails;

  if (!barbershop) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto py-6 px-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="w-6 h-6 text-primary" />
            Comissões
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isOwner
              ? "Gerencie as comissões da sua equipe"
              : "Acompanhe suas comissões"}
          </p>
        </div>

        <Select
          value={String(selectedMonth)}
          onValueChange={(v) => setSelectedMonth(Number(v))}
        >
          <SelectTrigger className="w-[180px]">
            <Calendar className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label.charAt(0).toUpperCase() + opt.label.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pendente</p>
                <p className="text-xl font-bold text-amber-500">
                  {formatCurrency(isOwner ? totalPending : staffPending)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pago</p>
                <p className="text-xl font-bold text-green-500">
                  {formatCurrency(isOwner ? totalPaid : staffPaid)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : isOwner ? (
        // Owner View - Tabs for pending and history
        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pending">
              Pendentes
              {pendingCommissions.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {pendingCommissions.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4">
            {pendingCommissions.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center text-muted-foreground">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-500" />
                    <p className="font-medium">Todas as comissões foram pagas!</p>
                    <p className="text-sm mt-1">
                      Nenhuma comissão pendente em{" "}
                      {format(currentDate, "MMMM yyyy", { locale: ptBR })}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Profissionais com Comissões Pendentes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {pendingCommissions.map((commission) => (
                    <div
                      key={commission.user_id}
                      className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedUsers.includes(commission.user_id)}
                          onCheckedChange={() =>
                            handleToggleUser(commission.user_id)
                          }
                        />
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{commission.user_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {commission.pending_count} atendimento
                            {commission.pending_count !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                      <p className="text-lg font-bold text-primary">
                        {formatCurrency(commission.pending_amount)}
                      </p>
                    </div>
                  ))}

                  <Button
                    onClick={handlePaySelected}
                    disabled={selectedUsers.length === 0 || isPaying}
                    className="w-full mt-4"
                    size="lg"
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
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Histórico de Comissões
                </CardTitle>
              </CardHeader>
              <CardContent>
                {detailedCommissions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma comissão registrada neste período
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Serviço</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailedCommissions.map((commission) => (
                          <TableRow key={commission.id}>
                            <TableCell className="whitespace-nowrap">
                              {format(parseISO(commission.created_at), "dd/MM/yy HH:mm")}
                            </TableCell>
                            <TableCell>{commission.client_name}</TableCell>
                            <TableCell>{commission.service_name}</TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(Number(commission.commission_amount))}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  commission.status === "paid"
                                    ? "default"
                                    : "secondary"
                                }
                                className={
                                  commission.status === "paid"
                                    ? "bg-green-500/10 text-green-600 hover:bg-green-500/20"
                                    : "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
                                }
                              >
                                {commission.status === "paid" ? "Pago" : "Pendente"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        // Staff View - List of their commissions
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Suas Comissões</CardTitle>
          </CardHeader>
          <CardContent>
            {detailedCommissions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma comissão registrada neste período
              </p>
            ) : (
              <div className="space-y-3">
                {detailedCommissions.map((commission) => (
                  <div
                    key={commission.id}
                    className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium truncate">
                          {commission.service_name}
                        </p>
                        <Badge
                          variant="outline"
                          className={
                            commission.status === "paid"
                              ? "border-green-500/50 text-green-600"
                              : "border-amber-500/50 text-amber-600"
                          }
                        >
                          {commission.status === "paid" ? "Pago" : "Pendente"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {commission.client_name} •{" "}
                        {format(parseISO(commission.created_at), "dd/MM HH:mm")}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {commission.commission_percentage}% de{" "}
                        {formatCurrency(Number(commission.service_amount))}
                      </p>
                    </div>
                    <p className="text-lg font-bold text-primary ml-4">
                      {formatCurrency(Number(commission.commission_amount))}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
