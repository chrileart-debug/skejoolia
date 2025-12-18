import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Service {
  id: string;
  name: string;
  price: number;
}

interface SelectedService {
  service_id: string;
  quantity_limit: number;
}

interface BarberPlan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  interval: string;
  is_active: boolean;
  items?: {
    id: string;
    service_id: string;
    quantity_limit: number | null;
  }[];
}

interface ClubPlanModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  plan: BarberPlan | null;
  barbershopId: string;
}

export function ClubPlanModal({
  open,
  onClose,
  onSaved,
  plan,
  barbershopId,
}: ClubPlanModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [interval, setInterval] = useState("month");
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && barbershopId) {
      fetchServices();
    }
  }, [open, barbershopId]);

  useEffect(() => {
    if (plan) {
      setName(plan.name);
      setDescription(plan.description || "");
      setPrice(plan.price.toString());
      setInterval(plan.interval || "month");
      setSelectedServices(
        (plan.items || []).map((item) => ({
          service_id: item.service_id,
          quantity_limit: item.quantity_limit || 0,
        }))
      );
    } else {
      resetForm();
    }
  }, [plan, open]);

  const fetchServices = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("services")
        .select("id, name, price")
        .eq("barbershop_id", barbershopId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error("Error fetching services:", error);
      toast.error("Erro ao carregar serviços");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setPrice("");
    setInterval("month");
    setSelectedServices([]);
  };

  const handleServiceToggle = (serviceId: string, checked: boolean) => {
    if (checked) {
      setSelectedServices([
        ...selectedServices,
        { service_id: serviceId, quantity_limit: 0 },
      ]);
    } else {
      setSelectedServices(
        selectedServices.filter((s) => s.service_id !== serviceId)
      );
    }
  };

  const handleQuantityChange = (serviceId: string, quantity: string) => {
    setSelectedServices(
      selectedServices.map((s) =>
        s.service_id === serviceId
          ? { ...s, quantity_limit: parseInt(quantity) || 0 }
          : s
      )
    );
  };

  const isServiceSelected = (serviceId: string) => {
    return selectedServices.some((s) => s.service_id === serviceId);
  };

  const getServiceQuantity = (serviceId: string) => {
    const service = selectedServices.find((s) => s.service_id === serviceId);
    return service?.quantity_limit || 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Nome do plano é obrigatório");
      return;
    }

    if (!price || parseFloat(price) <= 0) {
      toast.error("Preço deve ser maior que zero");
      return;
    }

    if (selectedServices.length === 0) {
      toast.error("Selecione pelo menos um serviço");
      return;
    }

    setSaving(true);

    try {
      const planData = {
        barbershop_id: barbershopId,
        name: name.trim(),
        description: description.trim() || null,
        price: parseFloat(price),
        interval,
        is_active: true,
        // New plans always start as draft - only manual DB update can publish
        ...(plan ? {} : { is_published: false }),
      };

      let planId: string;

      if (plan) {
        // Update existing plan
        const { error: updateError } = await supabase
          .from("barber_plans")
          .update(planData)
          .eq("id", plan.id);

        if (updateError) throw updateError;
        planId = plan.id;

        // Delete existing items
        await supabase
          .from("barber_plan_items")
          .delete()
          .eq("plan_id", plan.id);
      } else {
        // Create new plan
        const { data: newPlan, error: insertError } = await supabase
          .from("barber_plans")
          .insert(planData)
          .select("id")
          .single();

        if (insertError) throw insertError;
        planId = newPlan.id;
      }

      // Insert plan items
      const itemsToInsert = selectedServices.map((s) => ({
        plan_id: planId,
        service_id: s.service_id,
        quantity_limit: s.quantity_limit || 0,
      }));

      const { error: itemsError } = await supabase
        .from("barber_plan_items")
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      toast.success(plan ? "Plano atualizado!" : "Plano criado!");
      onSaved();
    } catch (error) {
      console.error("Error saving plan:", error);
      toast.error("Erro ao salvar plano");
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (value: string) => {
    const numericValue = value.replace(/\D/g, "");
    const floatValue = parseFloat(numericValue) / 100;
    return floatValue.toFixed(2);
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, "");
    if (rawValue) {
      const floatValue = parseFloat(rawValue) / 100;
      setPrice(floatValue.toString());
    } else {
      setPrice("");
    }
  };

  const displayPrice = price
    ? new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(parseFloat(price))
    : "";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {plan ? "Editar Plano" : "Criar Novo Plano"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Plano *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Plano Mensal Premium"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva os benefícios do plano..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Preço *</Label>
                <Input
                  id="price"
                  value={displayPrice}
                  onChange={handlePriceChange}
                  placeholder="R$ 0,00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="interval">Cobrança</Label>
                <Select value={interval} onValueChange={setInterval}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">Mensal</SelectItem>
                    <SelectItem value="year">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <Label>Serviços Inclusos *</Label>
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : services.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhum serviço cadastrado
              </p>
            ) : (
              <div className="space-y-3 max-h-[200px] overflow-y-auto border rounded-lg p-3">
                {services.map((service) => (
                  <div
                    key={service.id}
                    className="flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <Checkbox
                        id={service.id}
                        checked={isServiceSelected(service.id)}
                        onCheckedChange={(checked) =>
                          handleServiceToggle(service.id, checked as boolean)
                        }
                      />
                      <label
                        htmlFor={service.id}
                        className="text-sm cursor-pointer flex-1"
                      >
                        {service.name}
                      </label>
                    </div>
                    {isServiceSelected(service.id) && (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          value={getServiceQuantity(service.id) || ""}
                          onChange={(e) =>
                            handleQuantityChange(service.id, e.target.value)
                          }
                          placeholder="0"
                          className="w-20 h-8 text-sm"
                        />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          x/mês
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Deixe a quantidade em 0 para ilimitado
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="flex-1">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {plan ? "Salvar" : "Criar Plano"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
