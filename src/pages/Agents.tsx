import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { EmptyState } from "@/components/shared/EmptyState";
import { FAB } from "@/components/shared/FAB";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Bot, Plus, Edit2, Trash2, Phone, Loader2, MessageSquare, Sparkles } from "lucide-react";
import { criarAgenteAutomatico } from "@/lib/webhook";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { UpgradeLimitModal } from "@/components/subscription/UpgradeLimitModal";
import { Json } from "@/integrations/supabase/types";
import {
  WorkScheduleEditor,
  WorkSchedule,
  DEFAULT_WORK_SCHEDULE,
  parseWorkSchedule,
} from "@/components/agents/WorkScheduleEditor";
import {
  WhatsAppIntegrationManager,
  Integration,
  formatPhoneNumber,
  getStatusForBadge,
} from "@/components/integrations/WhatsAppIntegrationManager";

interface Agent {
  id: string;
  name: string;
  role: string;
  gender: string;
  voiceTone: string;
  objective: string;
  charLimit: number | null;
  restrictions: string;
  workSchedule: WorkSchedule;
  whatsappId: string | null;
  status: "online" | "offline";
}

interface OutletContextType {
  onMenuClick: () => void;
}

export default function Agents() {
  const { onMenuClick } = useOutletContext<OutletContextType>();
  const { user } = useAuth();
  const { checkLimit } = useSubscription();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [whatsappIntegrations, setWhatsappIntegrations] = useState<Integration[]>([]);
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
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isCreatingWithAI, setIsCreatingWithAI] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    role: "",
    gender: "",
    voiceTone: "",
    objective: "",
    charLimit: "Não há limitação",
    restrictions: "",
    workSchedule: { ...DEFAULT_WORK_SCHEDULE } as WorkSchedule,
    whatsappId: "",
  });

  useEffect(() => {
    if (user) {
      fetchAgents();
      fetchWhatsAppIntegrations();
    }
  }, [user]);

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
        role: item.funcao || "",
        gender: item.sexo || "",
        voiceTone: item.tom_de_voz || "",
        objective: item.objetivo || "",
        charLimit: item.limite_caracteres,
        restrictions: item.restricoes || "",
        workSchedule: parseWorkSchedule(item.horario_trabalho),
        whatsappId: item.whatsapp_id,
        status: item.ativo ? "online" : "offline",
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
      role: "",
      gender: "",
      voiceTone: "",
      objective: "",
      charLimit: "Não há limitação",
      restrictions: "",
      workSchedule: { ...DEFAULT_WORK_SCHEDULE },
      whatsappId: "",
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
      role: agent.role,
      gender: agent.gender,
      voiceTone: agent.voiceTone,
      objective: agent.objective,
      charLimit: getCharLimitLabel(agent.charLimit),
      restrictions: agent.restrictions,
      workSchedule: agent.workSchedule,
      whatsappId: agent.whatsappId || "",
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
    if (!formData.name || !formData.role) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    if (!user) {
      toast.error("Usuário não autenticado");
      return;
    }

    setIsSaving(true);

    try {
      const agentData = {
        nome: formData.name,
        funcao: formData.role,
        sexo: formData.gender || null,
        tom_de_voz: formData.voiceTone || null,
        objetivo: formData.objective || null,
        limite_caracteres: getCharLimitValue(formData.charLimit),
        restricoes: formData.restrictions || null,
        horario_trabalho: formData.workSchedule as unknown as Json,
        whatsapp_id: formData.whatsappId || null,
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
                  role: formData.role,
                  gender: formData.gender,
                  voiceTone: formData.voiceTone,
                  objective: formData.objective,
                  charLimit: getCharLimitValue(formData.charLimit),
                  restrictions: formData.restrictions,
                  workSchedule: formData.workSchedule,
                  whatsappId: formData.whatsappId || null,
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
          role: data.funcao || "",
          gender: data.sexo || "",
          voiceTone: data.tom_de_voz || "",
          objective: data.objetivo || "",
          charLimit: data.limite_caracteres,
          restrictions: data.restricoes || "",
          workSchedule: parseWorkSchedule(data.horario_trabalho),
          whatsappId: data.whatsapp_id,
          status: data.ativo ? "online" : "offline",
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

  const handleCreateWithAI = async () => {
    if (!aiPrompt.trim()) {
      toast.error("Digite um prompt para criar o agente");
      return;
    }

    if (!user) {
      toast.error("Usuário não autenticado");
      return;
    }

    // Verificar limite antes de criar
    const limitResult = await checkLimit("agents");
    if (!limitResult.allowed) {
      setLimitModal({
        open: true,
        current: limitResult.current,
        limit: limitResult.limit,
      });
      return;
    }

    setIsCreatingWithAI(true);

    try {
      const { data, error } = await criarAgenteAutomatico({
        event: "criar_agente",
        user_id: user.id,
        prompt: aiPrompt,
      });

      if (error) {
        toast.error(error);
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      toast.success("Agente criado com sucesso!");
      setIsAIModalOpen(false);
      setAiPrompt("");
      await fetchAgents();
    } catch (err) {
      console.error("Erro ao criar agente com IA:", err);
      toast.error("Erro ao criar agente. Tente novamente.");
    } finally {
      setIsCreatingWithAI(false);
    }
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
              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={handleCreate} variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Manualmente
                </Button>
                <Button onClick={async () => {
                  const limitResult = await checkLimit("agents");
                  if (!limitResult.allowed) {
                    setLimitModal({
                      open: true,
                      current: limitResult.current,
                      limit: limitResult.limit,
                    });
                    return;
                  }
                  setIsAIModalOpen(true);
                }} className="gradient-primary">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Criar com IA
                </Button>
              </div>
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
                      <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
                        <Bot className="w-6 h-6 text-primary-foreground" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">
                          {agent.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {agent.role}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={agent.status} />
                  </div>

                  <div className="space-y-2 mb-4">
                    {agent.voiceTone && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Tom de voz:</span>
                        <span className="text-foreground">{agent.voiceTone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Dias ativos:</span>
                      <span className="text-foreground">
                        {Object.entries(agent.workSchedule)
                          .filter(([, val]) => val.enabled)
                          .length} dias
                      </span>
                    </div>
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

      {/* FAB de criação com IA - posicionado acima do FAB padrão */}
      {agents.length > 0 && (
        <FAB 
          onClick={() => setIsAIModalOpen(true)} 
          icon={<Sparkles className="w-6 h-6" />}
          className="bottom-36 lg:bottom-28"
        />
      )}

      {/* FAB padrão */}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 animate-fade-in" style={{ animationDelay: '50ms' }}>
              <div className="space-y-2 transition-all duration-200">
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
              <div className="space-y-2 transition-all duration-200">
                <Label>Função *</Label>
                <Input
                  placeholder="Ex: Atendimento"
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value })
                  }
                  className="transition-all duration-200 focus:scale-[1.01]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 animate-fade-in" style={{ animationDelay: '100ms' }}>
              <div className="space-y-2 transition-all duration-200">
                <Label>Sexo</Label>
                <Select
                  value={formData.gender}
                  onValueChange={(value) =>
                    setFormData({ ...formData, gender: value })
                  }
                >
                  <SelectTrigger className="transition-all duration-200 hover:border-primary/50">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Masculino">Masculino</SelectItem>
                    <SelectItem value="Feminino">Feminino</SelectItem>
                    <SelectItem value="Neutro">Neutro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 transition-all duration-200">
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
            </div>

            <div className="space-y-2 animate-fade-in" style={{ animationDelay: '150ms' }}>
              <Label>Objetivo</Label>
              <Input
                placeholder="Ex: Agendar cortes e tirar dúvidas"
                value={formData.objective}
                onChange={(e) =>
                  setFormData({ ...formData, objective: e.target.value })
                }
                className="transition-all duration-200 focus:scale-[1.01]"
              />
            </div>

            <div className="space-y-2 animate-fade-in" style={{ animationDelay: '200ms' }}>
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

            <div className="space-y-2 animate-fade-in" style={{ animationDelay: '250ms' }}>
              <Label>Restrições (até 180 palavras)</Label>
              <Textarea
                placeholder="Ex: Não oferecer descontos acima de 10%"
                value={formData.restrictions}
                onChange={(e) =>
                  setFormData({ ...formData, restrictions: e.target.value })
                }
                rows={3}
                className="transition-all duration-200 focus:scale-[1.005]"
              />
            </div>

            <div className="animate-fade-in" style={{ animationDelay: '300ms' }}>
              <WorkScheduleEditor
                value={formData.workSchedule}
                onChange={(schedule) =>
                  setFormData({ ...formData, workSchedule: schedule })
                }
              />
            </div>

            <div className="space-y-2 animate-fade-in" style={{ animationDelay: '350ms' }}>
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

            <div className="flex gap-3 pt-4 animate-fade-in" style={{ animationDelay: '400ms' }}>
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

      {/* AI Agent Creation Modal */}
      <Dialog open={isAIModalOpen} onOpenChange={(open) => {
        if (!isCreatingWithAI) {
          setIsAIModalOpen(open);
          if (!open) setAiPrompt("");
        }
      }}>
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-lg mx-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Criar Agente com IA
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Descreva o agente que você deseja criar</Label>
              <Textarea
                placeholder="Ex: Crie um agente masculino, amigável, para atendimento de barbearia, que agenda cortes e tira dúvidas sobre preços..."
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                rows={5}
                disabled={isCreatingWithAI}
                className="resize-none"
              />
            </div>
            
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setIsAIModalOpen(false)}
                disabled={isCreatingWithAI}
              >
                Cancelar
              </Button>
              <Button 
                className="flex-1" 
                onClick={handleCreateWithAI}
                disabled={isCreatingWithAI || !aiPrompt.trim()}
              >
                {isCreatingWithAI ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Enviar
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
