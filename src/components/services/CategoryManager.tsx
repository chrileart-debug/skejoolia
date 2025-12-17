import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Edit2, Trash2, GripVertical, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/shared/EmptyState";
import * as LucideIcons from "lucide-react";

// Common category icons
const CATEGORY_ICONS = [
  { name: "scissors", label: "Tesoura" },
  { name: "user", label: "Usuário" },
  { name: "star", label: "Estrela" },
  { name: "heart", label: "Coração" },
  { name: "sparkles", label: "Brilhos" },
  { name: "crown", label: "Coroa" },
  { name: "zap", label: "Raio" },
  { name: "gem", label: "Diamante" },
  { name: "gift", label: "Presente" },
  { name: "package", label: "Pacote" },
  { name: "shopping-bag", label: "Sacola" },
  { name: "tag", label: "Tag" },
];

interface Category {
  id: string;
  name: string;
  icon: string | null;
  display_order: number;
  is_active: boolean;
}

interface CategoryManagerProps {
  categories: Category[];
  barbershopId: string;
  onCategoriesChange: () => void;
  servicesCount: Record<string, number>;
}

// Helper to render Lucide icon by name
const LucideIcon = ({ name, className }: { name: string; className?: string }) => {
  const iconName = name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("") as keyof typeof LucideIcons;
  
  const IconComponent = LucideIcons[iconName] as React.ComponentType<{ className?: string }>;
  
  if (!IconComponent) {
    return <LucideIcons.Tag className={className} />;
  }
  
  return <IconComponent className={className} />;
};

export function CategoryManager({ 
  categories, 
  barbershopId, 
  onCategoriesChange,
  servicesCount 
}: CategoryManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; category: Category | null }>({
    open: false,
    category: null,
  });
  const [formData, setFormData] = useState({
    name: "",
    icon: "tag",
    display_order: 0,
  });

  const resetForm = () => {
    setFormData({
      name: "",
      icon: "tag",
      display_order: categories.length,
    });
    setEditingCategory(null);
  };

  const handleCreate = () => {
    resetForm();
    setFormData((prev) => ({ ...prev, display_order: categories.length }));
    setIsDialogOpen(true);
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      icon: category.icon || "tag",
      display_order: category.display_order,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteConfirm.category) return;

    try {
      // Check if category has services
      const count = servicesCount[deleteConfirm.category.id] || 0;
      
      if (count > 0) {
        // Set services to null category before deleting
        await supabase
          .from("services")
          .update({ category_id: null })
          .eq("category_id", deleteConfirm.category.id);
      }

      const { error } = await supabase
        .from("categories")
        .delete()
        .eq("id", deleteConfirm.category.id);

      if (error) throw error;

      toast.success("Categoria removida");
      onCategoriesChange();
    } catch (error) {
      console.error("Erro ao remover categoria:", error);
      toast.error("Erro ao remover categoria");
    } finally {
      setDeleteConfirm({ open: false, category: null });
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error("Digite o nome da categoria");
      return;
    }

    setIsSaving(true);

    try {
      if (editingCategory) {
        const { error } = await supabase
          .from("categories")
          .update({
            name: formData.name,
            icon: formData.icon,
            display_order: formData.display_order,
          })
          .eq("id", editingCategory.id);

        if (error) throw error;
        toast.success("Categoria atualizada");
      } else {
        const { error } = await supabase
          .from("categories")
          .insert({
            barbershop_id: barbershopId,
            name: formData.name,
            icon: formData.icon,
            display_order: formData.display_order,
          });

        if (error) throw error;
        toast.success("Categoria criada");
      }

      setIsDialogOpen(false);
      resetForm();
      onCategoriesChange();
    } catch (error) {
      console.error("Erro ao salvar categoria:", error);
      toast.error("Erro ao salvar categoria");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Organize seus serviços em categorias
        </p>
        <Button onClick={handleCreate} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Nova Categoria
        </Button>
      </div>

      {categories.length === 0 ? (
        <EmptyState
          icon={<LucideIcons.FolderOpen className="w-10 h-10 text-muted-foreground" />}
          title="Nenhuma categoria"
          description="Crie categorias para organizar seus serviços"
          action={
            <Button onClick={handleCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Criar Categoria
            </Button>
          }
          className="min-h-[40vh]"
        />
      ) : (
        <div className="space-y-2">
          {categories
            .sort((a, b) => a.display_order - b.display_order)
            .map((category) => (
              <div
                key={category.id}
                className="flex items-center gap-3 p-4 bg-card border border-border rounded-lg"
              >
                <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <LucideIcon name={category.icon || "tag"} className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate">{category.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {servicesCount[category.id] || 0} serviço(s)
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(category)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteConfirm({ open: true, category })}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "Editar Categoria" : "Nova Categoria"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cat-name">Nome *</Label>
              <Input
                id="cat-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Cabelo, Barba..."
              />
            </div>

            <div className="space-y-2">
              <Label>Ícone</Label>
              <Select
                value={formData.icon}
                onValueChange={(value) => setFormData({ ...formData, icon: value })}
              >
                <SelectTrigger>
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      <LucideIcon name={formData.icon} className="w-4 h-4" />
                      <span>{CATEGORY_ICONS.find((i) => i.name === formData.icon)?.label || formData.icon}</span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_ICONS.map((icon) => (
                    <SelectItem key={icon.name} value={icon.name}>
                      <div className="flex items-center gap-2">
                        <LucideIcon name={icon.name} className="w-4 h-4" />
                        <span>{icon.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cat-order">Ordem de Exibição</Label>
              <Input
                id="cat-order"
                type="number"
                min="0"
                value={formData.display_order}
                onChange={(e) =>
                  setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : editingCategory ? (
                "Salvar"
              ) : (
                "Criar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm({ ...deleteConfirm, open })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm.category && servicesCount[deleteConfirm.category.id] > 0 ? (
                <>
                  Esta categoria possui{" "}
                  <strong>{servicesCount[deleteConfirm.category.id]} serviço(s)</strong>.
                  Os serviços serão mantidos, mas ficarão sem categoria.
                </>
              ) : (
                "Tem certeza que deseja remover esta categoria?"
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
