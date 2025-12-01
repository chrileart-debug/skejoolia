import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { EmptyState } from "@/components/shared/EmptyState";
import { FAB } from "@/components/shared/FAB";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MessageSquare, Plus, Edit2, Trash2, Phone } from "lucide-react";
import { toast } from "sonner";

interface Integration {
  id: string;
  name: string;
  number: string;
  status: "online" | "offline";
}

const mockIntegrations: Integration[] = [
  {
    id: "1",
    name: "WhatsApp Principal",
    number: "+55 11 99999-0001",
    status: "online",
  },
  {
    id: "2",
    name: "WhatsApp Secundário",
    number: "+55 11 99999-0002",
    status: "offline",
  },
];

export default function Integrations() {
  const [integrations, setIntegrations] = useState<Integration[]>(mockIntegrations);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<Integration | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    number: "",
  });

  const resetForm = () => {
    setFormData({ name: "", number: "" });
    setEditingIntegration(null);
  };

  const handleCreate = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleEdit = (integration: Integration) => {
    setEditingIntegration(integration);
    setFormData({
      name: integration.name,
      number: integration.number,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setIntegrations(integrations.filter((i) => i.id !== id));
    toast.success("Integração removida com sucesso");
  };

  const handleToggleStatus = (id: string) => {
    setIntegrations(
      integrations.map((i) =>
        i.id === id
          ? { ...i, status: i.status === "online" ? "offline" : "online" }
          : i
      )
    );
    toast.success("Status atualizado");
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.number) {
      toast.error("Preencha todos os campos");
      return;
    }

    if (editingIntegration) {
      setIntegrations(
        integrations.map((i) =>
          i.id === editingIntegration.id
            ? { ...i, ...formData }
            : i
        )
      );
      toast.success("Integração atualizada com sucesso");
    } else {
      const newIntegration: Integration = {
        id: Date.now().toString(),
        ...formData,
        status: "offline",
      };
      setIntegrations([...integrations, newIntegration]);
      toast.success("Integração criada com sucesso");
    }

    setIsDialogOpen(false);
    resetForm();
  };

  return (
    <div className="min-h-screen">
      <Header
        title="Integrações"
        subtitle="Gerencie suas conexões com WhatsApp"
      />

      <div className="p-4 lg:p-6">
        {integrations.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="w-10 h-10 text-muted-foreground" />}
            title="Nenhuma integração configurada"
            description="Conecte seu WhatsApp para começar a receber agendamentos automaticamente."
            action={
              <Button onClick={handleCreate}>
                <Plus className="w-4 h-4 mr-2" />
                Nova Integração
              </Button>
            }
            className="min-h-[60vh]"
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {integrations.map((integration) => (
              <div
                key={integration.id}
                className="bg-card rounded-2xl shadow-card p-5 hover:shadow-card-hover transition-all duration-300 animate-fade-in"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        integration.status === "online"
                          ? "bg-success/10"
                          : "bg-muted"
                      }`}
                    >
                      <MessageSquare
                        className={`w-6 h-6 ${
                          integration.status === "online"
                            ? "text-success"
                            : "text-muted-foreground"
                        }`}
                      />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">
                        {integration.name}
                      </h3>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Phone className="w-3.5 h-3.5" />
                        {integration.number}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-4">
                  <StatusBadge status={integration.status} />
                  <button
                    onClick={() => handleToggleStatus(integration.id)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      integration.status === "online"
                        ? "bg-success"
                        : "bg-muted"
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 rounded-full bg-card shadow transition-transform ${
                        integration.status === "online"
                          ? "translate-x-7"
                          : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleEdit(integration)}
                  >
                    <Edit2 className="w-4 h-4 mr-1" />
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleDelete(integration.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {integrations.length > 0 && (
        <FAB onClick={handleCreate} label="Nova Integração" />
      )}

      {/* Integration Form Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingIntegration ? "Editar Integração" : "Nova Integração"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Nome de identificação *</Label>
              <Input
                placeholder="Ex: WhatsApp Principal"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Número do WhatsApp *</Label>
              <Input
                placeholder="+55 11 99999-9999"
                value={formData.number}
                onChange={(e) =>
                  setFormData({ ...formData, number: e.target.value })
                }
              />
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
                {editingIntegration ? "Salvar" : "Adicionar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
