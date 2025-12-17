-- Function to reset appointment reminders when start_time changes
CREATE OR REPLACE FUNCTION public.reset_appointment_reminders()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If start_time changed, delete all sent reminder records for this appointment
  IF OLD.start_time IS DISTINCT FROM NEW.start_time THEN
    DELETE FROM appointment_reminders_sent
    WHERE appointment_id = NEW.id_agendamento;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger that fires on start_time update
DROP TRIGGER IF EXISTS trigger_reset_reminders_on_time_change ON agendamentos;

CREATE TRIGGER trigger_reset_reminders_on_time_change
  AFTER UPDATE OF start_time ON agendamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.reset_appointment_reminders();