import { useState, useEffect, useRef } from "react";
import { Outlet, useSearchParams, useNavigate } from "react-router-dom";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppFooter } from "@/components/layout/AppFooter";
import { BottomNav } from "@/components/layout/BottomNav";
import { OnboardingModal } from "@/components/modals/OnboardingModal";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const ONBOARDING_KEY = "lucebase_onboarded";

export function AppLayout() {
  const { isAuthenticated, loading, user } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const notifiedBets = useRef<Set<string>>(new Set());

  // ── Toast de depósito al volver de Conekta ────────────────────────────────
  useEffect(() => {
    const estado = searchParams.get("deposito");
    if (!estado) return;
    if (estado === "exitoso") {
      toast.success("¡Depósito exitoso! Tu saldo se actualizará en unos segundos.", {
        duration: 6000,
      });
    } else if (estado === "fallido") {
      toast.error("El pago no se completó. Intenta de nuevo.");
    } else if (estado === "pendiente") {
      toast.info("Tu pago está pendiente de confirmación.", { duration: 6000 });
    }
    // Limpiar el query param de la URL
    const params = new URLSearchParams(searchParams);
    params.delete("deposito");
    navigate({ search: params.toString() }, { replace: true });
  }, []);

  // ── Notificaciones de apuestas ganadas en tiempo real ─────────────────────
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`bets-won-${user.id}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "bets",
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const bet = payload.new as any;
        if (bet.status === "won" && !notifiedBets.current.has(bet.id)) {
          notifiedBets.current.add(bet.id);
          const payout = (bet.payout_amount ?? bet.potential_payout ?? 0)
            .toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          toast.success(`🏆 ¡Ganaste $${payout} MXN!`, {
            description: "Tu saldo ha sido acreditado.",
            duration: 8000,
          });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // ── Onboarding ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!loading && isAuthenticated && !localStorage.getItem(ONBOARDING_KEY)) {
      setShowOnboarding(true);
    }
  }, [isAuthenticated, loading]);

  const handleCloseOnboarding = () => {
    localStorage.setItem(ONBOARDING_KEY, "1");
    setShowOnboarding(false);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#060a0f] flex flex-col">
      <AppHeader />
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 md:px-6 py-4 md:py-6 pb-20 lg:pb-6" style={{ paddingBottom: undefined }}>
        <Outlet />
      </main>
      <AppFooter />
      <BottomNav />
      <OnboardingModal open={showOnboarding} onClose={handleCloseOnboarding} />
    </div>
  );
}
