import { useState } from "react";
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
import { Bot, Plus, Edit2, Trash2, Phone, X } from "lucide-react";
import { toast } from "sonner";

interface Agent {
  id: string;
  name: string;
  role: string;
  gender: string;
  voiceTone: string;
  objective: string;
  charLimit: string;
  restrictions: string;
  workHours: string;
  whatsappNumber: string | null;
  status: "online" | "offline";
}

const mockAgents: Agent[] = [
  {
    id: "1",
    name: "Sara Atendente",
    role: "Atendimento",
    gender: "Feminino",
    voiceTone: "Amigável",
    objective: "Agendar cortes e tirar dúvidas",
    charLimit: "Média",
    restrictions: "Não oferecer descontos acima de 10%",
    workHours: "09:00 - 18:00",
    whatsappNumber: "+55 11 99999-0001",
    status: "online",
  },
];

const whatsappNumbers = [
  { id: "1", name: "WhatsApp Principal", number: "+55 11 99999-0001" },
  { id: "2", name: "WhatsApp Secundário", number: "+55 11 99999-0002" },
];

export default function Agents() {
  const [agents, setAgents] = useState<Agent[]>(mockAgents);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    role: "",
    gender: "",
    voiceTone: "",
    objective: "",
    charLimit: "Não há limitação",
    restrictions: "",
    workHours: "",
    whatsappNumber: "",
  });

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
      whatsappNumber: "",
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
      charLimit: agent.charLimit,
      restrictions: agent.restrictions,
      workHours: agent.workHours,
      whatsappNumber: agent.whatsappNumber || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setAgents(agents.filter((a) => a.id !== id));
    toast.success("Agente removido com sucesso");
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.role) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    if (editingAgent) {
      setAgents(
        agents.map((a) =>
          a.id === editingAgent.id
            ? { ...a, ...formData, status: a.status }
            : a
        )
      );
      toast.success("Agente atualizado com sucesso");
    } else {
      const newAgent: Agent = {
        id: Date.now().toString(),
        ...formData,
        whatsappNumber: formData.whatsappNumber || null,
        status: "offline",
      };
      setAgents([...agents, newAgent]);
      toast.success("Agente criado com sucesso");
    }

    setIsDialogOpen(false);
    resetForm();
  };

  const handleSelectWhatsApp = (number: string) => {
    setFormData({ ...formData, whatsappNumber: number });
    setIsWhatsAppModalOpen(false);
  };

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
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Tom de voz:</span>
                    <span className="text-foreground">{agent.voiceTone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Horário:</span>
                    <span className="text-foreground">{agent.workHours}</span>
                  </div>
                  {agent.whatsappNumber && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span className="text-foreground">
                        {agent.whatsappNumber}
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
                  placeholder="Selecione ou adicione"
                  value={formData.whatsappNumber}
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
              >
                Cancelar
              </Button>
              <Button className="flex-1" onClick={handleSubmit}>
                {editingAgent ? "Salvar" : "Criar"}
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
            {whatsappNumbers.map((wp) => (
              <button
                key={wp.id}
                onClick={() => handleSelectWhatsApp(wp.number)}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all text-left"
              >
                <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                  <Phone className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{wp.name}</p>
                  <p className="text-sm text-muted-foreground">{wp.number}</p>
                </div>
              </button>
            ))}

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
