import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export interface DaySchedule {
  start: string;
  end: string;
  enabled: boolean;
}

export interface WorkSchedule {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

const DEFAULT_DAY: DaySchedule = {
  start: "08:00",
  end: "18:00",
  enabled: false,
};

export const DEFAULT_WORK_SCHEDULE: WorkSchedule = {
  monday: { start: "08:00", end: "18:00", enabled: true },
  tuesday: { start: "08:00", end: "18:00", enabled: true },
  wednesday: { start: "08:00", end: "18:00", enabled: true },
  thursday: { start: "08:00", end: "18:00", enabled: true },
  friday: { start: "08:00", end: "18:00", enabled: true },
  saturday: { start: "08:00", end: "18:00", enabled: true },
  sunday: { start: "08:00", end: "18:00", enabled: false },
};

const DAY_LABELS: Record<keyof WorkSchedule, string> = {
  monday: "Segunda",
  tuesday: "Terça",
  wednesday: "Quarta",
  thursday: "Quinta",
  friday: "Sexta",
  saturday: "Sábado",
  sunday: "Domingo",
};

const DAY_ORDER: (keyof WorkSchedule)[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

interface WorkScheduleEditorProps {
  value: WorkSchedule;
  onChange: (schedule: WorkSchedule) => void;
}

export function parseWorkSchedule(data: unknown): WorkSchedule {
  if (!data || typeof data !== "object") {
    return { ...DEFAULT_WORK_SCHEDULE };
  }

  const schedule = { ...DEFAULT_WORK_SCHEDULE };
  const obj = data as Record<string, unknown>;

  for (const day of DAY_ORDER) {
    if (obj[day] && typeof obj[day] === "object") {
      const dayData = obj[day] as Record<string, unknown>;
      schedule[day] = {
        start: typeof dayData.start === "string" ? dayData.start : DEFAULT_DAY.start,
        end: typeof dayData.end === "string" ? dayData.end : DEFAULT_DAY.end,
        enabled: typeof dayData.enabled === "boolean" ? dayData.enabled : DEFAULT_DAY.enabled,
      };
    }
  }

  return schedule;
}

export function WorkScheduleEditor({ value, onChange }: WorkScheduleEditorProps) {
  const handleDayChange = (
    day: keyof WorkSchedule,
    field: keyof DaySchedule,
    newValue: string | boolean
  ) => {
    onChange({
      ...value,
      [day]: {
        ...value[day],
        [field]: newValue,
      },
    });
  };

  return (
    <div className="space-y-3">
      <Label>Horário de Trabalho</Label>
      <div className="space-y-2 rounded-lg border border-border p-3">
        {DAY_ORDER.map((day) => (
          <div
            key={day}
            className="flex items-center gap-3 py-2 border-b border-border last:border-b-0"
          >
            <div className="w-20 flex items-center gap-2">
              <Switch
                checked={value[day].enabled}
                onCheckedChange={(checked) =>
                  handleDayChange(day, "enabled", checked)
                }
              />
            </div>
            <span className="w-20 text-sm font-medium text-foreground">
              {DAY_LABELS[day]}
            </span>
            <div className="flex items-center gap-2 flex-1">
              <Input
                type="time"
                value={value[day].start}
                onChange={(e) => handleDayChange(day, "start", e.target.value)}
                disabled={!value[day].enabled}
                className="w-24 text-sm"
              />
              <span className="text-muted-foreground text-sm">até</span>
              <Input
                type="time"
                value={value[day].end}
                onChange={(e) => handleDayChange(day, "end", e.target.value)}
                disabled={!value[day].enabled}
                className="w-24 text-sm"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
