import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { EmptyState } from "@/components/shared/EmptyState";
import { FAB } from "@/components/shared/FAB";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Scissors, Plus, Edit2, Trash2, Bot, ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string | null;
  agentEnabled: boolean;
}

export default function Services() {
  const { user } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    agentEnabled: true,
  });

  useEffect(() => {
    if (user) {
      fetchServices();
    }
  }, [user]);

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from("cortes")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mappedServices: Service[] = (data || []).map((item) => ({
        id: item.id_corte,
        name: item.nome_corte,
        description: item.descricao || "",
        price: Number(item.preco_corte),
        image: item.image_corte,
        agentEnabled: item.agente_pode_usar ?? true,
      }));

      setServices(mappedServices);
    } catch (error) {
      console.error("Erro ao carregar serviços:", error);
      toast.error("Erro ao carregar serviços");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      price: "",
      agentEnabled: true,
    });
    setEditingService(null);
  };

  const handleCreate = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      description: service.description,
      price: service.price.toString(),
      agentEnabled: service.agentEnabled,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("cortes")
        .delete()
        .eq("id_corte", id);

      if (error) throw error;

      setServices(services.filter((s) => s.id !== id));
      toast.success("Serviço removido com sucesso");
    } catch (error) {
      console.error("Erro ao remover serviço:", error);
      toast.error("Erro ao remover serviço");
    }
  };

  const handleToggleAgent = async (id: string) => {
    const service = services.find((s) => s.id === id);
    if (!service) return;

    try {
      const { error } = await supabase
        .from("cortes")
        .update({ agente_pode_usar: !service.agentEnabled })
        .eq("id_corte", id);

      if (error) throw error;

      setServices(
        services.map((s) =>
          s.id === id ? { ...s, agentEnabled: !s.agentEnabled } : s
        )
      );
      toast.success("Configuração atualizada");
    } catch (error) {
      console.error("Erro ao atualizar configuração:", error);
      toast.error("Erro ao atualizar configuração");
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.price) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    if (!user) {
      toast.error("Usuário não autenticado");
      return;
    }

    setIsSaving(true);

    try {
      if (editingService) {
        const { error } = await supabase
          .from("cortes")
          .update({
            nome_corte: formData.name,
            descricao: formData.description,
            preco_corte: parseFloat(formData.price),
            agente_pode_usar: formData.agentEnabled,
          })
          .eq("id_corte", editingService.id);

        if (error) throw error;

        setServices(
          services.map((s) =>
            s.id === editingService.id
              ? {
                  ...s,
                  name: formData.name,
                  description: formData.description,
                  price: parseFloat(formData.price),
                  agentEnabled: formData.agentEnabled,
                }
              : s
          )
        );
        toast.success("Serviço atualizado com sucesso");
      } else {
        const { data, error } = await supabase
          .from("cortes")
          .insert({
            user_id: user.id,
            nome_corte: formData.name,
            descricao: formData.description,
            preco_corte: parseFloat(formData.price),
            agente_pode_usar: formData.agentEnabled,
          })
          .select()
          .single();

        if (error) throw error;

        const newService: Service = {
          id: data.id_corte,
          name: data.nome_corte,
          description: data.descricao || "",
          price: Number(data.preco_corte),
          image: data.image_corte,
          agentEnabled: data.agente_pode_usar ?? true,
        };
        setServices([newService, ...services]);
        toast.success("Serviço criado com sucesso");
      }

      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error("Erro ao salvar serviço:", error);
      toast.error("Erro ao salvar serviço");
    } finally {
      setIsSaving(false);
    }
  };

  const formatPrice = (value: string) => {
    const numericValue = value.replace(/\D/g, "");
    const floatValue = parseFloat(numericValue) / 100;
    return floatValue.toFixed(2);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Header title="Serviços" subtitle="Gerencie os cortes e serviços" />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title="Serviços" subtitle="Gerencie os cortes e serviços" />

      <div className="p-4 lg:p-6">
        {services.length === 0 ? (
          <EmptyState
            icon={<Scissors className="w-10 h-10 text-muted-foreground" />}
            title="Nenhum serviço cadastrado"
            description="Adicione os cortes e serviços que sua barbearia oferece."
            action={
              <Button onClick={handleCreate}>
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Serviço
              </Button>
            }
            className="min-h-[60vh]"
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <div
                key={service.id}
                className="bg-card rounded-2xl shadow-card overflow-hidden hover:shadow-card-hover transition-all duration-300 animate-fade-in"
              >
                {/* Image placeholder */}
                <div className="h-32 bg-muted flex items-center justify-center">
                  <ImageIcon className="w-12 h-12 text-muted-foreground/50" />
                </div>

                <div className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-foreground">
                        {service.name}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {service.description}
                      </p>
                    </div>
                    <span className="text-lg font-bold text-primary">
                      R$ {service.price.toFixed(2)}
                    </span>
                  </div>

                  {/* Agent Toggle */}
                  <div className="flex items-center justify-between py-3 border-t border-b border-border my-3">
                    <div className="flex items-center gap-2">
                      <Bot
                        className={`w-4 h-4 ${
                          service.agentEnabled
                            ? "text-primary"
                            : "text-muted-foreground"
                        }`}
                      />
                      <span className="text-sm text-muted-foreground">
                        Agente pode oferecer
                      </span>
                    </div>
                    <Switch
                      checked={service.agentEnabled}
                      onCheckedChange={() => handleToggleAgent(service.id)}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleEdit(service)}
                    >
                      <Edit2 className="w-4 h-4 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(service.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {services.length > 0 && <FAB onClick={handleCreate} />}

      {/* Service Form Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingService ? "Editar Serviço" : "Novo Serviço"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            {/* Image upload placeholder */}
            <div className="space-y-2">
              <Label>Imagem</Label>
              <div className="h-32 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
                <ImageIcon className="w-8 h-8 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">
                  Clique para adicionar
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                placeholder="Ex: Corte Degradê"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                placeholder="Descreva o serviço..."
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Valor (R$) *</Label>
              <Input
                placeholder="0,00"
                value={formData.price}
                onChange={(e) => {
                  const formatted = formatPrice(e.target.value);
                  setFormData({ ...formData, price: formatted });
                }}
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
              <div className="flex items-center gap-3">
                <Bot className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Permitir que o Agente ofereça
                  </p>
                  <p className="text-xs text-muted-foreground">
                    O agente poderá sugerir este serviço
                  </p>
                </div>
              </div>
              <Switch
                checked={formData.agentEnabled}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, agentEnabled: checked })
                }
              />
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
                ) : editingService ? (
                  "Salvar"
                ) : (
                  "Adicionar"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
