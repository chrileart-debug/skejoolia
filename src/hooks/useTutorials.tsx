import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Tutorial {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  category: string | null;
  display_order: number;
}

export function useTutorials() {
  return useQuery({
    queryKey: ["tutorials"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutorials")
        .select("id, title, description, video_url, category, display_order")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data as Tutorial[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
