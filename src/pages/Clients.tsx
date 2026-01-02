import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { 
  Users, Phone, Bot, Scissors, DollarSign, Calendar, Search, 
  UserPlus, Pencil, Trash2, Crown, Mail, CreditCard, MapPin, 
  Clock, FileText, Sparkles, RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSetPageHeader } from "@/contexts/PageHeaderContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { EmptyState } from "@/components/shared/EmptyState";
import { FAB } from "@/components/shared/FAB";
import { ManualSubscriptionModal } from "@/components/club/ManualSubscriptionModal";
import { VipBadge, VipCrown } from "@/components/club/VipBadge";
import { RenewalModal } from "@/components/club/RenewalModal";
import { toast } from "sonner";

interface Barbershop {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  is_active: boolean;
}

interface OutletContextType {
  onMenuClick: () => void;
  barbershop: Barbershop | null;
}

interface Cliente {
  client_id: string;
  nome: string | null;
  telefone: string | null;
  email: string | null;
  cpf_cnpj: string | null;
  birth_date: string | null;
  notes: string | null;
  endereco: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  last_visit: string | null;
  id_agente: string | null;
  total_cortes: number;
  faturamento_total: number;
  agente_ativo: boolean;
  agente_nome?: string | null;
  has_active_appointment?: boolean;
  // Subscription fields
  has_subscription?: boolean;
  subscription_id?: string | null;
  plan_id?: string | null;
  plan_name?: string | null;
  plan_price?: number | null;
  subscription_status?: string | null;
  next_due_date?: string | null;
  payment_origin?: string | null;
}

interface Agente {
  id_agente: string;
  nome: string;
}

interface ServiceCredit {
  serviceId: string;
  serviceName: string;
  quantityLimit: number;
  currentUsage: number;
  remaining: number;
}

export default function Clients() {
  const { barbershop } = useOutletContext<OutletContextType>();
  const { user } = useAuth();
  
  useSetPageHeader("Clientes", "Gerencie seus clientes");
  const [clients, setClients] = useState<Cliente[]>([]);
  const [agents, setAgents] = useState<Agente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    telefone: "",
    id_agente: "",
  });
  const [saving, setSaving] = useState(false);
  const [editingClient, setEditingClient] = useState<Cliente | null>(null);
  const [deleteClientId, setDeleteClientId] = useState<string | null>(null);
  
  // New states for client details modal
  const [viewingClient, setViewingClient] = useState<Cliente | null>(null);
  const [clientCredits, setClientCredits] = useState<ServiceCredit[]>([]);
  const [loadingCredits, setLoadingCredits] = useState(false);
  
  // Manual subscription modal state
  const [vipModalOpen, setVipModalOpen] = useState(false);
  const [vipClient, setVipClient] = useState<Cliente | null>(null);
  
  // Renewal modal state
  const [renewalModalOpen, setRenewalModalOpen] = useState(false);
  const [renewalClient, setRenewalClient] = useState<Cliente | null>(null);

  useEffect(() => {
    if (user && barbershop) {
      loadClients();
      loadAgents();
    }
  }, [user, barbershop]);

  // Load credits when viewing a client with subscription
  useEffect(() => {
    if (viewingClient?.has_subscription && viewingClient.subscription_id) {
      loadClientCredits(viewingClient.subscription_id, viewingClient.plan_id!);
    } else {
      setClientCredits([]);
    }
  }, [viewingClient]);

  async function loadClients() {
    if (!user || !barbershop) return;
    setLoading(true);

    try {
      // Fetch clients with subscription data
      const { data: clientsData, error: clientsError } = await supabase
        .from("clientes")
        .select(`
          *,
          client_club_subscriptions!client_club_subscriptions_client_id_fkey (
            id,
            status,
            plan_id,
            next_due_date,
            payment_origin,
            barber_plans (
              name,
              price
            )
          )
        `)
        .eq("barbershop_id", barbershop.id)
        .order("created_at", { ascending: false });

      if (clientsError) throw clientsError;

      // Fetch agents for mapping
      const { data: agentsData } = await supabase
        .from("agentes")
        .select("id_agente, nome")
        .eq("barbershop_id", barbershop.id);

      const agentsMap = new Map(
        agentsData?.map((a) => [a.id_agente, a.nome]) || []
      );

      // Fetch active appointments (pending or confirmed, future dates)
      const now = new Date().toISOString();
      const { data: appointmentsData } = await supabase
        .from("agendamentos")
        .select("client_id")
        .eq("barbershop_id", barbershop.id)
        .gte("start_time", now)
        .in("status", ["pending", "confirmed"]);

      const activeAppointmentClientIds = new Set(
        appointmentsData?.map((a) => a.client_id) || []
      );

      // Map clients with agent names, appointment status, and subscription data
      const enrichedClients: Cliente[] = (clientsData || []).map((client) => {
        const subscriptions = client.client_club_subscriptions as any[];
        const activeSubscription = subscriptions?.find((s) => s.status === "active");
        
        return {
          ...client,
          agente_nome: client.id_agente ? agentsMap.get(client.id_agente) : null,
          has_active_appointment: activeAppointmentClientIds.has(client.client_id),
          has_subscription: !!activeSubscription,
          subscription_id: activeSubscription?.id || null,
          plan_id: activeSubscription?.plan_id || null,
          plan_name: activeSubscription?.barber_plans?.name || null,
          plan_price: activeSubscription?.barber_plans?.price || null,
          subscription_status: activeSubscription?.status || null,
          next_due_date: activeSubscription?.next_due_date || null,
          payment_origin: activeSubscription?.payment_origin || null,
        };
      });

      setClients(enrichedClients);
    } catch (error) {
      console.error("Error loading clients:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadAgents() {
    if (!user || !barbershop) return;

    const { data, error } = await supabase
      .from("agentes")
      .select("id_agente, nome")
      .eq("barbershop_id", barbershop.id)
      .order("nome", { ascending: true });

    if (error) {
      console.error("Error loading agents:", error);
    } else {
      setAgents(data || []);
    }
  }

  async function loadClientCredits(subscriptionId: string, planId: string) {
    setLoadingCredits(true);

    try {
      // Fetch plan items with service names
      const { data: planItems } = await supabase
        .from("barber_plan_items")
        .select("service_id, quantity_limit, services(name)")
        .eq("plan_id", planId);

      if (!planItems || planItems.length === 0) {
        setClientCredits([]);
        setLoadingCredits(false);
        return;
      }

      // Get current month usage
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: usage } = await supabase
        .from("client_subscription_usage")
        .select("service_id")
        .eq("subscription_id", subscriptionId)
        .gte("used_at", startOfMonth.toISOString());

      // Count usage per service
      const usageCount = new Map<string, number>();
      usage?.forEach((u) => {
        usageCount.set(u.service_id, (usageCount.get(u.service_id) || 0) + 1);
      });

      // Calculate credits
      const credits: ServiceCredit[] = planItems.map((item) => {
        const limit = item.quantity_limit || 0;
        const used = usageCount.get(item.service_id) || 0;
        return {
          serviceId: item.service_id,
          serviceName: (item.services as any)?.name || "Serviço",
          quantityLimit: limit,
          currentUsage: used,
          remaining: limit === 0 ? Infinity : Math.max(0, limit - used),
        };
      });

      setClientCredits(credits);
    } catch (error) {
      console.error("Error loading client credits:", error);
      setClientCredits([]);
    } finally {
      setLoadingCredits(false);
    }
  }

  async function toggleAgenteAtivo(clientId: string, currentValue: boolean) {
    const newValue = !currentValue;
    
    // Optimistic update
    setClients((prev) =>
      prev.map((c) =>
        c.client_id === clientId ? { ...c, agente_ativo: newValue } : c
      )
    );

    // Also update viewing client if open
    if (viewingClient?.client_id === clientId) {
      setViewingClient({ ...viewingClient, agente_ativo: newValue });
    }

    const { error } = await supabase
      .from("clientes")
      .update({ agente_ativo: newValue })
      .eq("client_id", clientId);

    if (error) {
      // Revert on error
      setClients((prev) =>
        prev.map((c) =>
          c.client_id === clientId ? { ...c, agente_ativo: currentValue } : c
        )
      );
      if (viewingClient?.client_id === clientId) {
        setViewingClient({ ...viewingClient, agente_ativo: currentValue });
      }
      toast.error("Erro ao atualizar status do agente");
      console.error("Error toggling agente_ativo:", error);
    } else {
      toast.success(newValue ? "Agente ativado" : "Agente desativado");
    }
  }

  const handleCreate = () => {
    setEditingClient(null);
    setFormData({ nome: "", telefone: "", id_agente: "" });
    setIsDialogOpen(true);
  };

  const handleEdit = (client: Cliente) => {
    setEditingClient(client);
    setFormData({
      nome: client.nome || "",
      telefone: client.telefone || "",
      id_agente: client.id_agente || "",
    });
    setViewingClient(null);
    setIsDialogOpen(true);
  };

  const handleViewClient = (client: Cliente) => {
    setViewingClient(client);
  };

  const handleSubmit = async () => {
    if (!formData.nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    if (!user || !barbershop) {
      toast.error("Você precisa estar logado");
      return;
    }

    setSaving(true);

    if (editingClient) {
      // Update existing client
      const { error } = await supabase
        .from("clientes")
        .update({
          nome: formData.nome.trim(),
          telefone: formData.telefone.trim() || null,
          id_agente: formData.id_agente || null,
        })
        .eq("client_id", editingClient.client_id);

      setSaving(false);

      if (error) {
        console.error("Error updating client:", error);
        toast.error("Erro ao atualizar cliente");
      } else {
        toast.success("Cliente atualizado com sucesso");
        setIsDialogOpen(false);
        setEditingClient(null);
        loadClients();
      }
    } else {
      // Upsert new client: insert or update on conflict (barbershop_id, telefone)
      const phoneClean = formData.telefone.trim().replace(/\D/g, "") || null;
      
      const { error } = await supabase
        .from("clientes")
        .upsert(
          {
            user_id: user.id,
            barbershop_id: barbershop.id,
            nome: formData.nome.trim(),
            telefone: phoneClean,
            id_agente: formData.id_agente || null,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "barbershop_id,telefone",
            ignoreDuplicates: false,
          }
        );

      setSaving(false);

      if (error) {
        console.error("Error creating client:", error);
        toast.error("Erro ao criar cliente");
      } else {
        toast.success("Cliente cadastrado com sucesso");
        setIsDialogOpen(false);
        loadClients();
      }
    }
  };

  const handleDelete = async () => {
    if (!deleteClientId) return;

    const { error } = await supabase
      .from("clientes")
      .delete()
      .eq("client_id", deleteClientId);

    if (error) {
      console.error("Error deleting client:", error);
      toast.error("Erro ao excluir cliente");
    } else {
      toast.success("Cliente excluído");
      setDeleteClientId(null);
      loadClients();
    }
  };

  const filteredClients = clients.filter((client) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      client.nome?.toLowerCase().includes(searchLower) ||
      client.telefone?.includes(searchTerm) ||
      client.agente_nome?.toLowerCase().includes(searchLower) ||
      client.plan_name?.toLowerCase().includes(searchLower)
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
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 13) {
      return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    }
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  const formatCpfCnpj = (value: string | null) => {
    if (!value) return "—";
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length === 11) {
      return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9)}`;
    }
    if (cleaned.length === 14) {
      return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5, 8)}/${cleaned.slice(8, 12)}-${cleaned.slice(12)}`;
    }
    return value;
  };

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("pt-BR");
  };

  const formatDateTime = (date: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getFullAddress = (client: Cliente) => {
    const parts = [];
    if (client.endereco) parts.push(client.endereco);
    if (client.numero) parts.push(client.numero);
    if (client.bairro) parts.push(client.bairro);
    if (client.cidade) parts.push(client.cidade);
    if (client.estado) parts.push(client.estado);
    if (client.cep) parts.push(`CEP: ${client.cep}`);
    return parts.length > 0 ? parts.join(", ") : null;
  };

  return (
    <div className="flex flex-col min-h-screen min-w-0 pb-20 lg:pb-0">
      <main className="flex-1 min-w-0 p-4 lg:p-6 space-y-6">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone, agente ou plano..."
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
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Crown className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {clients.filter((c) => c.has_subscription).length}
                  </p>
                  <p className="text-xs text-muted-foreground">Assinantes</p>
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
                : "Clique no botão + para cadastrar seu primeiro cliente"
            }
          />
        ) : (
          <div className="space-y-3">
            {filteredClients.map((client) => (
              <Card
                key={client.client_id}
                className="hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => handleViewClient(client)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Avatar with subscription badge */}
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-primary font-semibold">
                          {client.nome
                            ? client.nome.charAt(0).toUpperCase()
                            : "C"}
                        </span>
                      </div>
                      {client.has_subscription && (
                        <div className="absolute -top-1 -right-1">
                          <VipBadge 
                            status={client.subscription_status || ""} 
                            nextDueDate={client.next_due_date || null}
                            size="sm"
                          />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-foreground truncate">
                          {client.nome || "Cliente sem nome"}
                        </h3>
                        {client.has_subscription && (
                          <>
                            <VipCrown 
                              status={client.subscription_status || ""} 
                              nextDueDate={client.next_due_date || null}
                            />
                            <Badge className="text-xs bg-amber-500/20 text-amber-600 hover:bg-amber-500/30 shrink-0">
                              {client.plan_name}
                            </Badge>
                          </>
                        )}
                        {client.has_active_appointment && (
                          <Badge variant="default" className="text-xs bg-green-500/20 text-green-600 hover:bg-green-500/30 shrink-0">
                            Ativo
                          </Badge>
                        )}
                      </div>

                      {/* Phone */}
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                        <Phone className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{formatPhone(client.telefone)}</span>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span>{client.total_cortes || 0} cortes</span>
                        <span className="text-emerald-600 font-medium">
                          {formatCurrency(client.faturamento_total)}
                        </span>
                      </div>
                    </div>

                    {/* Agent Switch */}
                    <div 
                      className="flex items-center gap-2 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Bot className="w-4 h-4 text-muted-foreground" />
                      <Switch
                        checked={client.agente_ativo}
                        onCheckedChange={() => toggleAgenteAtivo(client.client_id, client.agente_ativo)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <FAB onClick={handleCreate} />

      {/* Client Details Modal */}
      <Dialog open={!!viewingClient} onOpenChange={(open) => !open && setViewingClient(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-4">
              {/* Large Avatar */}
              <div className="relative shrink-0">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl text-primary font-bold">
                    {viewingClient?.nome?.charAt(0).toUpperCase() || "C"}
                  </span>
                </div>
                {viewingClient?.has_subscription && (
                  <div className="absolute -bottom-1 -right-1">
                    <VipBadge 
                      status={viewingClient.subscription_status || ""} 
                      nextDueDate={viewingClient.next_due_date || null}
                      size="md"
                    />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-xl truncate">{viewingClient?.nome || "Cliente"}</DialogTitle>
                <p className="text-sm text-muted-foreground">{formatPhone(viewingClient?.telefone)}</p>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Contact Info */}
            <div className="grid grid-cols-2 gap-3">
              {viewingClient?.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="truncate">{viewingClient.email}</span>
                </div>
              )}
              {viewingClient?.cpf_cnpj && (
                <div className="flex items-center gap-2 text-sm">
                  <CreditCard className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span>{formatCpfCnpj(viewingClient.cpf_cnpj)}</span>
                </div>
              )}
              {viewingClient?.birth_date && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span>{formatDate(viewingClient.birth_date)}</span>
                </div>
              )}
              {viewingClient?.last_visit && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span>{formatDateTime(viewingClient.last_visit)}</span>
                </div>
              )}
            </div>

            {/* Address */}
            {viewingClient && getFullAddress(viewingClient) && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <span>{getFullAddress(viewingClient)}</span>
                </div>
              </div>
            )}

            {/* Subscription Plan & Credits */}
            {viewingClient?.has_subscription && (() => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const dueDate = viewingClient.next_due_date ? new Date(viewingClient.next_due_date) : null;
              if (dueDate) dueDate.setHours(0, 0, 0, 0);
              const isExpired = dueDate ? dueDate < today : false;
              
              return (
                <div className={`p-4 border rounded-xl ${isExpired ? 'bg-red-500/10 border-red-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <VipCrown 
                        status={viewingClient.subscription_status || ""} 
                        nextDueDate={viewingClient.next_due_date || null}
                        className="w-5 h-5"
                      />
                      <span className="font-semibold">{viewingClient.plan_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isExpired ? (
                        <Badge className="bg-red-500/20 text-red-600">Vencido</Badge>
                      ) : (
                        <Badge className="bg-emerald-500/20 text-emerald-600">Ativo</Badge>
                      )}
                    </div>
                  </div>
                  
                  {/* Due Date Info */}
                  {viewingClient.next_due_date && (
                    <p className={`text-xs mb-3 ${isExpired ? 'text-red-600' : 'text-muted-foreground'}`}>
                      {isExpired ? 'Venceu' : 'Vence'} em: {new Date(viewingClient.next_due_date).toLocaleDateString("pt-BR")}
                    </p>
                  )}
                  
                  {/* Renewal Button for Manual Subscriptions */}
                  {viewingClient.payment_origin === 'manual' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mb-3 gap-2"
                      onClick={() => {
                        setRenewalClient(viewingClient);
                        setRenewalModalOpen(true);
                      }}
                    >
                      <RefreshCw className="w-4 h-4" />
                      Renovar Assinatura
                    </Button>
                  )}
                  
                  {/* Service Credits */}
                  {loadingCredits ? (
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  ) : clientCredits.length > 0 ? (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground font-medium">Créditos do mês</p>
                      {clientCredits.map((credit) => (
                        <div key={credit.serviceId} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span>{credit.serviceName}</span>
                            <span className="font-medium">
                              {credit.quantityLimit === 0 
                                ? "∞" 
                                : `${credit.remaining}/${credit.quantityLimit}`}
                            </span>
                          </div>
                          <Progress 
                            value={credit.quantityLimit === 0 ? 100 : (credit.remaining / credit.quantityLimit) * 100} 
                            className="h-2"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhum serviço no plano</p>
                  )}
                </div>
              );
            })()}

            {/* Agent Toggle */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Atendimento por agente</span>
              </div>
              <Switch
                checked={viewingClient?.agente_ativo || false}
                onCheckedChange={() => {
                  if (viewingClient) {
                    toggleAgenteAtivo(viewingClient.client_id, viewingClient.agente_ativo);
                  }
                }}
              />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <p className="text-2xl font-bold">{viewingClient?.total_cortes || 0}</p>
                <p className="text-xs text-muted-foreground">Cortes</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <p className="text-lg font-bold text-emerald-600">
                  {formatCurrency(viewingClient?.faturamento_total || 0)}
                </p>
                <p className="text-xs text-muted-foreground">Faturamento</p>
              </div>
            </div>

            {/* Notes */}
            {viewingClient?.notes && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground">{viewingClient.notes}</p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              {/* Tornar VIP Button - Only show if client doesn't have subscription */}
              {!viewingClient?.has_subscription && (
                <Button 
                  className="flex-1 gap-2 bg-amber-500 hover:bg-amber-600 text-white"
                  onClick={() => {
                    setVipClient(viewingClient);
                    setVipModalOpen(true);
                  }}
                >
                  <Crown className="w-4 h-4" />
                  Tornar VIP
                </Button>
              )}
              <Button variant="outline" className="flex-1" onClick={() => handleEdit(viewingClient!)}>
                <Pencil className="w-4 h-4 mr-2" />
                Editar
              </Button>
              <Button 
                variant="outline" 
                size="icon"
                className="text-destructive hover:bg-destructive/10"
                onClick={() => {
                  setViewingClient(null);
                  setDeleteClientId(viewingClient!.client_id);
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Client Dialog (Create/Edit) */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) setEditingClient(null);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingClient ? <Pencil className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
              {editingClient ? "Editar Cliente" : "Novo Cliente"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                placeholder="Nome do cliente"
                value={formData.nome}
                onChange={(e) =>
                  setFormData({ ...formData, nome: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                placeholder="Telefone do cliente"
                value={formData.telefone}
                onChange={(e) =>
                  setFormData({ ...formData, telefone: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Agente Responsável</Label>
              <Select
                value={formData.id_agente}
                onValueChange={(value) =>
                  setFormData({ ...formData, id_agente: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o agente (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id_agente} value={agent.id_agente}>
                      {agent.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setIsDialogOpen(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button className="flex-1" onClick={handleSubmit} disabled={saving}>
                {saving ? "Salvando..." : editingClient ? "Salvar" : "Cadastrar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteClientId} onOpenChange={(open) => !open && setDeleteClientId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O cliente será permanentemente removido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Manual Subscription (VIP) Modal */}
      <ManualSubscriptionModal
        open={vipModalOpen}
        onClose={() => {
          setVipModalOpen(false);
          setVipClient(null);
        }}
        onSuccess={() => {
          loadClients();
          setViewingClient(null);
        }}
        barbershopId={barbershop?.id || ""}
        userId={user?.id || ""}
        client={vipClient ? {
          client_id: vipClient.client_id,
          nome: vipClient.nome,
          telefone: vipClient.telefone,
        } : null}
      />

      {/* Renewal Modal */}
      {renewalClient && (
        <RenewalModal
          open={renewalModalOpen}
          onClose={() => {
            setRenewalModalOpen(false);
            setRenewalClient(null);
          }}
          onSuccess={() => {
            loadClients();
            setViewingClient(null);
          }}
          subscriptionId={renewalClient.subscription_id || ""}
          clientName={renewalClient.nome || "Cliente"}
          planName={renewalClient.plan_name || "Plano"}
          planPrice={renewalClient.plan_price || 0}
          nextDueDate={renewalClient.next_due_date || ""}
          barbershopId={barbershop?.id || ""}
          clientId={renewalClient.client_id}
        />
      )}
    </div>
  );
}
