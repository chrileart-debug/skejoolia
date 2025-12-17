import { useState, useEffect, useRef, useMemo } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Scissors,
  Plus,
  Edit2,
  Trash2,
  Bot,
  ImageIcon,
  Loader2,
  Upload,
  X,
  Package,
  Clock,
  FolderOpen,
  ListTree,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBarbershop } from "@/hooks/useBarbershop";
import { useSubscription } from "@/hooks/useSubscription";
import { UpgradeLimitModal } from "@/components/subscription/UpgradeLimitModal";
import { CategoryManager } from "@/components/services/CategoryManager";
import { ServiceSelector } from "@/components/services/ServiceSelector";

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

interface PackageItem {
  serviceId: string;
  quantity: number;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

interface OutletContextType {
  onMenuClick: () => void;
}

export default function Services() {
  const { onMenuClick } = useOutletContext<OutletContextType>();
  const { user } = useAuth();
  const { barbershop, categories, loading: barbershopLoading, refreshCategories } = useBarbershop();
  const { checkLimit } = useSubscription();
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("services");
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; service: Service | null }>({
    open: false,
    service: null,
  });
  const [limitModal, setLimitModal] = useState<{ open: boolean; current: number; limit: number }>({
    open: false,
    current: 0,
    limit: 0,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    duration: "30",
    agentEnabled: true,
    isPackage: false,
    categoryId: "",
  });
  const [selectedPackageItems, setSelectedPackageItems] = useState<PackageItem[]>([]);
  const [existingPackageItems, setExistingPackageItems] = useState<PackageItem[]>([]);

  // Count services per category
  const servicesCountByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    services.forEach((s) => {
      if (s.categoryId) {
        counts[s.categoryId] = (counts[s.categoryId] || 0) + 1;
      }
    });
    return counts;
  }, [services]);

  // Group services by category
  const servicesByCategory = useMemo(() => {
    const grouped: Record<string, Service[]> = { uncategorized: [] };
    
    categories.forEach((cat) => {
      grouped[cat.id] = [];
    });

    services.forEach((service) => {
      if (service.categoryId && grouped[service.categoryId]) {
        grouped[service.categoryId].push(service);
      } else {
        grouped.uncategorized.push(service);
      }
    });

    return grouped;
  }, [services, categories]);

  // Get only single services (non-packages) for package selector
  const singleServices = useMemo(() => {
    return services.filter((s) => !s.isPackage);
  }, [services]);

  useEffect(() => {
    if (barbershop) {
      fetchServices();
    }
  }, [barbershop]);

  // Calculate suggested price and duration when package items change
  useEffect(() => {
    if (formData.isPackage && selectedPackageItems.length > 0 && !editingService) {
      let totalPrice = 0;
      let totalDuration = 0;

      selectedPackageItems.forEach((item) => {
        const service = services.find((s) => s.id === item.serviceId);
        if (service) {
          totalPrice += service.price * item.quantity;
          totalDuration += service.duration_minutes * item.quantity;
        }
      });

      setFormData((prev) => ({
        ...prev,
        price: totalPrice.toFixed(2),
        duration: totalDuration.toString(),
      }));
    }
  }, [selectedPackageItems, formData.isPackage, services, editingService]);

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
    setSelectedPackageItems([]);
    setExistingPackageItems([]);
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

  const handleEdit = async (service: Service) => {
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

    // Load package items if it's a package
    if (service.isPackage) {
      try {
        const { data, error } = await supabase
          .from("service_package_items")
          .select("service_id, quantity")
          .eq("package_id", service.id);

        if (!error && data) {
          const items = data.map((item) => ({
            serviceId: item.service_id,
            quantity: item.quantity || 1,
          }));
          setSelectedPackageItems(items);
          setExistingPackageItems(items);
        }
      } catch (error) {
        console.error("Erro ao carregar itens do pacote:", error);
      }
    } else {
      setSelectedPackageItems([]);
      setExistingPackageItems([]);
    }

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

  const checkServiceInPackages = async (serviceId: string): Promise<string[]> => {
    try {
      const { data, error } = await supabase
        .from("service_package_items")
        .select("package_id, services!service_package_items_package_id_fkey(name)")
        .eq("service_id", serviceId);

      if (error) throw error;

      return (data || [])
        .map((item) => (item.services as any)?.name)
        .filter(Boolean);
    } catch (error) {
      console.error("Erro ao verificar pacotes:", error);
      return [];
    }
  };

  const handleDeleteClick = async (service: Service) => {
    // Check if service is part of any package
    if (!service.isPackage) {
      const packageNames = await checkServiceInPackages(service.id);
      if (packageNames.length > 0) {
        toast.error(
          `Este serviço faz parte de: ${packageNames.join(", ")}. Remova-o dos pacotes primeiro.`
        );
        return;
      }
    }
    setDeleteConfirm({ open: true, service });
  };

  const handleDelete = async () => {
    if (!deleteConfirm.service) return;

    try {
      // If it's a package, delete package items first
      if (deleteConfirm.service.isPackage) {
        await supabase
          .from("service_package_items")
          .delete()
          .eq("package_id", deleteConfirm.service.id);
      }

      const { error } = await supabase
        .from("services")
        .delete()
        .eq("id", deleteConfirm.service.id);

      if (error) throw error;

      setServices(services.filter((s) => s.id !== deleteConfirm.service!.id));
      toast.success("Serviço removido com sucesso");
    } catch (error) {
      console.error("Erro ao remover serviço:", error);
      toast.error("Erro ao remover serviço");
    } finally {
      setDeleteConfirm({ open: false, service: null });
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

    if (formData.isPackage && selectedPackageItems.length === 0) {
      toast.error("Selecione ao menos um serviço para o pacote");
      return;
    }

    if (!barbershop) {
      toast.error("Barbearia não encontrada");
      return;
    }

    setIsSaving(true);

    try {
      if (editingService) {
        // Update service
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

        // Update package items if it's a package
        if (formData.isPackage) {
          // Delete existing items
          await supabase
            .from("service_package_items")
            .delete()
            .eq("package_id", editingService.id);

          // Insert new items
          if (selectedPackageItems.length > 0) {
            const packageItems = selectedPackageItems.map((item) => ({
              package_id: editingService.id,
              service_id: item.serviceId,
              quantity: item.quantity,
            }));

            const { error: itemsError } = await supabase
              .from("service_package_items")
              .insert(packageItems);

            if (itemsError) throw itemsError;
          }
        }

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
        // Create new service
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

        // Insert package items if it's a package
        if (formData.isPackage && selectedPackageItems.length > 0) {
          const packageItems = selectedPackageItems.map((item) => ({
            package_id: data.id,
            service_id: item.serviceId,
            quantity: item.quantity,
          }));

          const { error: itemsError } = await supabase
            .from("service_package_items")
            .insert(packageItems);

          if (itemsError) throw itemsError;
        }

        // Auto-assign service to owner on basico plan
        // Since the owner is the only professional, they should be linked to all services
        if (user) {
          const { data: subData } = await supabase
            .from("subscriptions")
            .select("plan_slug")
            .eq("barbershop_id", barbershop.id)
            .single();

          if (subData?.plan_slug === "basico") {
            await supabase
              .from("staff_services")
              .insert({
                barbershop_id: barbershop.id,
                user_id: user.id,
                service_id: data.id,
              });
          }
        }

        // Upload image if pending
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
        <Header title="Serviços" subtitle="Gerencie seu cardápio" onMenuClick={onMenuClick} />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const renderServiceCard = (service: Service) => (
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
        <Badge variant="outline">
          <Clock className="w-3 h-3 mr-1" />
          {service.duration_minutes} min
        </Badge>
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
          <Button variant="ghost" size="icon" onClick={() => handleEdit(service)}>
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDeleteClick(service)}
          >
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <Header title="Serviços" subtitle="Gerencie seu cardápio" onMenuClick={onMenuClick} />

      <div className="p-4 lg:p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="services" className="flex items-center gap-2">
              <Scissors className="w-4 h-4" />
              Serviços
            </TabsTrigger>
            <TabsTrigger value="categories" className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4" />
              Categorias
            </TabsTrigger>
          </TabsList>

          {/* Services Tab */}
          <TabsContent value="services" className="space-y-6">
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
              <>
                {/* Services grouped by category */}
                {categories.map((category) => {
                  const categoryServices = servicesByCategory[category.id] || [];
                  if (categoryServices.length === 0) return null;

                  return (
                    <div key={category.id} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <h2 className="font-semibold text-lg">{category.name}</h2>
                        <Badge variant="secondary">{categoryServices.length}</Badge>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {categoryServices.map(renderServiceCard)}
                      </div>
                    </div>
                  );
                })}

                {/* Uncategorized services */}
                {servicesByCategory.uncategorized.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold text-lg text-muted-foreground">
                        Sem Categoria
                      </h2>
                      <Badge variant="secondary">
                        {servicesByCategory.uncategorized.length}
                      </Badge>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {servicesByCategory.uncategorized.map(renderServiceCard)}
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* Categories Tab */}
          <TabsContent value="categories">
            {barbershop && (
              <CategoryManager
                categories={categories}
                barbershopId={barbershop.id}
                onCategoriesChange={refreshCategories}
                servicesCount={servicesCountByCategory}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>

      {activeTab === "services" && services.length > 0 && (
        <FAB onClick={handleCreate} icon={<Plus className="w-6 h-6" />} />
      )}

      {/* Create/Edit Service Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingService ? "Editar Serviço" : "Novo Serviço"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Service Type Selector (only for new services) */}
            {!editingService && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFormData({ ...formData, isPackage: false });
                    setSelectedPackageItems([]);
                  }}
                  className={`p-4 rounded-lg border-2 transition-colors text-left ${
                    !formData.isPackage
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/30"
                  }`}
                >
                  <Scissors className="w-5 h-5 mb-2 text-primary" />
                  <p className="font-medium">Serviço</p>
                  <p className="text-xs text-muted-foreground">Serviço individual</p>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, isPackage: true })}
                  className={`p-4 rounded-lg border-2 transition-colors text-left ${
                    formData.isPackage
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/30"
                  }`}
                >
                  <Package className="w-5 h-5 mb-2 text-primary" />
                  <p className="font-medium">Pacote</p>
                  <p className="text-xs text-muted-foreground">Combo de serviços</p>
                </button>
              </div>
            )}

            {/* Package Service Selector */}
            {formData.isPackage && (
              <div className="space-y-2">
                <Label>Serviços do Pacote *</Label>
                <ServiceSelector
                  services={singleServices}
                  selectedServices={selectedPackageItems}
                  onSelectionChange={setSelectedPackageItems}
                  excludeServiceId={editingService?.id}
                />
              </div>
            )}

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
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Corte Degradê"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">
                  Preço (R$) *
                  {formData.isPackage && selectedPackageItems.length > 0 && (
                    <span className="text-xs text-muted-foreground ml-1">(sugerido)</span>
                  )}
                </Label>
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
                <Label htmlFor="duration">
                  Duração (minutos)
                  {formData.isPackage && selectedPackageItems.length > 0 && (
                    <span className="text-xs text-muted-foreground ml-1">(calculado)</span>
                  )}
                </Label>
                <Input
                  id="duration"
                  type="number"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                  placeholder="30"
                />
              </div>

              {!formData.isPackage && (
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
              )}
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

            <div className="flex items-center justify-between pt-2">
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

            <Button onClick={handleSubmit} className="w-full" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : editingService ? (
                "Salvar Alterações"
              ) : (
                `Criar ${formData.isPackage ? "Pacote" : "Serviço"}`
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm({ ...deleteConfirm, open })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover serviço?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm.service?.isPackage ? (
                "Este pacote será removido. Os serviços que o compõem não serão afetados."
              ) : (
                "Tem certeza que deseja remover este serviço? Esta ação não pode ser desfeita."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
