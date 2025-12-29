import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Calendar, CalendarDays, LayoutGrid } from "lucide-react";

export type ViewType = "month" | "week" | "day";

interface ViewToggleProps {
  value: ViewType;
  onChange: (value: ViewType) => void;
}

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(val) => val && onChange(val as ViewType)}
      className="bg-muted/50 border border-border rounded-lg p-1"
    >
      <ToggleGroupItem
        value="month"
        aria-label="Visualização mensal"
        className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm px-3 py-1.5 text-xs sm:text-sm gap-1.5 rounded-md"
      >
        <LayoutGrid className="w-4 h-4" />
        <span className="hidden sm:inline">Mês</span>
      </ToggleGroupItem>
      <ToggleGroupItem
        value="week"
        aria-label="Visualização semanal"
        className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm px-3 py-1.5 text-xs sm:text-sm gap-1.5 rounded-md"
      >
        <CalendarDays className="w-4 h-4" />
        <span className="hidden sm:inline">Semana</span>
      </ToggleGroupItem>
      <ToggleGroupItem
        value="day"
        aria-label="Visualização diária"
        className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm px-3 py-1.5 text-xs sm:text-sm gap-1.5 rounded-md"
      >
        <Calendar className="w-4 h-4" />
        <span className="hidden sm:inline">Dia</span>
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
