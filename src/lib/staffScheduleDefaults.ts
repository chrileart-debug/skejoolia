import { supabase } from "@/integrations/supabase/client";

interface DefaultSchedule {
  user_id: string;
  barbershop_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_working: boolean;
}

/**
 * Creates default staff schedules for all 7 days of the week.
 * Mon-Fri: 08:00 - 18:00, is_working = true
 * Sat-Sun: 08:00 - 18:00, is_working = false
 */
export async function createDefaultStaffSchedules(
  userId: string,
  barbershopId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if schedules already exist for this user
    const { data: existingSchedules, error: checkError } = await supabase
      .from("staff_schedules")
      .select("id")
      .eq("user_id", userId)
      .eq("barbershop_id", barbershopId)
      .limit(1);

    if (checkError) throw checkError;

    if (existingSchedules && existingSchedules.length > 0) {
      return { success: true };
    }

    // Generate 7 default schedules (0 = Sunday, 6 = Saturday)
    const defaultSchedules: DefaultSchedule[] = [];

    for (let day = 0; day <= 6; day++) {
      // Monday (1) to Friday (5) = working days
      // Saturday (6) and Sunday (0) = off days
      const isWorkingDay = day >= 1 && day <= 5;

      defaultSchedules.push({
        user_id: userId,
        barbershop_id: barbershopId,
        day_of_week: day,
        start_time: "08:00",
        end_time: "18:00",
        is_working: isWorkingDay,
      });
    }

    const { error: insertError } = await supabase
      .from("staff_schedules")
      .insert(defaultSchedules);

    if (insertError) throw insertError;
    return { success: true };
  } catch (error) {
    console.error("Error creating default staff schedules:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
