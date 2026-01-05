import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useBarbershop } from "./useBarbershop";

export function useSessionTracker() {
  const { user } = useAuth();
  const { barbershop } = useBarbershop();
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user || !barbershop) return;

    const startSession = async () => {
      try {
        const { data, error } = await supabase.rpc("start_user_session", {
          p_barbershop_id: barbershop.id,
        });

        if (!error && data) {
          sessionIdRef.current = data;
        }
      } catch (err) {
        console.error("Error starting session:", err);
      }
    };

    startSession();

    // End session on page unload
    const handleUnload = () => {
      if (sessionIdRef.current) {
        // Use sendBeacon for reliable unload tracking
        const payload = JSON.stringify({
          session_id: sessionIdRef.current,
        });
        
        navigator.sendBeacon(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/end_user_session`,
          payload
        );
      }
    };

    // End session on visibility change (tab hidden/closed)
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "hidden" && sessionIdRef.current) {
        try {
          await supabase.rpc("end_user_session", {
            p_session_id: sessionIdRef.current,
          });
        } catch (err) {
          console.error("Error ending session:", err);
        }
      } else if (document.visibilityState === "visible" && !sessionIdRef.current) {
        // Restart session if tab becomes visible again
        startSession();
      }
    };

    window.addEventListener("beforeunload", handleUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      // End session on component unmount
      if (sessionIdRef.current) {
        supabase.rpc("end_user_session", {
          p_session_id: sessionIdRef.current,
        });
      }
    };
  }, [user, barbershop]);

  return sessionIdRef.current;
}
