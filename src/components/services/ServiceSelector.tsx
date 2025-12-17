import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Clock, DollarSign, Plus, Minus } from "lucide-react";

interface Service {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
  categoryName?: string;
}

interface SelectedService {
  serviceId: string;
  quantity: number;
}

interface ServiceSelectorProps {
  services: Service[];
  selectedServices: SelectedService[];
  onSelectionChange: (selected: SelectedService[]) => void;
  excludeServiceId?: string; // Exclude current service when editing
}

export function ServiceSelector({
  services,
  selectedServices,
  onSelectionChange,
  excludeServiceId,
}: ServiceSelectorProps) {
  const [search, setSearch] = useState("");

  // Filter out packages and optionally the current service being edited
  const availableServices = useMemo(() => {
    return services.filter((s) => {
      if (excludeServiceId && s.id === excludeServiceId) return false;
      const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase());
      return matchesSearch;
    });
  }, [services, search, excludeServiceId]);

  const isSelected = (serviceId: string) => {
    return selectedServices.some((s) => s.serviceId === serviceId);
  };

  const getQuantity = (serviceId: string) => {
    const found = selectedServices.find((s) => s.serviceId === serviceId);
    return found?.quantity || 1;
  };

  const toggleService = (serviceId: string) => {
    if (isSelected(serviceId)) {
      onSelectionChange(selectedServices.filter((s) => s.serviceId !== serviceId));
    } else {
      onSelectionChange([...selectedServices, { serviceId, quantity: 1 }]);
    }
  };

  const updateQuantity = (serviceId: string, delta: number) => {
    onSelectionChange(
      selectedServices.map((s) => {
        if (s.serviceId === serviceId) {
          const newQty = Math.max(1, s.quantity + delta);
          return { ...s, quantity: newQty };
        }
        return s;
      })
    );
  };

  // Calculate totals
  const totals = useMemo(() => {
    let price = 0;
    let duration = 0;

    selectedServices.forEach((selected) => {
      const service = services.find((s) => s.id === selected.serviceId);
      if (service) {
        price += service.price * selected.quantity;
        duration += service.duration_minutes * selected.quantity;
      }
    });

    return { price, duration };
  }, [selectedServices, services]);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar serviços..."
          className="pl-9"
        />
      </div>

      {/* Service List */}
      <ScrollArea className="h-[200px] border border-border rounded-lg">
        <div className="p-2 space-y-1">
          {availableServices.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">
              {search ? "Nenhum serviço encontrado" : "Nenhum serviço disponível"}
            </p>
          ) : (
            availableServices.map((service) => {
              const selected = isSelected(service.id);
              const quantity = getQuantity(service.id);

              return (
                <div
                  key={service.id}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-colors cursor-pointer ${
                    selected
                      ? "bg-primary/10 border border-primary/30"
                      : "hover:bg-muted/50"
                  }`}
                  onClick={() => toggleService(service.id)}
                >
                  <Checkbox checked={selected} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{service.name}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        R$ {service.price.toFixed(2)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {service.duration_minutes} min
                      </span>
                    </div>
                  </div>
                  {selected && (
                    <div
                      className="flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => updateQuantity(service.id, -1)}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="w-6 text-center text-sm font-medium">
                        {quantity}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => updateQuantity(service.id, 1)}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Summary */}
      {selectedServices.length > 0 && (
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              {selectedServices.length} serviço(s) selecionado(s)
            </p>
            <div className="flex items-center gap-4">
              <Badge variant="secondary" className="font-normal">
                <DollarSign className="w-3 h-3 mr-1" />
                Sugerido: R$ {totals.price.toFixed(2)}
              </Badge>
              <Badge variant="secondary" className="font-normal">
                <Clock className="w-3 h-3 mr-1" />
                Total: {totals.duration} min
              </Badge>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
