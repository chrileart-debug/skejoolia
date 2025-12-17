import { Briefcase, Calendar } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StaffServicesTab } from "./StaffServicesTab";
import { StaffScheduleTab } from "./StaffScheduleTab";

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
}

export function StaffConfigSheet({
  open,
  onOpenChange,
  staffMember,
  barbershopId,
  isOwner
}: StaffConfigSheetProps) {
  if (!staffMember) return null;

  // Staff can only view their own config, owners can edit anyone's
  const isReadOnly = !isOwner;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle>Configurar Profissional</SheetTitle>
          <SheetDescription>
            {staffMember.name || "Sem nome"} - Especialidades e Horários
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="services" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="services" className="flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              Especialidades
            </TabsTrigger>
            <TabsTrigger value="schedule" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Horários
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
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
