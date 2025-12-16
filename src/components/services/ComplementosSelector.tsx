import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Complemento {
  id_complemento: string;
  nome: string;
  preco: number;
  ativo: boolean;
}

interface ComplementosSelectorProps {
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

export function ComplementosSelector({ selectedIds, onSelectionChange }: ComplementosSelectorProps) {
  const { user } = useAuth();
  const [complementos, setComplementos] = useState<Complemento[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newComplemento, setNewComplemento] = useState({ nome: "", preco: "" });

  useEffect(() => {
    if (user) {
      fetchComplementos();
    }
  }, [user]);

  const fetchComplementos = async () => {
    try {
      const { data, error } = await supabase
        .from("complementos")
        .select("*")
        .eq("ativo", true)
        .order("nome", { ascending: true });

      if (error) throw error;
      setComplementos(data || []);
    } catch (error) {
      console.error("Erro ao carregar complementos:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((i) => i !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const formatPrice = (value: string) => {
    const numericValue = value.replace(/\D/g, "");
    const floatValue = parseFloat(numericValue) / 100;
    return floatValue.toFixed(2);
  };

  const handleAddComplemento = async () => {
    if (!newComplemento.nome.trim() || !newComplemento.preco) {
      toast.error("Preencha nome e valor do complemento");
      return;
    }

    if (!user) return;

    setIsAdding(true);
    try {
      const { data, error } = await supabase
        .from("complementos")
        .insert({
          user_id: user.id,
          nome: newComplemento.nome.trim(),
          preco: parseFloat(newComplemento.preco),
          ativo: true,
        })
        .select()
        .single();

      if (error) throw error;

      setComplementos([...complementos, data]);
      setNewComplemento({ nome: "", preco: "" });
      setShowAddForm(false);
      toast.success("Complemento criado com sucesso");
    } catch (error) {
      console.error("Erro ao criar complemento:", error);
      toast.error("Erro ao criar complemento");
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteComplemento = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      const { error } = await supabase
        .from("complementos")
        .delete()
        .eq("id_complemento", id);

      if (error) throw error;

      setComplementos(complementos.filter((c) => c.id_complemento !== id));
      onSelectionChange(selectedIds.filter((i) => i !== id));
      toast.success("Complemento removido");
    } catch (error) {
      console.error("Erro ao remover complemento:", error);
      toast.error("Erro ao remover complemento");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Complementos / Adicionais</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowAddForm(!showAddForm)}
          className="h-7 text-xs"
        >
          <Plus className="w-3 h-3 mr-1" />
          Criar novo
        </Button>
      </div>

      {/* Add new complemento form */}
      {showAddForm && (
        <div className="p-3 rounded-lg bg-muted/50 space-y-3 animate-fade-in">
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Nome (ex: Barba)"
              value={newComplemento.nome}
              onChange={(e) => setNewComplemento({ ...newComplemento, nome: e.target.value })}
              className="h-8 text-sm"
            />
            <Input
              placeholder="Valor (R$)"
              value={newComplemento.preco}
              onChange={(e) => setNewComplemento({ ...newComplemento, preco: formatPrice(e.target.value) })}
              className="h-8 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setShowAddForm(false);
                setNewComplemento({ nome: "", preco: "" });
              }}
              className="flex-1 h-7 text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleAddComplemento}
              disabled={isAdding}
              className="flex-1 h-7 text-xs"
            >
              {isAdding ? <Loader2 className="w-3 h-3 animate-spin" /> : "Adicionar"}
            </Button>
          </div>
        </div>
      )}

      {/* List of complementos */}
      {complementos.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">
          Nenhum complemento cadastrado. Crie um novo acima.
        </p>
      ) : (
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {complementos.map((comp) => (
            <div
              key={comp.id_complemento}
              className={`
                flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer
                ${selectedIds.includes(comp.id_complemento) 
                  ? "border-primary bg-primary/5" 
                  : "border-border hover:border-primary/30"}
              `}
              onClick={() => handleToggle(comp.id_complemento)}
            >
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={selectedIds.includes(comp.id_complemento)}
                  onCheckedChange={() => handleToggle(comp.id_complemento)}
                  className="pointer-events-none"
                />
                <span className="text-sm font-medium">{comp.nome}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-primary font-semibold">
                  R$ {comp.preco.toFixed(2)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={(e) => handleDeleteComplemento(comp.id_complemento, e)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedIds.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {selectedIds.length} complemento(s) selecionado(s)
        </p>
      )}
    </div>
  );
}
