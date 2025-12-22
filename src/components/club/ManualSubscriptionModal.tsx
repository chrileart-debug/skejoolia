import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Crown, Loader2, Search, Check, ChevronsUpDown, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface BarberPlan {
  id: string;
  name: string;
  price: number;
  interval: string;
}

interface Client {
  client_id: string;
  nome: string | null;
  telefone: string | null;
}

interface ManualSubscriptionModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  barbershopId: string;
  userId: string;
  // If client is provided, it's for "Tornar VIP" flow (client already selected)
  client?: Client | null;
  // If true, show client search (for Club page flow)
  showClientSearch?: boolean;
}

export function ManualSubscriptionModal({
  open,
  onClose,
  onSuccess,
  barbershopId,
  userId,
  client,
  showClientSearch = false,
}: ManualSubscriptionModalProps) {
  const [plans, setPlans] = useState<BarberPlan[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [nextDueDate, setNextDueDate] = useState<string>("");
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");

  // Set default next_due_date to 30 days from now
  useEffect(() => {
    if (open) {
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 30);
      setNextDueDate(defaultDate.toISOString().split("T")[0]);
      
      // Reset selections
      setSelectedPlanId("");
      setSelectedClientId(client?.client_id || "");
      setClientSearch("");
    }
  }, [open, client]);

  // Fetch plans
  useEffect(() => {
    if (open && barbershopId) {
      fetchPlans();
    }
  }, [open, barbershopId]);

  // Fetch clients if showClientSearch is true
  useEffect(() => {
    if (open && barbershopId && showClientSearch) {
      fetchClients();
    }
  }, [open, barbershopId, showClientSearch]);

  const fetchPlans = async () => {
    setLoadingPlans(true);
    try {
      const { data, error } = await supabase
        .from("barber_plans")
        .select("id, name, price, interval")
        .eq("barbershop_id", barbershopId)
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error("Error fetching plans:", error);
      toast.error("Erro ao carregar planos");
    } finally {
      setLoadingPlans(false);
    }
  };

  const fetchClients = async () => {
    setLoadingClients(true);
    try {
      // Fetch clients without active subscriptions
      const { data: allClients, error: clientsError } = await supabase
        .from("clientes")
        .select("client_id, nome, telefone")
        .eq("barbershop_id", barbershopId)
        .order("nome", { ascending: true });

      if (clientsError) throw clientsError;

      // Fetch clients with active subscriptions
      const { data: activeSubscriptions, error: subError } = await supabase
        .from("client_club_subscriptions")
        .select("client_id")
        .eq("barbershop_id", barbershopId)
        .eq("status", "active");

      if (subError) throw subError;

      const activeClientIds = new Set(activeSubscriptions?.map(s => s.client_id) || []);
      
      // Filter out clients who already have active subscriptions
      const availableClients = (allClients || []).filter(
        c => !activeClientIds.has(c.client_id)
      );

      setClients(availableClients);
    } catch (error) {
      console.error("Error fetching clients:", error);
      toast.error("Erro ao carregar clientes");
    } finally {
      setLoadingClients(false);
    }
  };

  const formatPhone = (phone: string | null) => {
    if (!phone) return "";
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  // Filter clients based on search
  const filteredClients = useMemo(() => {
    if (!clientSearch) return clients;
    const searchLower = clientSearch.toLowerCase();
    return clients.filter(
      c => c.nome?.toLowerCase().includes(searchLower) || c.telefone?.includes(clientSearch)
    );
  }, [clients, clientSearch]);

  const selectedClient = useMemo(() => {
    if (client) return client;
    return clients.find(c => c.client_id === selectedClientId);
  }, [client, clients, selectedClientId]);

  const selectedPlan = useMemo(() => {
    return plans.find(p => p.id === selectedPlanId);
  }, [plans, selectedPlanId]);

  const handleSubmit = async () => {
    const clientId = client?.client_id || selectedClientId;
    
    if (!clientId) {
      toast.error("Selecione um cliente");
      return;
    }
    if (!selectedPlanId) {
      toast.error("Selecione um plano");
      return;
    }
    if (!nextDueDate) {
      toast.error("Defina a data de vencimento");
      return;
    }

    setSaving(true);

    try {
      // Check if client already has an active subscription
      const { data: activeSubscription, error: activeCheckError } = await supabase
        .from("client_club_subscriptions")
        .select("id")
        .eq("barbershop_id", barbershopId)
        .eq("client_id", clientId)
        .eq("status", "active")
        .maybeSingle();

      if (activeCheckError) throw activeCheckError;

      if (activeSubscription) {
        toast.error("Este cliente já possui uma assinatura ativa");
        setSaving(false);
        return;
      }

      // Check if there's a canceled subscription to reactivate
      const { data: canceledSubscription, error: canceledCheckError } = await supabase
        .from("client_club_subscriptions")
        .select("id")
        .eq("barbershop_id", barbershopId)
        .eq("client_id", clientId)
        .eq("status", "canceled")
        .maybeSingle();

      if (canceledCheckError) throw canceledCheckError;

      const planPrice = selectedPlan?.price || 0;
      let subscriptionId: string;

      if (canceledSubscription) {
        // REACTIVATE: Update existing canceled subscription
        const { error: updateError } = await supabase
          .from("client_club_subscriptions")
          .update({
            plan_id: selectedPlanId,
            status: "active",
            payment_origin: "manual",
            next_due_date: nextDueDate,
            updated_at: new Date().toISOString(),
          })
          .eq("id", canceledSubscription.id);

        if (updateError) throw updateError;

        subscriptionId = canceledSubscription.id;

        // Clear previous usage data
        await supabase
          .from("client_subscription_usage")
          .delete()
          .eq("subscription_id", subscriptionId);
      } else {
        // CREATE: New subscription record
        const { data: subscriptionData, error: subError } = await supabase
          .from("client_club_subscriptions")
          .insert({
            barbershop_id: barbershopId,
            client_id: clientId,
            plan_id: selectedPlanId,
            status: "active",
            payment_origin: "manual",
            next_due_date: nextDueDate,
          })
          .select("id")
          .single();

        if (subError) throw subError;
        subscriptionId = subscriptionData.id;
      }

      // Create transaction record (for both new and reactivated)
      const { error: transError } = await supabase
        .from("client_transactions")
        .insert({
          barbershop_id: barbershopId,
          client_id: clientId,
          subscription_id: subscriptionId,
          amount: planPrice,
          payment_method: "dinheiro",
          status: "pago",
        });

      if (transError) {
        // Rollback only for new subscriptions
        if (!canceledSubscription) {
          await supabase
            .from("client_club_subscriptions")
            .delete()
            .eq("id", subscriptionId);
        }
        throw transError;
      }

      toast.success(canceledSubscription ? "Assinatura reativada com sucesso!" : "Assinatura criada com sucesso!");
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Error creating subscription:", error);
      toast.error(error?.message || "Erro ao criar assinatura");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-500" />
            {client ? "Tornar Cliente VIP" : "Nova Assinatura Manual"}
          </DialogTitle>
          <DialogDescription>
            {client
              ? `Adicione ${client.nome || "este cliente"} a um plano de assinatura`
              : "Selecione um cliente e adicione-o a um plano de assinatura"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Client Selection (only if showClientSearch) */}
          {showClientSearch && !client && (
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Popover open={clientSearchOpen} onOpenChange={setClientSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={clientSearchOpen}
                    className="w-full justify-between"
                    disabled={loadingClients}
                  >
                    {loadingClients ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Carregando...
                      </span>
                    ) : selectedClient ? (
                      <span className="truncate">
                        {selectedClient.nome || "Cliente sem nome"} 
                        {selectedClient.telefone && (
                          <span className="text-muted-foreground ml-2">
                            ({formatPhone(selectedClient.telefone)})
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground flex items-center gap-2">
                        <Search className="w-4 h-4" />
                        Buscar cliente...
                      </span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[350px] p-0" align="start">
                  <Command>
                    <CommandInput 
                      placeholder="Buscar por nome ou telefone..." 
                      value={clientSearch}
                      onValueChange={setClientSearch}
                    />
                    <CommandList>
                      <CommandEmpty>
                        {clients.length === 0 
                          ? "Nenhum cliente disponível"
                          : "Nenhum cliente encontrado"}
                      </CommandEmpty>
                      <CommandGroup>
                        {filteredClients.map((c) => (
                          <CommandItem
                            key={c.client_id}
                            value={c.client_id}
                            onSelect={() => {
                              setSelectedClientId(c.client_id);
                              setClientSearchOpen(false);
                              setClientSearch("");
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedClientId === c.client_id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col">
                              <span>{c.nome || "Cliente sem nome"}</span>
                              {c.telefone && (
                                <span className="text-xs text-muted-foreground">
                                  {formatPhone(c.telefone)}
                                </span>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {clients.length === 0 && !loadingClients && (
                <p className="text-xs text-muted-foreground">
                  Todos os clientes já possuem assinatura ativa.
                </p>
              )}
            </div>
          )}

          {/* Selected Client Display (for Tornar VIP flow) */}
          {client && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium">{client.nome || "Cliente"}</p>
              {client.telefone && (
                <p className="text-xs text-muted-foreground">{formatPhone(client.telefone)}</p>
              )}
            </div>
          )}

          {/* Plan Selection */}
          <div className="space-y-2">
            <Label>Plano *</Label>
            <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
              <SelectTrigger disabled={loadingPlans}>
                <SelectValue placeholder={loadingPlans ? "Carregando..." : "Selecione o plano"} />
              </SelectTrigger>
              <SelectContent>
                {plans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    <div className="flex items-center justify-between gap-4">
                      <span>{plan.name}</span>
                      <span className="text-muted-foreground">
                        {formatPrice(plan.price)}/{plan.interval === "month" ? "mês" : "ano"}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {plans.length === 0 && !loadingPlans && (
              <p className="text-xs text-amber-600">
                Nenhum plano ativo. Crie um plano primeiro.
              </p>
            )}
          </div>

          {/* Due Date */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Próximo Vencimento *
            </Label>
            <Input
              type="date"
              value={nextDueDate}
              onChange={(e) => setNextDueDate(e.target.value)}
            />
          </div>

          {/* Summary */}
          {selectedPlan && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <p className="text-sm font-medium text-amber-600">
                Resumo: {formatPrice(selectedPlan.price)} via Dinheiro
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Este valor será registrado como receita no faturamento do cliente.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button
              className="flex-1 gap-2"
              onClick={handleSubmit}
              disabled={saving || !selectedPlanId || (!client && !selectedClientId)}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Crown className="w-4 h-4" />
                  Confirmar Assinatura
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
