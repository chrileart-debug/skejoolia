import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Users, Phone, Bot, Scissors, DollarSign, Calendar, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";

interface OutletContextType {
  onMenuClick: () => void;
}

interface Cliente {
  client_id: string;
  nome: string | null;
  telefone: string | null;
  id_agente: string | null;
  total_cortes: number;
  faturamento_total: number;
  agente_nome?: string | null;
  has_active_appointment?: boolean;
}

export default function Clients() {
  const { onMenuClick } = useOutletContext<OutletContextType>();
  const { user } = useAuth();
  const [clients, setClients] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (user) {
      loadClients();
    }
  }, [user]);

  async function loadClients() {
    if (!user) return;
    setLoading(true);

    try {
      // Fetch clients
      const { data: clientsData, error: clientsError } = await supabase
        .from("clientes")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (clientsError) throw clientsError;

      // Fetch agents for mapping
      const { data: agentsData } = await supabase
        .from("agentes")
        .select("id_agente, nome")
        .eq("user_id", user.id);

      const agentsMap = new Map(
        agentsData?.map((a) => [a.id_agente, a.nome]) || []
      );

      // Fetch active appointments (pending or confirmed, future dates)
      const now = new Date().toISOString();
      const { data: appointmentsData } = await supabase
        .from("agendamentos")
        .select("client_id")
        .eq("user_id", user.id)
        .gte("start_time", now)
        .in("status", ["pending", "confirmed"]);

      const activeAppointmentClientIds = new Set(
        appointmentsData?.map((a) => a.client_id) || []
      );

      // Map clients with agent names and appointment status
      const enrichedClients: Cliente[] = (clientsData || []).map((client) => ({
        ...client,
        agente_nome: client.id_agente ? agentsMap.get(client.id_agente) : null,
        has_active_appointment: activeAppointmentClientIds.has(client.client_id),
      }));

      setClients(enrichedClients);
    } catch (error) {
      console.error("Error loading clients:", error);
    } finally {
      setLoading(false);
    }
  }

  const filteredClients = clients.filter((client) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      client.nome?.toLowerCase().includes(searchLower) ||
      client.telefone?.includes(searchTerm) ||
      client.agente_nome?.toLowerCase().includes(searchLower)
    );
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value || 0);
  };

  const formatPhone = (phone: string | null) => {
    if (!phone) return "—";
    // Format Brazilian phone: 55 11 99999-9999
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 13) {
      return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    }
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  return (
    <div className="flex flex-col min-h-screen pb-20 lg:pb-0">
      <Header
        title="Clientes"
        subtitle="Gerencie seus clientes"
        onMenuClick={onMenuClick}
      />

      <main className="flex-1 p-4 lg:p-6 space-y-6">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone ou agente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="bg-card/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Users className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{clients.length}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Calendar className="w-4 h-4 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {clients.filter((c) => c.has_active_appointment).length}
                  </p>
                  <p className="text-xs text-muted-foreground">Com agenda</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Scissors className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {clients.reduce((sum, c) => sum + (c.total_cortes || 0), 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">Cortes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <DollarSign className="w-4 h-4 text-emerald-500" />
                </div>
                <div>
                  <p className="text-lg font-bold">
                    {formatCurrency(
                      clients.reduce((sum, c) => sum + (c.faturamento_total || 0), 0)
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">Faturamento</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Clients List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <Skeleton className="w-12 h-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredClients.length === 0 ? (
          <EmptyState
            icon={<Users className="w-10 h-10 text-muted-foreground" />}
            title={searchTerm ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
            description={
              searchTerm
                ? "Tente buscar com outros termos"
                : "Seus clientes aparecerão aqui quando fizerem agendamentos"
            }
          />
        ) : (
          <div className="space-y-3">
            {filteredClients.map((client) => (
              <Card
                key={client.client_id}
                className="hover:bg-accent/50 transition-colors"
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-primary font-semibold text-lg">
                        {client.nome
                          ? client.nome.charAt(0).toUpperCase()
                          : "?"}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-foreground truncate">
                          {client.nome || "Cliente sem nome"}
                        </h3>
                        {client.has_active_appointment && (
                          <Badge variant="default" className="text-xs bg-green-500/20 text-green-600 hover:bg-green-500/30">
                            Agenda ativa
                          </Badge>
                        )}
                      </div>

                      {/* Phone */}
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                        <Phone className="w-3.5 h-3.5" />
                        <span>{formatPhone(client.telefone)}</span>
                      </div>

                      {/* Agent */}
                      {client.agente_nome && (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                          <Bot className="w-3.5 h-3.5" />
                          <span>Atendido por {client.agente_nome}</span>
                        </div>
                      )}

                      {/* Stats */}
                      <div className="flex items-center gap-4 mt-3">
                        <div className="flex items-center gap-1.5 text-sm">
                          <Scissors className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="font-medium">{client.total_cortes || 0}</span>
                          <span className="text-muted-foreground">cortes</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-sm">
                          <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="font-medium text-emerald-600">
                            {formatCurrency(client.faturamento_total)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
