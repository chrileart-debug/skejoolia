import { useState, useEffect } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Service {
  id: string;
  name: string;
  price: number;
  category_id: string | null;
  is_package: boolean;
}

interface Category {
  id: string;
  name: string;
}

interface StaffServicesTabProps {
  userId: string;
  barbershopId: string;
  isReadOnly?: boolean;
}

export function StaffServicesTab({ userId, barbershopId, isReadOnly = false }: StaffServicesTabProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [staffServices, setStaffServices] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [userId, barbershopId]);

  const fetchData = async () => {
    try {
      // Fetch services, categories, and staff_services in parallel
      const [servicesRes, categoriesRes, staffServicesRes] = await Promise.all([
        supabase
          .from("services")
          .select("id, name, price, category_id, is_package")
          .eq("barbershop_id", barbershopId)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("categories")
          .select("id, name")
          .eq("barbershop_id", barbershopId)
          .eq("is_active", true)
          .order("display_order"),
        supabase
          .from("staff_services")
          .select("service_id")
          .eq("user_id", userId)
          .eq("barbershop_id", barbershopId)
      ]);

      if (servicesRes.error) throw servicesRes.error;
      if (categoriesRes.error) throw categoriesRes.error;
      if (staffServicesRes.error) throw staffServicesRes.error;

      setServices(servicesRes.data || []);
      setCategories(categoriesRes.data || []);
      setStaffServices(new Set((staffServicesRes.data || []).map(s => s.service_id)));
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar serviços");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleService = async (serviceId: string, checked: boolean) => {
    if (isReadOnly) return;
    
    setSaving(serviceId);
    try {
      if (checked) {
        // Insert into staff_services
        const { error } = await supabase
          .from("staff_services")
          .insert({
            user_id: userId,
            service_id: serviceId,
            barbershop_id: barbershopId
          });
        if (error) throw error;
        setStaffServices(prev => new Set([...prev, serviceId]));
      } else {
        // Delete from staff_services
        const { error } = await supabase
          .from("staff_services")
          .delete()
          .eq("user_id", userId)
          .eq("service_id", serviceId)
          .eq("barbershop_id", barbershopId);
        if (error) throw error;
        setStaffServices(prev => {
          const newSet = new Set(prev);
          newSet.delete(serviceId);
          return newSet;
        });
      }
    } catch (error) {
      console.error("Error toggling service:", error);
      toast.error("Erro ao atualizar serviço");
    } finally {
      setSaving(null);
    }
  };

  // Group services by category
  const servicesByCategory = services.reduce((acc, service) => {
    const categoryId = service.category_id || "uncategorized";
    if (!acc[categoryId]) {
      acc[categoryId] = [];
    }
    acc[categoryId].push(service);
    return acc;
  }, {} as Record<string, Service[]>);

  const getCategoryName = (categoryId: string) => {
    if (categoryId === "uncategorized") return "Sem categoria";
    return categories.find(c => c.id === categoryId)?.name || "Sem categoria";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Nenhum serviço cadastrado.</p>
        <p className="text-sm mt-1">Crie serviços na página de Serviços primeiro.</p>
      </div>
    );
  }

  const selectedCount = staffServices.size;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Selecione os serviços que este profissional realiza
        </p>
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="w-4 h-4 text-primary" />
          <span className="text-muted-foreground">{selectedCount} selecionado(s)</span>
        </div>
      </div>

      {Object.entries(servicesByCategory).map(([categoryId, categoryServices]) => (
        <div key={categoryId} className="space-y-3">
          <h4 className="text-sm font-medium text-foreground border-b pb-2">
            {getCategoryName(categoryId)}
          </h4>
          <div className="space-y-2">
            {categoryServices.map(service => (
              <div
                key={service.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    id={`service-${service.id}`}
                    checked={staffServices.has(service.id)}
                    onCheckedChange={(checked) => handleToggleService(service.id, !!checked)}
                    disabled={isReadOnly || saving === service.id}
                  />
                  <Label
                    htmlFor={`service-${service.id}`}
                    className="cursor-pointer flex-1"
                  >
                    <span className="font-medium">{service.name}</span>
                    {service.is_package && (
                      <span className="ml-2 text-xs text-primary">(Pacote)</span>
                    )}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  {saving === service.id && (
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  )}
                  <span className="text-sm text-muted-foreground">
                    R$ {service.price.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
