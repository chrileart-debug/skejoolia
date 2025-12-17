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
import { Badge } from "@/components/ui/badge";
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
import { Scissors, Plus, Edit2, Trash2, Bot, ImageIcon, Loader2, Upload, X, Package } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBarbershop } from "@/hooks/useBarbershop";
import { useSubscription } from "@/hooks/useSubscription";
import { UpgradeLimitModal } from "@/components/subscription/UpgradeLimitModal";

interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  duration_minutes: number;
  image: string | null;
  agentEnabled: boolean;
  isPackage: boolean;
  categoryId: string | null;
  categoryName?: string;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

interface OutletContextType {
  onMenuClick: () => void;
}

export default function Services() {
  const { onMenuClick } = useOutletContext<OutletContextType>();
  const { user } = useAuth();
  const { barbershop, categories, loading: barbershopLoading } = useBarbershop();
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
    duration: "30",
    agentEnabled: true,
    isPackage: false,
    categoryId: "",
  });

  useEffect(() => {
    if (barbershop) {
      fetchServices();
    }
  }, [barbershop]);

  const fetchServices = async () => {
    if (!barbershop) return;

    try {
      const { data, error } = await supabase
        .from("services")
        .select(`
          *,
          categories (name)
        `)
        .eq("barbershop_id", barbershop.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mappedServices: Service[] = (data || []).map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description || "",
        price: Number(item.price),
        duration_minutes: item.duration_minutes || 30,
        image: item.image_url,
        agentEnabled: item.agent_enabled ?? true,
        isPackage: item.is_package ?? false,
        categoryId: item.category_id,
        categoryName: item.categories?.name,
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
      duration: "30",
      agentEnabled: true,
      isPackage: false,
      categoryId: categories[0]?.id || "",
    });
    setEditingService(null);
    setPendingFile(null);
    setPreviewUrl(null);
  };

  const handleCreate = async () => {
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
      duration: service.duration_minutes.toString(),
      agentEnabled: service.agentEnabled,
      isPackage: service.isPackage,
      categoryId: service.categoryId || "",
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

      const { error: uploadError } = await supabase.storage
        .from("midia-imagens-cortes")
        .upload(filePath, file, { cacheControl: "3600", upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("midia-imagens-cortes")
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      await supabase
        .from("services")
        .update({ image_url: publicUrl })
        .eq("id", serviceId);

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
        .from("services")
        .update({ image_url: null })
        .eq("id", editingService.id);

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
        .from("services")
        .delete()
        .eq("id", id);

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
        .from("services")
        .update({ agent_enabled: !service.agentEnabled })
        .eq("id", id);

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

    if (!barbershop) {
      toast.error("Barbearia não encontrada");
      return;
    }

    setIsSaving(true);

    try {
      if (editingService) {
        const { error } = await supabase
          .from("services")
          .update({
            name: formData.name,
            description: formData.description,
            price: parseFloat(formData.price),
            duration_minutes: parseInt(formData.duration),
            agent_enabled: formData.agentEnabled,
            is_package: formData.isPackage,
            category_id: formData.categoryId || null,
          })
          .eq("id", editingService.id);

        if (error) throw error;

        const category = categories.find((c) => c.id === formData.categoryId);
        
        setServices(
          services.map((s) =>
            s.id === editingService.id
              ? {
                  ...s,
                  name: formData.name,
                  description: formData.description,
                  price: parseFloat(formData.price),
                  duration_minutes: parseInt(formData.duration),
                  agentEnabled: formData.agentEnabled,
                  isPackage: formData.isPackage,
                  categoryId: formData.categoryId || null,
                  categoryName: category?.name,
                }
              : s
          )
        );
        toast.success("Serviço atualizado com sucesso");
      } else {
        const { data, error } = await supabase
          .from("services")
          .insert({
            barbershop_id: barbershop.id,
            name: formData.name,
            description: formData.description,
            price: parseFloat(formData.price),
            duration_minutes: parseInt(formData.duration),
            agent_enabled: formData.agentEnabled,
            is_package: formData.isPackage,
            category_id: formData.categoryId || null,
          })
          .select()
          .single();

        if (error) throw error;

        let imageUrl: string | null = null;
        if (pendingFile) {
          imageUrl = await uploadImage(pendingFile, data.id);
        }

        const category = categories.find((c) => c.id === formData.categoryId);

        const newService: Service = {
          id: data.id,
          name: data.name,
          description: data.description || "",
          price: Number(data.price),
          duration_minutes: data.duration_minutes || 30,
          image: imageUrl || data.image_url,
          agentEnabled: data.agent_enabled ?? true,
          isPackage: data.is_package ?? false,
          categoryId: data.category_id,
          categoryName: category?.name,
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

  if (isLoading || barbershopLoading) {
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
            description="Adicione os serviços que sua barbearia oferece."
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
                className="bg-card border border-border rounded-xl p-4 space-y-3"
              >
                {service.image && (
                  <div className="w-full h-32 rounded-lg overflow-hidden">
                    <img
                      src={service.image}
                      alt={service.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">{service.name}</h3>
                      {service.isPackage && (
                        <Badge variant="secondary" className="shrink-0">
                          <Package className="w-3 h-3 mr-1" />
                          Pacote
                        </Badge>
                      )}
                    </div>
                    {service.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {service.description}
                      </p>
                    )}
                  </div>
                  <span className="font-bold text-primary shrink-0 ml-2">
                    R$ {service.price.toFixed(2)}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {service.categoryName && (
                    <Badge variant="outline">{service.categoryName}</Badge>
                  )}
                  <Badge variant="outline">{service.duration_minutes} min</Badge>
                  {service.agentEnabled ? (
                    <Badge className="bg-primary/10 text-primary border-primary/20">
                      <Bot className="w-3 h-3 mr-1" />
                      Agente ativo
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <Bot className="w-3 h-3 mr-1" />
                      Agente inativo
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Agente IA</span>
                    <Switch
                      checked={service.agentEnabled}
                      onCheckedChange={() => handleToggleAgent(service.id)}
                    />
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(service)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(service.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {services.length > 0 && (
        <FAB onClick={handleCreate} icon={<Plus className="w-6 h-6" />} />
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingService ? "Editar Serviço" : "Novo Serviço"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Image Upload */}
            <div className="space-y-2">
              <Label>Imagem</Label>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept={ALLOWED_TYPES.join(",")}
                onChange={handleFileSelect}
              />
              {previewUrl ? (
                <div className="relative w-full h-40 rounded-lg overflow-hidden">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 right-2 flex gap-1">
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                    >
                      {isUploading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="h-8 w-8"
                      onClick={handleRemoveImage}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-32 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/50 transition-colors"
                >
                  <ImageIcon className="w-8 h-8" />
                  <span className="text-sm">Clique para adicionar imagem</span>
                </button>
              )}
            </div>

            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Ex: Corte Degradê"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Preço (R$) *</Label>
                <Input
                  id="price"
                  value={formData.price}
                  onChange={(e) =>
                    setFormData({ ...formData, price: formatPrice(e.target.value) })
                  }
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration">Duração (minutos)</Label>
                <Input
                  id="duration"
                  type="number"
                  value={formData.duration}
                  onChange={(e) =>
                    setFormData({ ...formData, duration: e.target.value })
                  }
                  placeholder="30"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Categoria</Label>
                <Select
                  value={formData.categoryId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, categoryId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Descreva o serviço..."
                rows={3}
              />
            </div>

            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Pacote/Combo</Label>
                  <p className="text-sm text-muted-foreground">
                    Este serviço é um pacote de serviços
                  </p>
                </div>
                <Switch
                  checked={formData.isPackage}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isPackage: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Disponível para Agente IA</Label>
                  <p className="text-sm text-muted-foreground">
                    Permite que o agente ofereça este serviço
                  </p>
                </div>
                <Switch
                  checked={formData.agentEnabled}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, agentEnabled: checked })
                  }
                />
              </div>
            </div>

            <Button
              onClick={handleSubmit}
              className="w-full"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : editingService ? (
                "Salvar Alterações"
              ) : (
                "Criar Serviço"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
