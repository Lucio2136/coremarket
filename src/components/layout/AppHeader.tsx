import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  LogIn, LogOut, User, BarChart2, Gift, Bell,
  TrendingUp, Flame, Sparkles, Search, ChevronDown,
  CheckCircle, XCircle, ArrowUpCircle, Trophy, Clock, HelpCircle, Bookmark, LineChart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSavedMarkets } from "@/hooks/use-saved-markets";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/hooks/use-notifications";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DepositModal } from "@/components/modals/DepositModal";
import { WithdrawModal } from "@/components/modals/WithdrawModal";
import { AuthModal } from "@/components/modals/AuthModal";
import { ReferralModal } from "@/components/modals/ReferralModal";
import { toast } from "sonner";

// ─── Categorías ──────────────────────────────────────────────────────────────
const SPECIAL = [
  { id: "trending",  label: "Tendencia",    icon: TrendingUp },
  { id: "new",       label: "Nuevo",        icon: Sparkles },
  { id: "hot",       label: "Popular",      icon: Flame },
  { id: "closing",   label: "Cierra pronto", icon: Clock },
  { id: "saved",     label: "Guardados",    icon: Bookmark },
];

const CATEGORIES = [
  "Morbo", "Política", "Deportes", "Entretenimiento", "Finanzas",
  "Tech", "Música", "Negocios", "Elecciones", "Redes", "Cultura",
];

// ─── Componente ──────────────────────────────────────────────────────────────
export function AppHeader() {
  const { profile, user, signOut, balance, loading } = useAuth();
  const { notifications, unreadCount, markAllRead } = useNotifications();
  const { savedCount } = useSavedMarkets();
  const [depositOpen, setDepositOpen]   = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [authOpen, setAuthOpen]         = useState(false);
  const [referralOpen, setReferralOpen] = useState(false);
  const [searchVal, setSearchVal]       = useState("");
  const [searchOpen, setSearchOpen]     = useState(false);
  const [notifOpen, setNotifOpen]       = useState(false);
  const [avatarOpen, setAvatarOpen]     = useState(false);
  const notifRef  = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLDivElement>(null);
  const navigate   = useNavigate();
  const [searchParams] = useSearchParams();
  const activeCat  = searchParams.get("cat") ?? "";

  // Cerrar paneles al hacer clic fuera
  useEffect(() => {
    if (!notifOpen && !avatarOpen) return;
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) setAvatarOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [notifOpen, avatarOpen]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
    toast.success("Sesión cerrada");
  };

  const selectCat = (id: string) => {
    if (id === activeCat) { navigate("/"); return; }
    navigate(`/?cat=${encodeURIComponent(id)}`);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchVal.trim()) navigate(`/?q=${encodeURIComponent(searchVal.trim())}`);
    else navigate("/");
  };

  const fmtMXN = (n: number) =>
    n.toLocaleString("es-MX", { minimumFractionDigits: 2 });

  return (
    <>
      <header className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">

        {/* ── Fila principal ── */}
        <div className="max-w-[1400px] mx-auto flex items-center gap-3 px-4 md:px-6 h-14">

          {/* Logo — siempre visible, navega a home */}
          <Link to="/" className="flex items-center gap-2 shrink-0 mr-2">
            <div className="w-7 h-7 bg-gray-900 dark:bg-white rounded-lg flex items-center justify-center">
              <span className="text-white dark:text-gray-900 text-xs font-black">C</span>
            </div>
            <span className="font-bold text-[17px] text-gray-900 dark:text-gray-100 tracking-tight hidden sm:inline">
              Lucebase
            </span>
          </Link>

          {/* Buscador — full en sm+, toggle icon en móvil */}
          <form onSubmit={handleSearch} className="hidden sm:flex flex-1 max-w-xl">
            <div className="relative w-full">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
                placeholder="Buscar mercados..."
                className="w-full bg-gray-100 dark:bg-gray-800 border border-transparent rounded-full pl-8 pr-4 py-2 text-sm text-gray-700 dark:text-gray-200 placeholder:text-gray-400 focus:outline-none focus:bg-white dark:focus:bg-gray-700 focus:border-gray-300 dark:focus:border-gray-600 transition-all"
              />
            </div>
          </form>

          {/* Ícono búsqueda en móvil */}
          <button
            onClick={() => setSearchOpen((v) => !v)}
            className="sm:hidden p-2 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Buscar"
          >
            <Search size={18} />
          </button>

          {/* Derecha */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">

            {user && !loading ? (
              <>
                {/* Saldo disponible */}
                <div className="flex items-center mr-1">
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-gray-400 leading-none mb-0.5 uppercase tracking-widest hidden md:block">Saldo</p>
                    <p className="text-sm font-bold text-emerald-600 leading-none tabular-nums" style={{ fontFamily: "'Azeret Mono', monospace" }}>
                      ${fmtMXN(balance)}
                    </p>
                  </div>
                </div>

                {/* Retirar */}
                <Button
                  variant="brand-ghost"
                  onClick={() => setWithdrawOpen(true)}
                  className="hidden sm:inline-flex px-3 py-1.5 text-[12px]"
                >
                  Retirar
                </Button>

                {/* Depósito */}
                <Button variant="dark" onClick={() => setDepositOpen(true)} className="px-3 py-1.5 text-[12px]">
                  Depósito
                </Button>

                {/* Referidos */}
                <button
                  onClick={() => setReferralOpen(true)}
                  className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/30 rounded-lg transition-colors hidden sm:flex"
                  title="Programa de referidos"
                >
                  <Gift size={18} />
                </button>

                {/* Tema */}
                <ThemeToggle />

                {/* Notificaciones — botón solo en desktop */}
                <div ref={notifRef} className="relative hidden sm:flex">
                  <button
                    onClick={() => { setNotifOpen((v) => !v); if (!notifOpen) markAllRead(); }}
                    className="relative p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <Bell size={18} />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center tabular-nums">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </button>
                </div>

                {/* Avatar dropdown */}
                <div ref={avatarRef} className="relative">
                  <button
                    onClick={() => setAvatarOpen((v) => !v)}
                    className="flex items-center gap-1 p-0.5 rounded-full hover:ring-2 hover:ring-gray-200 dark:hover:ring-gray-700 transition-all"
                  >
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt={profile.username} className="w-7 h-7 rounded-full object-cover" />
                    ) : (
                      <div className={`w-7 h-7 rounded-full bg-gradient-to-br flex items-center justify-center text-white text-xs font-bold ${{
                          violet: "from-violet-500 to-pink-500",
                          blue:   "from-blue-500 to-cyan-400",
                          green:  "from-emerald-500 to-teal-400",
                          orange: "from-orange-400 to-amber-300",
                          rose:   "from-rose-500 to-pink-400",
                          indigo: "from-indigo-500 to-violet-400",
                        }[profile?.avatar_color ?? "violet"] ?? "from-violet-500 to-pink-500"}`}>
                        {profile?.username?.slice(0, 1).toUpperCase() ?? "?"}
                      </div>
                    )}
                    <ChevronDown size={13} className="text-gray-500 dark:text-gray-400" />
                  </button>

                  {avatarOpen && (
                    <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl z-50 overflow-hidden">
                      {/* Cabecera: usuario + saldo */}
                      <div className="px-3 py-2.5 border-b border-gray-100 dark:border-gray-800">
                        <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">{profile?.username}</p>
                        <p className="text-[11px] text-emerald-600 font-bold tabular-nums" style={{ fontFamily: "'Azeret Mono', monospace" }}>${fmtMXN(balance)} MXN</p>
                      </div>

                      {/* Opciones móvil (ocultas en sm+) */}
                      <div className="sm:hidden border-b border-gray-100 dark:border-gray-800">
                        <button
                          onClick={() => { setAvatarOpen(false); setWithdrawOpen(true); }}
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                          <ArrowUpCircle size={14} /> Retirar
                        </button>
                        <button
                          onClick={() => { setAvatarOpen(false); setReferralOpen(true); }}
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                          <Gift size={14} /> Referidos
                        </button>
                        <button
                          onClick={() => { setAvatarOpen(false); setNotifOpen(true); }}
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                          <Bell size={14} />
                          Notificaciones
                          {unreadCount > 0 && (
                            <span className="ml-auto min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center tabular-nums">
                              {unreadCount > 9 ? "9+" : unreadCount}
                            </span>
                          )}
                        </button>
                      </div>

                      {/* Navegación */}
                      <Link
                        to="/profile"
                        onClick={() => setAvatarOpen(false)}
                        className="flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      >
                        <User size={14} /> Mi perfil
                      </Link>
                      <Link
                        to="/my-bets"
                        onClick={() => setAvatarOpen(false)}
                        className="flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      >
                        <BarChart2 size={14} /> Mis predicciones
                      </Link>
                      <Link
                        to="/stats"
                        onClick={() => setAvatarOpen(false)}
                        className="flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      >
                        <LineChart size={14} /> Estadísticas
                      </Link>
                      <Link
                        to="/leaderboard"
                        onClick={() => setAvatarOpen(false)}
                        className="flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      >
                        <Trophy size={14} /> Leaderboard
                      </Link>
                      <Link
                        to="/help"
                        onClick={() => setAvatarOpen(false)}
                        className="flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      >
                        <HelpCircle size={14} /> Centro de ayuda
                      </Link>
                      <div className="h-px bg-gray-100 dark:bg-gray-800" />
                      <button
                        onClick={() => { setAvatarOpen(false); handleSignOut(); }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <LogOut size={14} /> Cerrar sesión
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <Button variant="primary" onClick={() => setAuthOpen(true)}>
                <LogIn size={14} strokeWidth={2} />
                Entrar
              </Button>
            )}
          </div>
        </div>

        {/* ── Búsqueda expandida en móvil ── */}
        {searchOpen && (
          <div className="sm:hidden px-3 pb-2">
            <form onSubmit={(e) => { handleSearch(e); setSearchOpen(false); }} className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                autoFocus
                type="text"
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
                onBlur={() => { if (!searchVal) setSearchOpen(false); }}
                placeholder="Buscar mercados..."
                className="w-full bg-gray-100 dark:bg-gray-800 border border-transparent rounded-full pl-8 pr-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 placeholder:text-gray-400 focus:outline-none focus:bg-white dark:focus:bg-gray-700 focus:border-gray-300 dark:focus:border-gray-600 transition-all"
              />
            </form>
          </div>
        )}

        {/* ── Fila de categorías ── */}
        <div
          className="max-w-[1400px] mx-auto px-4 md:px-6 overflow-x-auto scrollbar-hide scroll-touch"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="flex items-center gap-0.5 py-1 whitespace-nowrap min-w-max">

            {/* Especiales */}
            {SPECIAL.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => selectCat(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                  activeCat === id
                    ? "text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                <Icon
                  size={13}
                  className={id === "saved" && savedCount > 0 ? "fill-amber-400 text-amber-500" : ""}
                />
                {label}
                {id === "saved" && savedCount > 0 && (
                  <span className="ml-0.5 min-w-[17px] h-[17px] px-1 bg-amber-400 text-white text-[10px] font-bold rounded-full flex items-center justify-center tabular-nums leading-none">
                    {savedCount > 99 ? "99+" : savedCount}
                  </span>
                )}
              </button>
            ))}

            {/* Separador */}
            <div className="w-px h-4 bg-gray-200 mx-1.5 shrink-0" />

            {/* Categorías */}
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => selectCat(cat)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeCat === cat
                    ? "text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800 font-semibold"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                {cat}
              </button>
            ))}

            {/* Más */}
            <button className="flex items-center gap-0.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors">
              Más <ChevronDown size={13} />
            </button>

            {/* Separador + FAQ */}
            <div className="w-px h-4 bg-gray-200 mx-1.5 shrink-0" />
            <Link
              to="/help"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <HelpCircle size={13} />
              Ayuda
            </Link>
          </div>
        </div>
      </header>

      {/* Panel de notificaciones — funciona en móvil y desktop */}
      {notifOpen && (
        <div
          ref={notifRef}
          className="fixed sm:absolute right-2 sm:right-auto top-[110px] sm:top-auto w-[calc(100vw-16px)] sm:w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl z-50 overflow-hidden"
          style={{ maxWidth: 320 }}
        >
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Notificaciones</p>
            <button onClick={() => setNotifOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              <XCircle size={16} />
            </button>
          </div>

          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
              <Bell size={28} className="text-gray-200" />
              <p className="text-sm font-semibold text-gray-500">Sin notificaciones</p>
              <p className="text-xs text-gray-400">Aquí aparecerán tus predicciones resueltas.</p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800">
              {notifications.map((n) => {
                const isWon  = n.status === "won";
                const payout = n.payout_amount ?? n.potential_payout ?? 0;
                return (
                  <div key={n.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <div className={`mt-0.5 shrink-0 rounded-full p-1 ${isWon ? "bg-emerald-50" : "bg-rose-50"}`}>
                      {isWon
                        ? <CheckCircle size={14} className="text-emerald-600" />
                        : <XCircle    size={14} className="text-rose-500"    />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 leading-snug">{n.market_title}</p>
                      <p className={`text-[12px] font-bold mt-0.5 ${isWon ? "text-emerald-600" : "text-rose-500"}`}>
                        {isWon ? `+$${payout.toFixed(2)} MXN` : `-$${n.amount.toFixed(2)} MXN`}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        Predijiste {n.side === "yes" ? "Sí" : "No"} · {new Date(n.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-800">
            <Link
              to="/my-bets"
              onClick={() => setNotifOpen(false)}
              className="block text-center text-[12px] font-semibold text-blue-600 hover:text-blue-700 transition-colors"
            >
              Ver todas mis predicciones
            </Link>
          </div>
        </div>
      )}

      <DepositModal open={depositOpen} onOpenChange={setDepositOpen} />
      <WithdrawModal open={withdrawOpen} onOpenChange={setWithdrawOpen} />
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
      <ReferralModal open={referralOpen} onOpenChange={setReferralOpen} />
    </>
  );
}
