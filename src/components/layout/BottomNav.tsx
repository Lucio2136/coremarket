import { useLocation, useNavigate } from "react-router-dom";
import { Home, BarChart2, Trophy, User } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { AuthModal } from "@/components/modals/AuthModal";

const TABS = [
  { to: "/",            label: "Inicio",       icon: Home,      requiresAuth: false },
  { to: "/my-bets",     label: "Predicciones", icon: BarChart2, requiresAuth: true  },
  { to: "/leaderboard", label: "Ranking",      icon: Trophy,    requiresAuth: false },
  { to: "/profile",     label: "Perfil",       icon: User,      requiresAuth: true  },
];

export function BottomNav() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [authOpen, setAuthOpen] = useState(false);

  if (location.pathname.startsWith("/market/")) return null;

  const handleTab = (to: string, requiresAuth: boolean) => {
    if (requiresAuth && !isAuthenticated) {
      setAuthOpen(true);
      return;
    }
    navigate(to);
  };

  return (
    <>
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 shadow-[0_-1px_12px_rgba(0,0,0,0.08)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex items-stretch h-14">
          {TABS.map(({ to, label, icon: Icon, requiresAuth }) => {
            const isActive =
              to === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(to);

            return (
              <button
                key={to}
                onClick={() => handleTab(to, requiresAuth)}
                className="relative flex-1 flex flex-col items-center justify-center gap-[3px] transition-colors"
              >
                <Icon
                  size={20}
                  strokeWidth={isActive ? 2.5 : 1.8}
                  className={isActive
                    ? "text-gray-900 dark:text-white"
                    : "text-gray-400 dark:text-gray-500"}
                />
                <span className={[
                  "text-[10px] font-semibold leading-none",
                  isActive
                    ? "text-gray-900 dark:text-white"
                    : "text-gray-400 dark:text-gray-500",
                ].join(" ")}>
                  {label}
                </span>
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-gray-900 dark:bg-white rounded-b-full" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
    </>
  );
}
