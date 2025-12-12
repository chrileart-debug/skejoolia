import { useState, useEffect, useRef } from "react";
import { useOutletContext } from "react-router-dom";
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
import { Scissors, Plus, Edit2, Trash2, Bot, ImageIcon, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { UpgradeLimitModal } from "@/components/subscription/UpgradeLimitModal";

interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string | null;
  agentEnabled: boolean;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

interface OutletContextType {
  onMenuClick: () => void;
}

export default function Services() {
  const { onMenuClick } = useOutletContext<OutletContextType>();
  const { user } = useAuth();
  const { checkLimit } = useSubscription();
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [limitModal, setLimitModal] = useState<{ open: boolean; current: number; limit: number }>({
    open: false,
    current: 0,
    limit: 0,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    setPendingFile(null);
    setPreviewUrl(null);
  };

  const handleCreate = async () => {
    // Check limit before creating
    const limitResult = await checkLimit("services");
    if (!limitResult.allowed && !limitResult.unlimited) {
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

  const handleEdit = (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      description: service.description,
      price: service.price.toString(),
      agentEnabled: service.agentEnabled,
    });
    setPreviewUrl(service.image);
    setPendingFile(null);
    setIsDialogOpen(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Formato inválido. Use JPG, PNG ou WEBP.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error("Arquivo muito grande. Máximo 50MB.");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setPendingFile(file);

    // If editing existing service, upload immediately
    if (editingService && user) {
      uploadImage(file, editingService.id);
    }
  };

  const uploadImage = async (file: File, serviceId: string): Promise<string | null> => {
    if (!user) return null;
    setIsUploading(true);

    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const filePath = `${user.id}/servicos/${serviceId}.${extension}`;

      // Delete existing images for this service
      const { data: existingFiles } = await supabase.storage
        .from("midia-imagens-cortes")
        .list(`${user.id}/servicos`);

      if (existingFiles) {
        const filesToDelete = existingFiles
          .filter((f) => f.name.startsWith(serviceId))
          .map((f) => `${user.id}/servicos/${f.name}`);

        if (filesToDelete.length > 0) {
          await supabase.storage.from("midia-imagens-cortes").remove(filesToDelete);
        }
      }

      // Upload new image
      const { error: uploadError } = await supabase.storage
        .from("midia-imagens-cortes")
        .upload(filePath, file, { cacheControl: "3600", upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("midia-imagens-cortes")
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      // Update database
      await supabase
        .from("cortes")
        .update({ image_corte: publicUrl })
        .eq("id_corte", serviceId);

      setPreviewUrl(publicUrl);
      setServices((prev) =>
        prev.map((s) => (s.id === serviceId ? { ...s, image: publicUrl } : s))
      );
      toast.success("Imagem enviada com sucesso");
      return publicUrl;
    } catch (error) {
      console.error("Erro ao enviar imagem:", error);
      toast.error("Erro ao enviar imagem");
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!editingService || !user) {
      setPreviewUrl(null);
      setPendingFile(null);
      return;
    }

    try {
      const { data: files } = await supabase.storage
        .from("midia-imagens-cortes")
        .list(`${user.id}/servicos`);

      if (files) {
        const filesToDelete = files
          .filter((f) => f.name.startsWith(editingService.id))
          .map((f) => `${user.id}/servicos/${f.name}`);

        if (filesToDelete.length > 0) {
          await supabase.storage.from("midia-imagens-cortes").remove(filesToDelete);
        }
      }

      await supabase
        .from("cortes")
        .update({ image_corte: null })
        .eq("id_corte", editingService.id);

      setPreviewUrl(null);
      setServices((prev) =>
        prev.map((s) => (s.id === editingService.id ? { ...s, image: null } : s))
      );
      toast.success("Imagem removida");
    } catch (error) {
      console.error("Erro ao remover imagem:", error);
      toast.error("Erro ao remover imagem");
    }
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
        // Create service first
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

        let imageUrl: string | null = null;

        // If there's a pending file, upload it now
        if (pendingFile) {
          imageUrl = await uploadImage(pendingFile, data.id_corte);
        }

        const newService: Service = {
          id: data.id_corte,
          name: data.nome_corte,
          description: data.descricao || "",
          price: Number(data.preco_corte),
          image: imageUrl || data.image_corte,
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
        <Header title="Serviços" subtitle="Gerencie seus serviços" onMenuClick={onMenuClick} />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title="Serviços" subtitle="Gerencie seus serviços" onMenuClick={onMenuClick} />

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
                {/* Service Image */}
                <div className="h-32 bg-muted flex items-center justify-center overflow-hidden">
                  {service.image ? (
                    <img
                      src={service.image}
                      alt={service.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="w-12 h-12 text-muted-foreground/50" />
                  )}
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
            {/* Image upload */}
            <div className="space-y-2">
              <Label>Imagem</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div
                onClick={() => !isUploading && fileInputRef.current?.click()}
                className={`
                  relative h-32 border-2 border-dashed rounded-xl overflow-hidden cursor-pointer transition-all
                  ${previewUrl ? "border-transparent" : "border-border hover:border-primary/50"}
                  ${isUploading ? "pointer-events-none" : ""}
                `}
              >
                {previewUrl ? (
                  <>
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                    {!isUploading && (
                      <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            fileInputRef.current?.click();
                          }}
                          className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
                        >
                          <Upload className="w-5 h-5 text-white" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveImage();
                          }}
                          className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
                        >
                          <X className="w-5 h-5 text-white" />
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">
                      Clique para adicionar
                    </span>
                  </div>
                )}

                {isUploading && (
                  <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground text-center">
                JPG, PNG ou WEBP (máx. 50MB)
              </p>
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

      {/* Upgrade Limit Modal */}
      <UpgradeLimitModal
        open={limitModal.open}
        onOpenChange={(open) => setLimitModal({ ...limitModal, open })}
        resourceType="services"
        currentCount={limitModal.current}
        limit={limitModal.limit}
      />
    </div>
  );
}
