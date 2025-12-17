import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WEBHOOK_URL = "https://webhook.lernow.com/webhook/skejool-lembretes";

interface Reminder {
  id: string;
  barbershop_id: string;
  reminder_type: "minutes" | "hours" | "days";
  reminder_value: number;
  is_enabled: boolean;
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("=== check-reminders started ===");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get current time
    const now = new Date();
    console.log("Current time (UTC):", now.toISOString());

    // Fetch all active barbershops with reminders enabled
    const { data: barbershops, error: barbershopsError } = await supabase
      .from("barbershops")
      .select("id, name, phone, reminder_message_template")
      .eq("webhook_reminders_enabled", true)
      .eq("is_active", true);

    if (barbershopsError) {
      console.error("Error fetching barbershops:", barbershopsError);
      throw barbershopsError;
    }

    if (!barbershops || barbershops.length === 0) {
      console.log("No barbershops with reminders enabled");
      return new Response(JSON.stringify({ message: "No barbershops with reminders enabled", processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${barbershops.length} barbershops with reminders enabled`);

    let totalProcessed = 0;
    const results: any[] = [];

    for (const barbershop of barbershops) {
      // Fetch all active reminders for this barbershop
      const { data: reminders, error: remindersError } = await supabase
        .from("barbershop_reminders")
        .select("*")
        .eq("barbershop_id", barbershop.id)
        .eq("is_enabled", true);

      if (remindersError) {
        console.error(`Error fetching reminders for ${barbershop.name}:`, remindersError);
        continue;
      }

      if (!reminders || reminders.length === 0) {
        console.log(`No active reminders configured for ${barbershop.name}`);
        continue;
      }

      console.log(`Found ${reminders.length} active reminders for ${barbershop.name}`);

      // Fetch appointments for this barbershop (status pending/confirmed)
      // Include appointments from 10 minutes ago to catch recently passed reminder windows
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
      console.log(`Fetching appointments from ${tenMinutesAgo.toISOString()} onwards`);
      
      const { data: appointments, error: appointmentsError } = await supabase
        .from("agendamentos")
        .select(`
          id_agendamento,
          start_time,
          nome_cliente,
          telefone_cliente,
          service_id
        `)
        .eq("barbershop_id", barbershop.id)
        .in("status", ["pending", "confirmed"])
        .gte("start_time", tenMinutesAgo.toISOString());

      if (appointmentsError) {
        console.error(`Error fetching appointments for ${barbershop.name}:`, appointmentsError);
        continue;
      }

      if (!appointments || appointments.length === 0) {
        console.log(`No appointments found for ${barbershop.name} (checked from ${tenMinutesAgo.toISOString()})`);
        continue;
      }

      console.log(`Found ${appointments.length} appointments for ${barbershop.name}:`);
      appointments.forEach(apt => {
        console.log(`  - ${apt.id_agendamento}: ${apt.nome_cliente} at ${apt.start_time}`);
      });

      // Process each reminder configuration
      for (const reminder of reminders as Reminder[]) {
        // Calculate reminder minutes
        let reminderMinutes: number;
        switch (reminder.reminder_type) {
          case "minutes":
            reminderMinutes = reminder.reminder_value;
            break;
          case "hours":
            reminderMinutes = reminder.reminder_value * 60;
            break;
          case "days":
            reminderMinutes = reminder.reminder_value * 24 * 60;
            break;
          default:
            reminderMinutes = 60;
        }

        console.log(`Processing reminder ${reminder.id}: ${reminder.reminder_value} ${reminder.reminder_type} (${reminderMinutes} minutes)`);

        // Process each appointment
        for (const appointment of appointments) {
          const appointmentTime = new Date(appointment.start_time);
          const reminderTargetTime = new Date(appointmentTime.getTime() - reminderMinutes * 60 * 1000);
          
          // Check if it's time to send this reminder (target time has passed or is within 10 minutes)
          const timeDiff = reminderTargetTime.getTime() - now.getTime();
          const minutesUntilReminder = timeDiff / (60 * 1000);

          console.log(`Appointment ${appointment.id_agendamento} at ${appointmentTime.toISOString()}, reminder target: ${reminderTargetTime.toISOString()}, minutes until reminder: ${minutesUntilReminder.toFixed(1)}`);

          // Send reminder ONLY if within ±1.5 minute window of target time
          // This prevents "stale" reminders from being sent together with newer ones
          if (minutesUntilReminder > 1.5) {
            console.log(`Reminder not yet due for appointment ${appointment.id_agendamento} (${minutesUntilReminder.toFixed(1)} min early), skipping`);
            continue;
          }

          if (minutesUntilReminder < -1.5) {
            console.log(`Reminder window expired for appointment ${appointment.id_agendamento} (${Math.abs(minutesUntilReminder).toFixed(1)} min late), skipping`);
            continue;
          }

          // Check if this specific reminder was already sent for this appointment
          const { data: existingSent } = await supabase
            .from("appointment_reminders_sent")
            .select("id")
            .eq("appointment_id", appointment.id_agendamento)
            .eq("reminder_id", reminder.id)
            .maybeSingle();

          if (existingSent) {
            console.log(`Reminder ${reminder.id} already sent for appointment ${appointment.id_agendamento}, skipping`);
            continue;
          }

          try {
            // Format the appointment time for display
            const formattedTime = appointmentTime.toLocaleString("pt-BR", {
              timeZone: "America/Sao_Paulo",
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            });

            // Fetch service name if service_id exists
            let serviceName = "Serviço";
            if (appointment.service_id) {
              const { data: service } = await supabase
                .from("services")
                .select("name")
                .eq("id", appointment.service_id)
                .maybeSingle();
              serviceName = service?.name || "Serviço";
            }

            const payload = {
              barbershop_name: barbershop.name,
              barbershop_phone: barbershop.phone || "",
              client_name: appointment.nome_cliente || "Cliente",
              client_phone: appointment.telefone_cliente || "",
              service_name: serviceName,
              appointment_time: formattedTime,
              reminder_type: reminder.reminder_type,
              reminder_value: reminder.reminder_value,
              custom_message: barbershop.reminder_message_template || "",
            };

            console.log("Sending webhook payload:", JSON.stringify(payload));

            // Send webhook
            const webhookResponse = await fetch(WEBHOOK_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });

            if (!webhookResponse.ok) {
              const errorText = await webhookResponse.text();
              console.error(`Webhook failed for appointment ${appointment.id_agendamento}:`, errorText);
              continue;
            }

            console.log(`Webhook sent successfully for appointment ${appointment.id_agendamento}, reminder ${reminder.id}`);

            // Record that this reminder was sent for this appointment
            const { error: insertError } = await supabase
              .from("appointment_reminders_sent")
              .insert({
                appointment_id: appointment.id_agendamento,
                reminder_id: reminder.id,
              });

            if (insertError) {
              console.error(`Error recording reminder sent for ${appointment.id_agendamento}:`, insertError);
            } else {
              totalProcessed++;
              results.push({
                barbershop: barbershop.name,
                client: appointment.nome_cliente,
                time: formattedTime,
                reminder: `${reminder.reminder_value} ${reminder.reminder_type}`,
              });
            }
          } catch (appointmentError) {
            console.error(`Error processing appointment ${appointment.id_agendamento}:`, appointmentError);
          }
        }
      }
    }

    console.log(`=== check-reminders completed. Processed ${totalProcessed} reminders ===`);

    return new Response(
      JSON.stringify({
        message: `Processed ${totalProcessed} reminders`,
        processed: totalProcessed,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in check-reminders:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});