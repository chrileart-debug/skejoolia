import { useState, useEffect } from "react";
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
import { Bot, Plus, Edit2, Trash2, Phone, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Agent {
  id: string;
  name: string;
  role: string;
  gender: string;
  voiceTone: string;
  objective: string;
  charLimit: number | null;
  restrictions: string;
  workHours: string;
  whatsappId: string | null;
  status: "online" | "offline";
}

interface WhatsAppNumber {
  id: string;
  nome: string;
  numero: string;
}

export default function Agents() {
  const { user } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [whatsappNumbers, setWhatsappNumbers] = useState<WhatsAppNumber[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    role: "",
    gender: "",
    voiceTone: "",
    objective: "",
    charLimit: "Não há limitação",
    restrictions: "",
    workHours: "",
    whatsappId: "",
  });

  useEffect(() => {
    if (user) {
      fetchAgents();
      fetchWhatsAppNumbers();
    }
  }, [user]);

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
        workHours: item.horario_trabalho ? JSON.stringify(item.horario_trabalho) : "",
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

  const fetchWhatsAppNumbers = async () => {
    try {
      const { data, error } = await supabase
        .from("integracao_whatsapp")
        .select("id, nome, numero");

      if (error) throw error;

      setWhatsappNumbers(data || []);
    } catch (error) {
      console.error("Erro ao carregar números WhatsApp:", error);
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
      workHours: "",
      whatsappId: "",
    });
    setEditingAgent(null);
  };

  const handleCreate = () => {
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
      workHours: agent.workHours,
      whatsappId: agent.whatsappId || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("agentes")
        .delete()
        .eq("id_agente", id);

      if (error) throw error;

      setAgents(agents.filter((a) => a.id !== id));
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
        horario_trabalho: formData.workHours ? { horario: formData.workHours } : null,
        whatsapp_id: formData.whatsappId || null,
      };

      if (editingAgent) {
        const { error } = await supabase
          .from("agentes")
          .update(agentData)
          .eq("id_agente", editingAgent.id);

        if (error) throw error;

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
                  workHours: formData.workHours,
                  whatsappId: formData.whatsappId || null,
                }
              : a
          )
        );
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

        const newAgent: Agent = {
          id: data.id_agente,
          name: data.nome,
          role: data.funcao || "",
          gender: data.sexo || "",
          voiceTone: data.tom_de_voz || "",
          objective: data.objetivo || "",
          charLimit: data.limite_caracteres,
          restrictions: data.restricoes || "",
          workHours: data.horario_trabalho ? JSON.stringify(data.horario_trabalho) : "",
          whatsappId: data.whatsapp_id,
          status: data.ativo ? "online" : "offline",
        };
        setAgents([newAgent, ...agents]);
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

  const handleSelectWhatsApp = (id: string) => {
    setFormData({ ...formData, whatsappId: id });
    setIsWhatsAppModalOpen(false);
  };

  const getWhatsAppNumber = (id: string | null) => {
    if (!id) return null;
    const wp = whatsappNumbers.find((w) => w.id === id);
    return wp?.numero || null;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Header title="Agentes" subtitle="Gerencie seus agentes de IA" />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title="Agentes" subtitle="Gerencie seus agentes de IA" />

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
            {agents.map((agent) => (
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
                  {agent.workHours && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Horário:</span>
                      <span className="text-foreground">{agent.workHours}</span>
                    </div>
                  )}
                  {getWhatsAppNumber(agent.whatsappId) && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span className="text-foreground">
                        {getWhatsAppNumber(agent.whatsappId)}
                      </span>
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
            ))}
          </div>
        )}
      </div>

      {agents.length > 0 && <FAB onClick={handleCreate} />}

      {/* Agent Form Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAgent ? "Editar Agente" : "Criar Agente"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  placeholder="Nome do agente"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Função *</Label>
                <Input
                  placeholder="Ex: Atendimento"
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sexo</Label>
                <Select
                  value={formData.gender}
                  onValueChange={(value) =>
                    setFormData({ ...formData, gender: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Masculino">Masculino</SelectItem>
                    <SelectItem value="Feminino">Feminino</SelectItem>
                    <SelectItem value="Neutro">Neutro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tom de voz</Label>
                <Select
                  value={formData.voiceTone}
                  onValueChange={(value) =>
                    setFormData({ ...formData, voiceTone: value })
                  }
                >
                  <SelectTrigger>
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

            <div className="space-y-2">
              <Label>Objetivo</Label>
              <Input
                placeholder="Ex: Agendar cortes e tirar dúvidas"
                value={formData.objective}
                onChange={(e) =>
                  setFormData({ ...formData, objective: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Limite de caracteres da resposta</Label>
              <Select
                value={formData.charLimit}
                onValueChange={(value) =>
                  setFormData({ ...formData, charLimit: value })
                }
              >
                <SelectTrigger>
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

            <div className="space-y-2">
              <Label>Restrições (até 180 palavras)</Label>
              <Textarea
                placeholder="Ex: Não oferecer descontos acima de 10%"
                value={formData.restrictions}
                onChange={(e) =>
                  setFormData({ ...formData, restrictions: e.target.value })
                }
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Horário de trabalho</Label>
              <Input
                placeholder="Ex: 09:00 - 18:00"
                value={formData.workHours}
                onChange={(e) =>
                  setFormData({ ...formData, workHours: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Número do WhatsApp</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Selecione um número"
                  value={getWhatsAppNumber(formData.whatsappId) || ""}
                  readOnly
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsWhatsAppModalOpen(true)}
                >
                  <Phone className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setIsDialogOpen(false)}
                disabled={isSaving}
              >
                Cancelar
              </Button>
              <Button className="flex-1" onClick={handleSubmit} disabled={isSaving}>
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

      {/* WhatsApp Selection Modal */}
      <Dialog open={isWhatsAppModalOpen} onOpenChange={setIsWhatsAppModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Selecionar WhatsApp</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 pt-4">
            {whatsappNumbers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum número WhatsApp cadastrado
              </p>
            ) : (
              whatsappNumbers.map((wp) => (
                <button
                  key={wp.id}
                  onClick={() => handleSelectWhatsApp(wp.id)}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                    <Phone className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{wp.nome}</p>
                    <p className="text-sm text-muted-foreground">{wp.numero}</p>
                  </div>
                </button>
              ))
            )}

            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setIsWhatsAppModalOpen(false);
                window.location.href = "/integrations";
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar novo número
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
