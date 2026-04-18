import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function useSystemStatus() {
  const [isFrozen, setIsFrozen] = useState(false);

  useEffect(() => {
    supabase
      .from("system_settings")
      .select("is_frozen")
      .single()
      .then(({ data }) => {
        setIsFrozen(data?.is_frozen ?? false);
      });
  }, []);

  return { isFrozen };
}
