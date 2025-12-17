import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WEBHOOK_URL = "https://webhook.lernow.com/webhook/skejool-lembretes";

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

    // Get current time in UTC
    const now = new Date();
    console.log("Current time (UTC):", now.toISOString());

    // Fetch all active barbershops with reminders enabled
    const { data: barbershops, error: barbershopsError } = await supabase
      .from("barbershops")
      .select("id, name, phone, reminder_minutes, reminder_message_template")
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
      const reminderMinutes = barbershop.reminder_minutes || 60;
      
      // Calculate the target window: appointments starting between now + reminder_minutes and now + reminder_minutes + 10 (cron interval)
      const targetStart = new Date(now.getTime() + reminderMinutes * 60 * 1000);
      const targetEnd = new Date(targetStart.getTime() + 10 * 60 * 1000); // 10-minute window

      console.log(`Barbershop ${barbershop.name}: checking appointments between ${targetStart.toISOString()} and ${targetEnd.toISOString()}`);

      // Find appointments that need reminders
      const { data: appointments, error: appointmentsError } = await supabase
        .from("agendamentos")
        .select(`
          id_agendamento,
          start_time,
          nome_cliente,
          telefone_cliente,
          service_id,
          services!inner (name)
        `)
        .eq("barbershop_id", barbershop.id)
        .eq("reminder_sent", false)
        .neq("status", "cancelled")
        .gte("start_time", targetStart.toISOString())
        .lt("start_time", targetEnd.toISOString()) as { data: any[], error: any };

      if (appointmentsError) {
        console.error(`Error fetching appointments for ${barbershop.name}:`, appointmentsError);
        continue;
      }

      if (!appointments || appointments.length === 0) {
        console.log(`No pending reminders for ${barbershop.name}`);
        continue;
      }

      console.log(`Found ${appointments.length} appointments to remind for ${barbershop.name}`);

      // Process each appointment
      for (const appointment of appointments) {
        try {
          // Format the appointment time for display
          const appointmentTime = new Date(appointment.start_time);
          const formattedTime = appointmentTime.toLocaleString("pt-BR", {
            timeZone: "America/Sao_Paulo",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          });

          const payload = {
            barbershop_name: barbershop.name,
            barbershop_phone: barbershop.phone || "",
            client_name: appointment.nome_cliente || "Cliente",
            client_phone: appointment.telefone_cliente || "",
            service_name: appointment.services?.name || "Serviço",
            appointment_time: formattedTime,
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

          console.log(`Webhook sent successfully for appointment ${appointment.id_agendamento}`);

          // Mark reminder as sent
          const { error: updateError } = await supabase
            .from("agendamentos")
            .update({ reminder_sent: true })
            .eq("id_agendamento", appointment.id_agendamento);

          if (updateError) {
            console.error(`Error updating reminder_sent for ${appointment.id_agendamento}:`, updateError);
          } else {
            totalProcessed++;
            results.push({
              barbershop: barbershop.name,
              client: appointment.nome_cliente,
              time: formattedTime,
            });
          }
        } catch (appointmentError) {
          console.error(`Error processing appointment ${appointment.id_agendamento}:`, appointmentError);
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
