import { useState, useEffect } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { EmptyState } from "@/components/shared/EmptyState";
import { FAB } from "@/components/shared/FAB";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { Bot, Plus, Edit2, Trash2, Phone, Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { UpgradeLimitModal } from "@/components/subscription/UpgradeLimitModal";
import {
  WhatsAppIntegrationManager,
  Integration,
  formatPhoneNumber,
  getStatusForBadge,
} from "@/components/integrations/WhatsAppIntegrationManager";

interface Agent {
  id: string;
  name: string;
  voiceTone: string;
  charLimit: number | null;
  whatsappId: string | null;
  ativo: boolean;
}

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

export default function Agents() {
  const { onMenuClick, barbershop } = useOutletContext<OutletContextType>();
  const { user } = useAuth();
  const { checkLimit } = useSubscription();
  
  const [agents, setAgents] = useState<Agent[]>([]);
  const [whatsappIntegrations, setWhatsappIntegrations] = useState<Integration[]>([]);
  const [hasActiveServices, setHasActiveServices] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [limitModal, setLimitModal] = useState<{ open: boolean; current: number; limit: number }>({
    open: false,
    current: 0,
    limit: 0,
  });
  const [formData, setFormData] = useState({
    name: "",
    voiceTone: "",
    charLimit: "Não há limitação",
    whatsappId: "",
    ativo: true,
  });

  useEffect(() => {
    if (user) {
      fetchAgents();
      fetchWhatsAppIntegrations();
      fetchServices();
    }
  }, [user]);

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from("services")
        .select("id")
        .eq("is_active", true)
        .limit(1);

      if (error) throw error;
      setHasActiveServices((data || []).length > 0);
    } catch (error) {
      console.error("Erro ao verificar serviços:", error);
    }
  };

  // Listen for whatsapp:updated events
  useEffect(() => {
    const handleUpdate = () => fetchWhatsAppIntegrations();
    window.addEventListener("whatsapp:updated", handleUpdate);
    return () => window.removeEventListener("whatsapp:updated", handleUpdate);
  }, []);

  const fetchAgents = async () => {
    try {
      const { data, error } = await supabase
        .from("agentes")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mappedAgents: Agent[] = (data || []).map((item) => ({
        id: item.id_agente,
        name: item.nome,
        voiceTone: item.tom_de_voz || "",
        charLimit: item.limite_caracteres,
        whatsappId: item.whatsapp_id,
        ativo: item.ativo ?? true,
      }));

      setAgents(mappedAgents);
    } catch (error) {
      console.error("Erro ao carregar agentes:", error);
      toast.error("Erro ao carregar agentes");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchWhatsAppIntegrations = async () => {
    try {
      const { data, error } = await supabase
        .from("integracao_whatsapp")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setWhatsappIntegrations(data || []);
    } catch (error) {
      console.error("Erro ao carregar integrações WhatsApp:", error);
    }
  };

  const getCharLimitValue = (limit: string): number | null => {
    switch (limit) {
      case "Curta":
        return 20;
      case "Média":
        return 100;
      case "Longa":
        return 200;
      default:
        return null;
    }
  };

  const getCharLimitLabel = (limit: number | null): string => {
    if (limit === null) return "Não há limitação";
    if (limit <= 20) return "Curta";
    if (limit <= 100) return "Média";
    return "Longa";
  };

  const resetForm = () => {
    setFormData({
      name: "",
      voiceTone: "",
      charLimit: "Não há limitação",
      whatsappId: "",
      ativo: hasActiveServices, // Só ativa por padrão se houver serviços
    });
    setEditingAgent(null);
  };

  const handleCreate = async () => {
    // Check limit before creating
    const limitResult = await checkLimit("agents");
    if (!limitResult.allowed) {
      setLimitModal({
        open: true,
        current: limitResult.current,
        limit: limitResult.limit,
      });
      return;
    }
    
    resetForm();
    setIsDialogOpen(true);
  };

  const handleEdit = (agent: Agent) => {
    setEditingAgent(agent);
    setFormData({
      name: agent.name,
      voiceTone: agent.voiceTone,
      charLimit: getCharLimitLabel(agent.charLimit),
      whatsappId: agent.whatsappId || "",
      ativo: agent.ativo,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      // Primeiro limpa o vinculado_em da integração vinculada a este agente
      const agentToDelete = agents.find((a) => a.id === id);
      if (agentToDelete?.whatsappId) {
        await supabase
          .from("integracao_whatsapp")
          .update({ vinculado_em: null })
          .eq("id", agentToDelete.whatsappId);
      }

      const { error } = await supabase
        .from("agentes")
        .delete()
        .eq("id_agente", id);

      if (error) throw error;

      setAgents(agents.filter((a) => a.id !== id));
      window.dispatchEvent(new CustomEvent("whatsapp:updated"));
      toast.success("Agente removido com sucesso");
    } catch (error) {
      console.error("Erro ao remover agente:", error);
      toast.error("Erro ao remover agente");
    }
  };

  const handleSubmit = async () => {
    if (!formData.name) {
      toast.error("Preencha o nome do agente");
      return;
    }

    if (!user || !barbershop) {
      toast.error("Usuário não autenticado");
      return;
    }

    setIsSaving(true);

    try {
      const agentData = {
        nome: formData.name,
        tom_de_voz: formData.voiceTone || null,
        limite_caracteres: getCharLimitValue(formData.charLimit),
        whatsapp_id: formData.whatsappId || null,
        ativo: formData.ativo,
      };

      if (editingAgent) {
        // Se o whatsapp_id antigo é diferente do novo, limpa o vinculado_em antigo
        if (editingAgent.whatsappId && editingAgent.whatsappId !== formData.whatsappId) {
          await supabase
            .from("integracao_whatsapp")
            .update({ vinculado_em: null })
            .eq("id", editingAgent.whatsappId);
        }

        const { error } = await supabase
          .from("agentes")
          .update(agentData)
          .eq("id_agente", editingAgent.id);

        if (error) throw error;

        // Atualiza o vinculado_em da nova integração
        if (formData.whatsappId) {
          await supabase
            .from("integracao_whatsapp")
            .update({ vinculado_em: editingAgent.id })
            .eq("id", formData.whatsappId);
        }

        setAgents(
          agents.map((a) =>
            a.id === editingAgent.id
              ? {
                  ...a,
                  name: formData.name,
                  voiceTone: formData.voiceTone,
                  charLimit: getCharLimitValue(formData.charLimit),
                  whatsappId: formData.whatsappId || null,
                  ativo: formData.ativo,
                }
              : a
          )
        );
        window.dispatchEvent(new CustomEvent("whatsapp:updated"));
        toast.success("Agente atualizado com sucesso");
      } else {
        const { data, error } = await supabase
          .from("agentes")
          .insert({
            user_id: user.id,
            barbershop_id: barbershop.id,
            ...agentData,
          })
          .select()
          .single();

        if (error) throw error;

        // Atualiza o vinculado_em da integração com o ID do novo agente
        if (formData.whatsappId) {
          await supabase
            .from("integracao_whatsapp")
            .update({ vinculado_em: data.id_agente })
            .eq("id", formData.whatsappId);
        }

        const newAgent: Agent = {
          id: data.id_agente,
          name: data.nome,
          voiceTone: data.tom_de_voz || "",
          charLimit: data.limite_caracteres,
          whatsappId: data.whatsapp_id,
          ativo: data.ativo ?? true,
        };
        setAgents([newAgent, ...agents]);
        window.dispatchEvent(new CustomEvent("whatsapp:updated"));
        toast.success("Agente criado com sucesso");
      }

      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error("Erro ao salvar agente:", error);
      toast.error("Erro ao salvar agente");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectWhatsApp = (integration: Integration | null) => {
    if (integration) {
      setFormData({ ...formData, whatsappId: integration.id });
    } else {
      setFormData({ ...formData, whatsappId: "" });
    }
  };

  const getWhatsAppIntegration = (id: string | null): Integration | null => {
    if (!id) return null;
    return whatsappIntegrations.find((w) => w.id === id) || null;
  };


  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Header title="Agentes" subtitle="Gerencie seus agentes de IA" onMenuClick={onMenuClick} />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title="Agentes" subtitle="Gerencie seus agentes de IA" onMenuClick={onMenuClick} />

      <div className="p-4 lg:p-6">
        {agents.length === 0 ? (
          <EmptyState
            icon={<Bot className="w-10 h-10 text-muted-foreground" />}
            title="Você ainda não tem agentes"
            description="Crie seu primeiro agente de IA para automatizar o atendimento da sua barbearia."
            action={
              <Button onClick={handleCreate}>
                <Plus className="w-4 h-4 mr-2" />
                Criar Agente
              </Button>
            }
            className="min-h-[60vh]"
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => {
              const whatsappIntegration = getWhatsAppIntegration(agent.whatsappId);
              
              return (
                <div
                  key={agent.id}
                  className="bg-card rounded-2xl shadow-card p-5 hover:shadow-card-hover transition-all duration-300 animate-fade-in"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 ${agent.ativo ? "gradient-primary" : "bg-muted"}`}>
                        <Bot className={`w-6 h-6 ${agent.ativo ? "text-primary-foreground" : "text-muted-foreground"}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">
                          {agent.name}
                        </h3>
                        {agent.voiceTone && (
                          <p className="text-sm text-muted-foreground">
                            {agent.voiceTone}
                          </p>
                        )}
                      </div>
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            <Switch
                              checked={agent.ativo}
                              disabled={!hasActiveServices && !agent.ativo}
                              onCheckedChange={async (checked) => {
                                if (checked && !hasActiveServices) {
                                  toast.error("Adicione pelo menos um serviço antes de ativar o agente");
                                  return;
                                }
                                
                                try {
                                  const { error } = await supabase
                                    .from("agentes")
                                    .update({ ativo: checked })
                                    .eq("id_agente", agent.id);
                                  
                                  if (error) throw error;
                                  
                                  setAgents(agents.map(a => 
                                    a.id === agent.id ? { ...a, ativo: checked } : a
                                  ));
                                  toast.success(checked ? "Agente ativado" : "Agente desativado");
                                } catch (error) {
                                  console.error("Erro ao atualizar agente:", error);
                                  toast.error("Erro ao atualizar status do agente");
                                }
                              }}
                            />
                          </div>
                        </TooltipTrigger>
                        {!hasActiveServices && !agent.ativo && (
                          <TooltipContent className="flex flex-col gap-1">
                            <p>Adicione serviços para ativar o agente</p>
                            <Link 
                              to="/services" 
                              className="text-xs text-primary hover:underline font-medium"
                            >
                              Ir para Serviços →
                            </Link>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  <div className="space-y-2 mb-4">
                    {whatsappIntegration && (
                      <div className="flex items-center gap-2 text-sm">
                        <MessageSquare className={`w-4 h-4 ${whatsappIntegration.status === "conectado" ? "text-success" : "text-muted-foreground"}`} />
                        <span className="text-foreground">
                          {formatPhoneNumber(whatsappIntegration.numero)}
                        </span>
                        <StatusBadge status={getStatusForBadge(whatsappIntegration.status)} />
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleEdit(agent)}
                    >
                      <Edit2 className="w-4 h-4 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(agent.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {agents.length > 0 && <FAB onClick={handleCreate} />}

      {/* Agent Form Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto mx-auto animate-scale-in">
          <DialogHeader className="animate-fade-in">
            <DialogTitle>
              {editingAgent ? "Editar Agente" : "Criar Agente"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            {/* Switch para ativar/desativar agente */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/30 animate-fade-in">
              <div className="space-y-0.5">
                <Label>Agente Ativo</Label>
                <p className="text-xs text-muted-foreground">
                  {formData.ativo ? "O agente está funcionando" : "O agente está pausado"}
                </p>
                {!hasActiveServices && !formData.ativo && (
                  <Link 
                    to="/services" 
                    className="text-xs text-primary hover:underline font-medium"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Adicione serviços para ativar →
                  </Link>
                )}
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Switch
                        checked={formData.ativo}
                        disabled={!hasActiveServices && !formData.ativo}
                        onCheckedChange={(checked) => {
                          if (checked && !hasActiveServices) {
                            toast.error("Adicione pelo menos um serviço antes de ativar o agente");
                            return;
                          }
                          setFormData({ ...formData, ativo: checked });
                        }}
                      />
                    </div>
                  </TooltipTrigger>
                  {!hasActiveServices && !formData.ativo && (
                    <TooltipContent>
                      <p>Adicione serviços para ativar o agente</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="space-y-2 transition-all duration-200 animate-fade-in" style={{ animationDelay: '50ms' }}>
              <Label>Nome *</Label>
              <Input
                placeholder="Nome do agente"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="transition-all duration-200 focus:scale-[1.01]"
              />
            </div>

            <div className="space-y-2 transition-all duration-200 animate-fade-in" style={{ animationDelay: '100ms' }}>
              <Label>Tom de voz</Label>
              <Select
                value={formData.voiceTone}
                onValueChange={(value) =>
                  setFormData({ ...formData, voiceTone: value })
                }
              >
                <SelectTrigger className="transition-all duration-200 hover:border-primary/50">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Amigável">Amigável</SelectItem>
                  <SelectItem value="Formal">Formal</SelectItem>
                  <SelectItem value="Descontraído">Descontraído</SelectItem>
                  <SelectItem value="Profissional">Profissional</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 animate-fade-in" style={{ animationDelay: '150ms' }}>
              <Label>Limite de caracteres da resposta</Label>
              <Select
                value={formData.charLimit}
                onValueChange={(value) =>
                  setFormData({ ...formData, charLimit: value })
                }
              >
                <SelectTrigger className="transition-all duration-200 hover:border-primary/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Não há limitação">Não há limitação</SelectItem>
                  <SelectItem value="Curta">Curta (até 20 caracteres)</SelectItem>
                  <SelectItem value="Média">Média (até 100 caracteres)</SelectItem>
                  <SelectItem value="Longa">Longa (até 200 caracteres)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 animate-fade-in" style={{ animationDelay: '200ms' }}>
              <Label>Integração WhatsApp</Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 p-3 rounded-xl border border-border bg-muted/30 min-w-0 transition-all duration-200 hover:border-primary/30">
                  {formData.whatsappId ? (
                    (() => {
                      const integration = getWhatsAppIntegration(formData.whatsappId);
                      if (!integration) return <span className="text-muted-foreground text-sm">Integração não encontrada</span>;
                      return (
                        <div className="flex items-center gap-2 flex-wrap">
                          <MessageSquare className={`w-4 h-4 shrink-0 ${integration.status === "conectado" ? "text-success" : "text-muted-foreground"}`} />
                          <span className="font-medium text-sm truncate">{integration.nome}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatPhoneNumber(integration.numero)}
                          </span>
                          <StatusBadge status={getStatusForBadge(integration.status)} />
                        </div>
                      );
                    })()
                  ) : (
                    <span className="text-muted-foreground text-sm">Nenhuma integração selecionada</span>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto shrink-0 transition-all duration-200 hover:scale-[1.02]"
                  onClick={() => setIsWhatsAppModalOpen(true)}
                >
                  <Phone className="w-4 h-4 mr-2 sm:mr-0" />
                  <span className="sm:hidden">Selecionar WhatsApp</span>
                </Button>
              </div>
            </div>

            <div className="flex gap-3 pt-4 animate-fade-in" style={{ animationDelay: '250ms' }}>
              <Button
                variant="outline"
                className="flex-1 transition-all duration-200 hover:scale-[1.02]"
                onClick={() => setIsDialogOpen(false)}
                disabled={isSaving}
              >
                Cancelar
              </Button>
              <Button className="flex-1 transition-all duration-200 hover:scale-[1.02]" onClick={handleSubmit} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : editingAgent ? (
                  "Salvar"
                ) : (
                  "Criar"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* WhatsApp Integration Manager */}
      <WhatsAppIntegrationManager
        open={isWhatsAppModalOpen}
        onOpenChange={setIsWhatsAppModalOpen}
        onSelectIntegration={handleSelectWhatsApp}
        selectedIntegrationId={formData.whatsappId}
        currentAgentId={editingAgent?.id}
        mode="select"
      />

      {/* Upgrade Limit Modal */}
      <UpgradeLimitModal
        open={limitModal.open}
        onOpenChange={(open) => setLimitModal({ ...limitModal, open })}
        resourceType="agents"
        currentCount={limitModal.current}
        limit={limitModal.limit}
      />

    </div>
  );
}
