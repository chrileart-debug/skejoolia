import { useState, useEffect } from "react";
import { Briefcase, Calendar, Loader2, Percent } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { StaffServicesTab } from "./StaffServicesTab";
import { StaffScheduleTab } from "./StaffScheduleTab";
import { StaffCommissionTab } from "./StaffCommissionTab";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { createDefaultStaffSchedules } from "@/lib/staffScheduleDefaults";

interface StaffConfigSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffMember: {
    user_id: string;
    name: string | null;
    role: "owner" | "staff";
  } | null;
  barbershopId: string;
  isOwner: boolean;
  isBasicoPlan?: boolean;
}

export function StaffConfigSheet({
  open,
  onOpenChange,
  staffMember,
  barbershopId,
  isOwner,
  isBasicoPlan = false
}: StaffConfigSheetProps) {
  const [isServiceProvider, setIsServiceProvider] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState(false);
  const [savingProvider, setSavingProvider] = useState(false);

  // Fetch current is_service_provider status
  useEffect(() => {
    const fetchServiceProviderStatus = async () => {
      if (!staffMember || !barbershopId || !open) return;

      setLoadingProvider(true);
      try {
        const { data, error } = await supabase
          .from("user_barbershop_roles")
          .select("is_service_provider")
          .eq("user_id", staffMember.user_id)
          .eq("barbershop_id", barbershopId)
          .single();

        if (error) throw error;
        
        // Staff members are always service providers, owners can toggle (unless basico plan)
        if (staffMember.role === "staff" || isBasicoPlan) {
          setIsServiceProvider(true);
        } else {
          setIsServiceProvider(data?.is_service_provider ?? false);
        }
      } catch (error) {
        console.error("Error fetching service provider status:", error);
        // Default: staff = true, owner on basico = true, owner on corporativo = false
        setIsServiceProvider(staffMember.role === "staff" || isBasicoPlan);
      } finally {
        setLoadingProvider(false);
      }
    };

    fetchServiceProviderStatus();
  }, [staffMember, barbershopId, open]);

  const handleToggleServiceProvider = async (checked: boolean) => {
    if (!staffMember || !barbershopId) return;

    setSavingProvider(true);
    try {
      const { error } = await supabase
        .from("user_barbershop_roles")
        .update({ is_service_provider: checked })
        .eq("user_id", staffMember.user_id)
        .eq("barbershop_id", barbershopId);

      if (error) throw error;

      // When enabling service provider, create default schedules
      if (checked) {
        const result = await createDefaultStaffSchedules(staffMember.user_id, barbershopId);
        if (!result.success) {
          console.warn("Failed to create default schedules:", result.error);
        }
      }

      setIsServiceProvider(checked);
      toast.success(checked 
        ? "Agora você aparecerá como profissional na agenda" 
        : "Você não aparecerá mais como profissional na agenda"
      );
    } catch (error) {
      console.error("Error updating service provider status:", error);
      toast.error("Erro ao atualizar configuração");
    } finally {
      setSavingProvider(false);
    }
  };

  if (!staffMember) return null;

  // Staff can edit their own config (not read-only when viewing themselves)
  // Owner can edit anyone's config
  const isViewingOwnProfile = staffMember.user_id === (typeof window !== 'undefined' ? localStorage.getItem('current_user_id') : null);
  const isReadOnly = false; // Staff can now edit their own services and schedules
  
  // Check if this is the owner configuring themselves
  const isOwnerSelfConfig = staffMember.role === "owner";
  
  // Show switch only for owner self-config on corporativo plan (basico is always service provider)
  const showServiceProviderSwitch = isOwnerSelfConfig && isOwner && !isBasicoPlan;
  
  // Tabs should be disabled if owner has not enabled service provider mode (not on basico)
  const tabsDisabled = isOwnerSelfConfig && !isServiceProvider && !loadingProvider && !isBasicoPlan;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle>Configurar Profissional</SheetTitle>
          <SheetDescription>
            {staffMember.name || "Sem nome"} - Especialidades e Horários
          </SheetDescription>
        </SheetHeader>

        {/* Service Provider Switch - Only for owner self-config */}
        {showServiceProviderSwitch && (
          <div className="mb-6 p-4 rounded-lg border bg-muted/50">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="service-provider-switch" className="text-base font-medium">
                  Atuar como Profissional na Agenda
                </Label>
                <p className="text-sm text-muted-foreground">
                  {isServiceProvider 
                    ? "Seu nome aparecerá para clientes agendarem" 
                    : "Você atua apenas como administrador"}
                </p>
              </div>
              {loadingProvider ? (
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              ) : (
                <Switch
                  id="service-provider-switch"
                  checked={isServiceProvider}
                  onCheckedChange={handleToggleServiceProvider}
                  disabled={savingProvider}
                />
              )}
            </div>
          </div>
        )}

        {/* Tabs - Disabled message when owner hasn't enabled service provider */}
        {tabsDisabled ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Calendar className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              Modo Administrador
            </h3>
            <p className="text-muted-foreground max-w-xs">
              Ative o switch acima para configurar suas especialidades e horários de atendimento.
            </p>
          </div>
        ) : (
        <Tabs defaultValue="services" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="services" className="flex items-center gap-1 text-xs sm:text-sm">
                <Briefcase className="w-4 h-4" />
                <span className="hidden sm:inline">Especialidades</span>
                <span className="sm:hidden">Serviços</span>
              </TabsTrigger>
              <TabsTrigger value="schedule" className="flex items-center gap-1 text-xs sm:text-sm">
                <Calendar className="w-4 h-4" />
                <span>Horários</span>
              </TabsTrigger>
              <TabsTrigger value="commission" className="flex items-center gap-1 text-xs sm:text-sm">
                <Percent className="w-4 h-4" />
                <span>Comissão</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="services" className="mt-4">
              <StaffServicesTab
                userId={staffMember.user_id}
                barbershopId={barbershopId}
                isReadOnly={isReadOnly}
              />
            </TabsContent>

            <TabsContent value="schedule" className="mt-4">
              <StaffScheduleTab
                userId={staffMember.user_id}
                barbershopId={barbershopId}
                isReadOnly={isReadOnly}
              />
            </TabsContent>

            <TabsContent value="commission" className="mt-4">
              <StaffCommissionTab
                userId={staffMember.user_id}
                barbershopId={barbershopId}
                isReadOnly={!isOwner}
              />
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}
