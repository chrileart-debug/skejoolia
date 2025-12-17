import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bell, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Reminder {
  id?: string;
  reminder_type: "minutes" | "hours" | "days";
  reminder_value: number;
  is_enabled: boolean;
  display_order: number;
}

interface ReminderConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  barbershopId: string;
}

const MINUTE_OPTIONS = [5, 10, 15, 20, 30, 45];
const HOUR_OPTIONS = [1, 2, 3, 4, 6, 12];
const DAY_OPTIONS = [1, 2, 3, 4, 5, 7];

const MAX_REMINDERS = 5;

export function ReminderConfigModal({
  open,
  onOpenChange,
  barbershopId,
}: ReminderConfigModalProps) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [masterEnabled, setMasterEnabled] = useState(false);
  const [customMessage, setCustomMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && barbershopId) {
      loadReminders();
      loadBarbershopSettings();
    }
  }, [open, barbershopId]);

  const loadBarbershopSettings = async () => {
    const { data } = await supabase
      .from("barbershops")
      .select("webhook_reminders_enabled, reminder_message_template")
      .eq("id", barbershopId)
      .single();

    if (data) {
      setMasterEnabled(data.webhook_reminders_enabled || false);
      setCustomMessage(data.reminder_message_template || "");
    }
  };

  const loadReminders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("barbershop_reminders")
      .select("*")
      .eq("barbershop_id", barbershopId)
      .order("display_order", { ascending: true });

    if (error) {
      console.error("Error loading reminders:", error);
      toast.error("Erro ao carregar lembretes");
    } else {
      setReminders(
        data?.map((r) => ({
          id: r.id,
          reminder_type: r.reminder_type as "minutes" | "hours" | "days",
          reminder_value: r.reminder_value,
          is_enabled: r.is_enabled,
          display_order: r.display_order,
        })) || []
      );
    }
    setLoading(false);
  };

  const addReminder = () => {
    if (reminders.length >= MAX_REMINDERS) {
      toast.error(`Máximo de ${MAX_REMINDERS} lembretes`);
      return;
    }

    setReminders([
      ...reminders,
      {
        reminder_type: "hours",
        reminder_value: 1,
        is_enabled: true,
        display_order: reminders.length,
      },
    ]);
  };

  const removeReminder = (index: number) => {
    setReminders(reminders.filter((_, i) => i !== index));
  };

  const updateReminder = (index: number, field: keyof Reminder, value: any) => {
    const updated = [...reminders];
    updated[index] = { ...updated[index], [field]: value };
    setReminders(updated);
  };

  const getValueOptions = (type: "minutes" | "hours" | "days") => {
    switch (type) {
      case "minutes":
        return MINUTE_OPTIONS;
      case "hours":
        return HOUR_OPTIONS;
      case "days":
        return DAY_OPTIONS;
    }
  };

  const getTypeLabel = (type: "minutes" | "hours" | "days") => {
    switch (type) {
      case "minutes":
        return "minutos";
      case "hours":
        return "hora(s)";
      case "days":
        return "dia(s)";
    }
  };

  const getReminderLabel = (reminder: Reminder) => {
    const value = reminder.reminder_value;
    switch (reminder.reminder_type) {
      case "minutes":
        return `${value} minutos antes`;
      case "hours":
        return value === 1 ? "1 hora antes" : `${value} horas antes`;
      case "days":
        return value === 1 ? "1 dia antes" : `${value} dias antes`;
    }
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      // Update master settings
      await supabase
        .from("barbershops")
        .update({
          webhook_reminders_enabled: masterEnabled,
          reminder_message_template: customMessage || null,
        })
        .eq("id", barbershopId);

      // Delete all existing reminders for this barbershop
      await supabase
        .from("barbershop_reminders")
        .delete()
        .eq("barbershop_id", barbershopId);

      // Insert new reminders
      if (reminders.length > 0) {
        const { error } = await supabase.from("barbershop_reminders").insert(
          reminders.map((r, index) => ({
            barbershop_id: barbershopId,
            reminder_type: r.reminder_type,
            reminder_value: r.reminder_value,
            is_enabled: r.is_enabled,
            display_order: index,
          }))
        );

        if (error) throw error;
      }

      toast.success("Lembretes salvos com sucesso");
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving reminders:", error);
      toast.error("Erro ao salvar lembretes");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            Configurar Lembretes
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Master toggle */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
              <div className="space-y-0.5">
                <Label className="font-medium">Ativar lembretes automáticos</Label>
                <p className="text-sm text-muted-foreground">
                  Enviar lembretes via WhatsApp
                </p>
              </div>
              <Switch
                checked={masterEnabled}
                onCheckedChange={setMasterEnabled}
              />
            </div>

            {masterEnabled && (
              <>
                {/* Reminders list */}
                <div className="space-y-3">
                  <Label className="font-medium">
                    Lembretes ({reminders.length}/{MAX_REMINDERS})
                  </Label>

                  {reminders.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      Nenhum lembrete configurado
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {reminders.map((reminder, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 p-3 bg-card border border-border rounded-lg"
                        >
                          {/* Value selector */}
                          <Select
                            value={reminder.reminder_value.toString()}
                            onValueChange={(v) =>
                              updateReminder(index, "reminder_value", parseInt(v))
                            }
                          >
                            <SelectTrigger className="w-20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {getValueOptions(reminder.reminder_type).map(
                                (opt) => (
                                  <SelectItem key={opt} value={opt.toString()}>
                                    {opt}
                                  </SelectItem>
                                )
                              )}
                            </SelectContent>
                          </Select>

                          {/* Type selector */}
                          <Select
                            value={reminder.reminder_type}
                            onValueChange={(v) => {
                              updateReminder(
                                index,
                                "reminder_type",
                                v as "minutes" | "hours" | "days"
                              );
                              // Reset value to first option of new type
                              const newOptions = getValueOptions(
                                v as "minutes" | "hours" | "days"
                              );
                              updateReminder(index, "reminder_value", newOptions[0]);
                            }}
                          >
                            <SelectTrigger className="w-28">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="minutes">minutos</SelectItem>
                              <SelectItem value="hours">hora(s)</SelectItem>
                              <SelectItem value="days">dia(s)</SelectItem>
                            </SelectContent>
                          </Select>

                          {/* Enabled toggle */}
                          <div className="flex-1 flex items-center justify-end gap-2">
                            <Switch
                              checked={reminder.is_enabled}
                              onCheckedChange={(v) =>
                                updateReminder(index, "is_enabled", v)
                              }
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => removeReminder(index)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {reminders.length < MAX_REMINDERS && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={addReminder}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar Lembrete
                    </Button>
                  )}
                </div>

                {/* Custom message */}
                <div className="space-y-2">
                  <Label className="font-medium">
                    Mensagem personalizada (opcional)
                  </Label>
                  <Textarea
                    placeholder="Ex: Olá! Lembrando do seu horário agendado..."
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    A IA usará esta mensagem como base para compor o lembrete
                  </p>
                </div>
              </>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
