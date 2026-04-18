import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutGrid, Ticket, Trophy,
  User, Settings, Gift,
  BarChart3, ShieldCheck, PlusCircle,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSystemStatus } from "@/hooks/use-system-status";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup,
  SidebarGroupLabel, SidebarGroupContent, SidebarHeader,
  SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarRail,
} from "@/components/ui/sidebar";
import { ReferralModal } from "@/components/modals/ReferralModal";

// ─── Grupos de navegación ─────────────────────────────────────────────────────
const NAV_MAIN = [
  { to: "/",            label: "Mercados",    icon: LayoutGrid, exact: true  },
  { to: "/my-bets",     label: "Mis Apuestas", icon: Ticket,    exact: false },
  { to: "/leaderboard", label: "Líderes",     icon: Trophy,     exact: false },
] as const;

const NAV_USER = [
  { to: "/profile", label: "Perfil",        icon: User     },
  { to: "/profile", label: "Configuración", icon: Settings },
] as const;

const NAV_ADMIN = [
  { to: "/admin", label: "Dashboard",           icon: BarChart3   },
  { to: "/admin", label: "Auditoría",           icon: ShieldCheck },
  { to: "/admin", label: "Gestión de Mercados", icon: PlusCircle  },
] as const;

// ─── Componente ───────────────────────────────────────────────────────────────
export function AppSidebar() {
  const location = useLocation();
  const { profile } = useAuth();
  const { isFrozen } = useSystemStatus();
  const [referralOpen, setReferralOpen] = useState(false);
  const isMobile = useIsMobile();

  const isAdmin = profile?.email === "outfisin@gmail.com";

  if (isMobile) return null;

  return (
    <>
      <Sidebar variant="inset" collapsible="icon">

        {/* ── Logo ──────────────────────────────────────────────────────── */}
        <SidebarHeader>
          <NavLink
            to="/"
            className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-sidebar-accent transition-colors"
          >
            <div className="w-7 h-7 bg-gray-900 dark:bg-white rounded-lg flex items-center justify-center shrink-0">
              <span className="text-white dark:text-gray-900 text-xs font-black">Q</span>
            </div>
            <span className="text-[17px] font-bold text-gray-900 dark:text-gray-100 tracking-tight group-data-[collapsible=icon]:hidden">
              Coremarket
            </span>
          </NavLink>
        </SidebarHeader>

        {/* ── Contenido ─────────────────────────────────────────────────── */}
        <SidebarContent>

          {/* Grupo Principal */}
          <SidebarGroup>
            <SidebarGroupLabel>Principal</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV_MAIN.map(({ to, label, icon: Icon, exact }) => {
                  const active = exact
                    ? location.pathname === to
                    : location.pathname.startsWith(to);
                  return (
                    <SidebarMenuItem key={label}>
                      <SidebarMenuButton asChild isActive={active} tooltip={label}>
                        <NavLink to={to} end={exact}>
                          <Icon />
                          <span>{label}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Grupo de Usuario */}
          <SidebarGroup>
            <SidebarGroupLabel>Usuario</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV_USER.map(({ to, label, icon: Icon }) => (
                  <SidebarMenuItem key={label}>
                    <SidebarMenuButton
                      asChild
                      isActive={location.pathname === to}
                      tooltip={label}
                    >
                      <NavLink to={to}>
                        <Icon />
                        <span>{label}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}

                {/* Referidos — abre modal */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip="Referidos"
                    onClick={() => setReferralOpen(true)}
                  >
                    <Gift />
                    <span>Referidos</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Grupo Admin */}
          {isAdmin && (
            <SidebarGroup>
              <SidebarGroupLabel>Admin</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {NAV_ADMIN.map(({ to, label, icon: Icon }) => (
                    <SidebarMenuItem key={label}>
                      <SidebarMenuButton
                        asChild
                        isActive={location.pathname.startsWith("/admin")}
                        tooltip={label}
                      >
                        <NavLink to={to}>
                          <Icon />
                          <span>{label}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>

        {/* ── Footer — indicador de sistema ─────────────────────────────── */}
        <SidebarFooter>
          {/* Expandido */}
          <div className="px-2 py-1.5 group-data-[collapsible=icon]:hidden">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full shrink-0 ${isFrozen ? "bg-red-500" : "bg-emerald-500"}`} />
              <span className="text-[11px] font-medium text-sidebar-foreground/60">
                Sistema
              </span>
              {isFrozen && (
                <span className="ml-auto text-[10px] font-black text-red-600 uppercase tracking-widest">
                  CONGELADO
                </span>
              )}
            </div>
            <p className="text-[10px] text-sidebar-foreground/40 mt-1 font-medium">
              Coremarket · Beta
            </p>
          </div>

          {/* Colapsado — solo el punto de estado */}
          <div className="hidden group-data-[collapsible=icon]:flex justify-center pb-2">
            <div
              className={`w-2 h-2 rounded-full ${isFrozen ? "bg-red-500" : "bg-emerald-500"}`}
              title={isFrozen ? "Sistema CONGELADO" : "Sistema operativo"}
            />
          </div>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <ReferralModal open={referralOpen} onOpenChange={setReferralOpen} />
    </>
  );
}
