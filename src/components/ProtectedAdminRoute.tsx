import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

type State = "loading" | "authorized" | "unauthorized";

function AdminLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3 bg-white dark:bg-gray-950">
      <div className="w-7 h-7 border-2 border-gray-200 border-t-gray-800 dark:border-gray-700 dark:border-t-gray-200 rounded-full animate-spin" />
      <p className="text-xs text-gray-400 font-medium tracking-wide uppercase">Verificando acceso</p>
    </div>
  );
}

export function ProtectedAdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    // Esperar a que AuthContext resuelva la sesión antes de consultar la RPC
    if (authLoading) return;

    // Sin sesión: rechazar directamente sin llamar a Supabase
    if (!user) {
      setState("unauthorized");
      return;
    }

    let cancelled = false;

    supabase
      .rpc("check_is_admin")
      .then(({ data, error }) => {
        if (cancelled) return;
        const authorized = data === true && !error;
        setState(authorized ? "authorized" : "unauthorized");
        supabase.rpc("log_security_event", {
          p_event_type: authorized ? "admin_access_granted" : "admin_access_denied",
          p_resource:   "/admin",
          p_details:    {},
        }).catch(() => {});
      })
      .catch(() => {
        if (!cancelled) {
          setState("unauthorized");
          supabase.rpc("log_security_event", {
            p_event_type: "admin_access_error",
            p_resource:   "/admin",
            p_details:    {},
          }).catch(() => {});
        }
      });

    return () => { cancelled = true; };
  }, [user, authLoading]);

  if (state === "loading") return <AdminLoader />;
  if (state === "unauthorized") return <Navigate to="/" replace />;
  return <>{children}</>;
}
