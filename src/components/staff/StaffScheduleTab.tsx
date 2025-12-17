import { useState, useEffect } from "react";
import { Loader2, Copy, Clock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface DaySchedule {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_working: boolean;
  break_start: string | null;
  break_end: string | null;
}

interface StaffScheduleTabProps {
  userId: string;
  barbershopId: string;
  isReadOnly?: boolean;
}

const DAY_NAMES = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado"
];

const DEFAULT_SCHEDULE: Omit<DaySchedule, 'day_of_week'>[] = Array(7).fill({
  start_time: "09:00",
  end_time: "18:00",
  is_working: false,
  break_start: null,
  break_end: null
});

export function StaffScheduleTab({ userId, barbershopId, isReadOnly = false }: StaffScheduleTabProps) {
  const [schedules, setSchedules] = useState<DaySchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [showBreaks, setShowBreaks] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchSchedules();
  }, [userId, barbershopId]);

  const fetchSchedules = async () => {
    try {
      const { data, error } = await supabase
        .from("staff_schedules")
        .select("*")
        .eq("user_id", userId)
        .eq("barbershop_id", barbershopId)
        .order("day_of_week");

      if (error) throw error;

      // Initialize all 7 days with existing data or defaults
      const scheduleMap = new Map<number, DaySchedule>();
      (data || []).forEach(s => {
        scheduleMap.set(s.day_of_week, s);
        if (s.break_start || s.break_end) {
          setShowBreaks(prev => new Set([...prev, s.day_of_week]));
        }
      });

      const fullSchedule: DaySchedule[] = [];
      for (let i = 0; i < 7; i++) {
        if (scheduleMap.has(i)) {
          fullSchedule.push(scheduleMap.get(i)!);
        } else {
          fullSchedule.push({
            day_of_week: i,
            start_time: "09:00",
            end_time: "18:00",
            is_working: i >= 1 && i <= 5, // Mon-Fri default
            break_start: null,
            break_end: null
          });
        }
      }

      setSchedules(fullSchedule);
    } catch (error) {
      console.error("Error fetching schedules:", error);
      toast.error("Erro ao carregar horários");
    } finally {
      setLoading(false);
    }
  };

  const saveSchedule = async (daySchedule: DaySchedule) => {
    if (isReadOnly) return;

    setSaving(daySchedule.day_of_week);
    try {
      if (daySchedule.id) {
        // Update existing
        const { error } = await supabase
          .from("staff_schedules")
          .update({
            start_time: daySchedule.start_time,
            end_time: daySchedule.end_time,
            is_working: daySchedule.is_working,
            break_start: daySchedule.break_start,
            break_end: daySchedule.break_end
          })
          .eq("id", daySchedule.id);
        if (error) throw error;
      } else {
        // Insert new
        const { data, error } = await supabase
          .from("staff_schedules")
          .insert({
            user_id: userId,
            barbershop_id: barbershopId,
            day_of_week: daySchedule.day_of_week,
            start_time: daySchedule.start_time,
            end_time: daySchedule.end_time,
            is_working: daySchedule.is_working,
            break_start: daySchedule.break_start,
            break_end: daySchedule.break_end
          })
          .select()
          .single();
        if (error) throw error;
        
        // Update local state with new id
        setSchedules(prev => prev.map(s => 
          s.day_of_week === daySchedule.day_of_week ? { ...s, id: data.id } : s
        ));
      }
    } catch (error) {
      console.error("Error saving schedule:", error);
      toast.error("Erro ao salvar horário");
    } finally {
      setSaving(null);
    }
  };

  const updateSchedule = (dayOfWeek: number, updates: Partial<DaySchedule>) => {
    setSchedules(prev => prev.map(s => 
      s.day_of_week === dayOfWeek ? { ...s, ...updates } : s
    ));
  };

  const handleToggleWorking = async (dayOfWeek: number, isWorking: boolean) => {
    const schedule = schedules.find(s => s.day_of_week === dayOfWeek);
    if (!schedule) return;
    
    const updated = { ...schedule, is_working: isWorking };
    updateSchedule(dayOfWeek, { is_working: isWorking });
    await saveSchedule(updated);
  };

  const handleTimeChange = async (dayOfWeek: number, field: keyof DaySchedule, value: string) => {
    const schedule = schedules.find(s => s.day_of_week === dayOfWeek);
    if (!schedule) return;
    
    updateSchedule(dayOfWeek, { [field]: value || null });
  };

  const handleTimeBlur = async (dayOfWeek: number) => {
    const schedule = schedules.find(s => s.day_of_week === dayOfWeek);
    if (!schedule) return;
    await saveSchedule(schedule);
  };

  const copyToAllDays = async () => {
    if (isReadOnly) return;

    const mondaySchedule = schedules.find(s => s.day_of_week === 1);
    if (!mondaySchedule) return;

    setSaving(-1); // -1 indicates copying all
    try {
      for (let i = 0; i < 7; i++) {
        if (i === 1) continue; // Skip Monday
        
        const currentSchedule = schedules.find(s => s.day_of_week === i);
        const updated: DaySchedule = {
          ...currentSchedule!,
          start_time: mondaySchedule.start_time,
          end_time: mondaySchedule.end_time,
          is_working: mondaySchedule.is_working,
          break_start: mondaySchedule.break_start,
          break_end: mondaySchedule.break_end
        };
        
        await saveSchedule(updated);
        updateSchedule(i, updated);
      }
      toast.success("Horários copiados para todos os dias");
    } catch (error) {
      console.error("Error copying schedule:", error);
      toast.error("Erro ao copiar horários");
    } finally {
      setSaving(null);
    }
  };

  const toggleBreak = (dayOfWeek: number) => {
    setShowBreaks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dayOfWeek)) {
        newSet.delete(dayOfWeek);
        // Clear break times when hiding
        const schedule = schedules.find(s => s.day_of_week === dayOfWeek);
        if (schedule) {
          const updated = { ...schedule, break_start: null, break_end: null };
          updateSchedule(dayOfWeek, { break_start: null, break_end: null });
          saveSchedule(updated);
        }
      } else {
        newSet.add(dayOfWeek);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Configure os horários de trabalho semanais
        </p>
        {!isReadOnly && (
          <Button
            variant="outline"
            size="sm"
            onClick={copyToAllDays}
            disabled={saving !== null}
          >
            <Copy className="w-4 h-4 mr-2" />
            Copiar Segunda para todos
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {schedules.map((schedule) => (
          <div
            key={schedule.day_of_week}
            className={`p-4 rounded-lg border transition-colors ${
              schedule.is_working ? "bg-card" : "bg-muted/30"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              {/* Day name and toggle */}
              <div className="flex items-center justify-between sm:w-40">
                <Label className="font-medium">{DAY_NAMES[schedule.day_of_week]}</Label>
                <Switch
                  checked={schedule.is_working}
                  onCheckedChange={(checked) => handleToggleWorking(schedule.day_of_week, checked)}
                  disabled={isReadOnly || saving !== null}
                />
              </div>

              {/* Time inputs */}
              {schedule.is_working && (
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={schedule.start_time}
                      onChange={(e) => handleTimeChange(schedule.day_of_week, "start_time", e.target.value)}
                      onBlur={() => handleTimeBlur(schedule.day_of_week)}
                      disabled={isReadOnly || saving !== null}
                      className="w-[110px]"
                    />
                    <span className="text-muted-foreground">às</span>
                    <Input
                      type="time"
                      value={schedule.end_time}
                      onChange={(e) => handleTimeChange(schedule.day_of_week, "end_time", e.target.value)}
                      onBlur={() => handleTimeBlur(schedule.day_of_week)}
                      disabled={isReadOnly || saving !== null}
                      className="w-[110px]"
                    />
                  </div>

                  {/* Break toggle button */}
                  {!isReadOnly && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleBreak(schedule.day_of_week)}
                      className="text-muted-foreground"
                    >
                      <Clock className="w-4 h-4 mr-1" />
                      {showBreaks.has(schedule.day_of_week) ? "Remover pausa" : "Adicionar pausa"}
                    </Button>
                  )}

                  {saving === schedule.day_of_week && (
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  )}
                </div>
              )}

              {!schedule.is_working && (
                <span className="text-sm text-muted-foreground">Não trabalha</span>
              )}
            </div>

            {/* Break time inputs */}
            {schedule.is_working && showBreaks.has(schedule.day_of_week) && (
              <div className="mt-3 pl-0 sm:pl-44 flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Pausa:</span>
                <Input
                  type="time"
                  value={schedule.break_start || ""}
                  onChange={(e) => handleTimeChange(schedule.day_of_week, "break_start", e.target.value)}
                  onBlur={() => handleTimeBlur(schedule.day_of_week)}
                  disabled={isReadOnly || saving !== null}
                  className="w-[110px]"
                  placeholder="Início"
                />
                <span className="text-muted-foreground">às</span>
                <Input
                  type="time"
                  value={schedule.break_end || ""}
                  onChange={(e) => handleTimeChange(schedule.day_of_week, "break_end", e.target.value)}
                  onBlur={() => handleTimeBlur(schedule.day_of_week)}
                  disabled={isReadOnly || saving !== null}
                  className="w-[110px]"
                  placeholder="Fim"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {saving === -1 && (
        <div className="flex items-center justify-center gap-2 py-2">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Copiando horários...</span>
        </div>
      )}
    </div>
  );
}
