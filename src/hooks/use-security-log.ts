import { useCallback } from "react";
import { supabase } from "@/lib/supabase";

export function useSecurityLog() {
  const logEvent = useCallback((
    eventType: string,
    resource?: string,
    details?: Record<string, unknown>,
  ) => {
    // Fire-and-forget — nunca bloquea la UI si el log falla
    supabase
      .rpc("log_security_event", {
        p_event_type: eventType,
        p_resource:   resource ?? null,
        p_details:    details  ?? {},
      })
      .catch((err) => console.warn("[security-log]", err));
  }, []);

  return { logEvent };
}
