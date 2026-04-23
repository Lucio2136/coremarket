import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { SEOHead } from "@/components/SEOHead";
import { useMyBets } from "@/hooks/use-my-bets";
import { useMarkets } from "@/hooks/use-markets";
import { useAuth } from "@/context/AuthContext";
import { AuthModal } from "@/components/modals/AuthModal";
import {
  TrendingUp, Clock, CheckCircle, XCircle,
  LogIn, BarChart2, Activity, DollarSign, Users, Share2, BarChart,
} from "lucide-react";

// ── Genera imagen de la predicción y la comparte ─────────────────────────────

async function shareCard(bet: any) {
  const W = 1080, H = 566;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Fondo
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "#0f172a");
  grad.addColorStop(1, "#1e293b");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Patrón de puntos
  ctx.fillStyle = "rgba(255,255,255,0.035)";
  for (let x = 20; x < W; x += 40)
    for (let y = 20; y < H; y += 40)
      { ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill(); }

  // Logo
  ctx.fillStyle = "#ffffff";
  ctx.beginPath(); ctx.roundRect(52, 48, 52, 52, 14); ctx.fill();
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 32px sans-serif";
  ctx.textBaseline = "middle"; ctx.textAlign = "center";
  ctx.fillText("C", 78, 75);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 28px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Lucebase", 118, 72);

  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.font = "18px sans-serif";
  ctx.fillText("Mercados de predicción", 118, 100);

  // Badge Sí/No
  const isYes = bet.side === "yes";
  const badgeColor = isYes ? "#10b981" : "#f43f5e";
  ctx.fillStyle = badgeColor;
  ctx.beginPath(); ctx.roundRect(52, 170, 140, 60, 16); ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 34px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(isYes ? "SÍ" : "NO", 122, 208);

  // Resultado
  const isWon = bet.status === "won";
  const isLost = bet.status === "lost";
  if (isWon || isLost) {
    const resColor = isWon ? "#10b981" : "#f43f5e";
    const resLabel = isWon ? "ACERTADA ✓" : "FALLIDA ✗";
    ctx.fillStyle = resColor + "33";
    ctx.beginPath(); ctx.roundRect(210, 170, 200, 60, 16); ctx.fill();
    ctx.fillStyle = resColor;
    ctx.font = "bold 22px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(resLabel, 310, 208);
  }

  // Título del mercado
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = "bold 36px sans-serif";
  ctx.textAlign = "left";
  const title: string = bet.markets?.title ?? "Mercado de predicción";
  const words = title.split(" ");
  let line = "", lines: string[] = [];
  for (const w of words) {
    const test = line + w + " ";
    if (ctx.measureText(test).width > W - 104 && line) { lines.push(line.trim()); line = w + " "; }
    else line = test;
  }
  if (line) lines.push(line.trim());
  lines = lines.slice(0, 3);
  lines.forEach((l, i) => ctx.fillText(l, 52, 290 + i * 46));

  // Montos
  const fmt2 = (n: number) => n.toLocaleString("es-MX", { minimumFractionDigits: 2 });
  const payout = bet.payout_amount ?? bet.potential_payout ?? 0;

  const metrics = [
    { label: "Invertido",  value: `$${fmt2(bet.amount)} MXN` },
    { label: isWon ? "Cobrado" : "Potencial", value: `$${fmt2(payout)} MXN`, color: isWon ? "#10b981" : "rgba(255,255,255,0.8)" },
    { label: "Cuota",      value: `${(bet.odds_at_bet ?? 0).toFixed(2)}x` },
  ];
  metrics.forEach((m, i) => {
    const x = 52 + i * 340;
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = "16px sans-serif"; ctx.textAlign = "left";
    ctx.fillText(m.label.toUpperCase(), x, 468);
    ctx.fillStyle = m.color ?? "#ffffff";
    ctx.font = "bold 28px sans-serif";
    ctx.fillText(m.value, x, 502);
  });

  // Footer
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(0, 534, W, 1);
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "16px sans-serif"; ctx.textAlign = "right";
  ctx.fillText("lucebase.mx", W - 52, 553);

  // Compartir
  const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/png"));
  const file = new File([blob], "prediccion-lucebase.png", { type: "image/png" });
  const marketTitle = bet.markets?.title ?? "Mercado";
  const text = isWon
    ? `¡Acerté! Gané $${(payout - bet.amount).toFixed(0)} MXN en Lucebase prediciendo "${marketTitle}" 🏆`
    : `Aposté ${isYes ? "SÍ" : "NO"} en "${marketTitle}" en Lucebase 🎯`;

  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ title: "Mi predicción en Lucebase", text, files: [file] });
  } else if (navigator.share) {
    await navigator.share({ title: "Mi predicción", text, url: "https://lucebase.mx" });
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "prediccion-lucebase.png"; a.click();
    URL.revokeObjectURL(url);
  }
}

type Filter = "all" | "pending" | "won" | "lost";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all",     label: "Todas"      },
  { id: "pending", label: "En curso"   },
  { id: "won",     label: "Acertadas"  },
  { id: "lost",    label: "Fallidas"   },
];

const STATUS_CONFIG = {
  won:     { label: "Acertada",  icon: CheckCircle, cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  lost:    { label: "Fallida",   icon: XCircle,     cls: "bg-rose-50 text-rose-600 border-rose-200"         },
  pending: { label: "En curso",  icon: Clock,       cls: "bg-amber-50 text-amber-700 border-amber-200"      },
};

function fmt(n: number) {
  return n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function MyBetsPage() {
  const { isAuthenticated } = useAuth();
  const { bets, loading, error } = useMyBets();
  const { markets } = useMarkets();

  const openCount    = markets.length;
  const totalPool    = markets.reduce((s, m) => s + (m.total_pool ?? 0), 0);
  const totalBettors = markets.reduce((s, m) => s + (m.bettor_count ?? 0), 0);
  const fmtPool = (n: number) =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000   ? `$${(n / 1_000).toFixed(1)}k`
    : `$${n.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`;

  const globalStats = [
    { icon: Activity,   value: `${openCount}`,      label: "mercados abiertos" },
    { icon: DollarSign, value: fmtPool(totalPool),   label: "MXN en juego"     },
    { icon: Users,      value: `${totalBettors}`,    label: "posiciones activas"},
  ];
  const [authOpen, setAuthOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <BarChart2 size={44} className="text-gray-200" />
        <h2 className="text-xl font-bold text-gray-900">Inicia sesión para ver tus predicciones</h2>
        <p className="text-sm text-gray-400">Lleva el registro de tus predicciones y ganancias.</p>
        <button
          onClick={() => setAuthOpen(true)}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
        >
          <LogIn size={16} />
          Iniciar sesión
        </button>
        <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Header skeleton */}
        <div className="space-y-1.5">
          <div className="h-7 w-44 bg-gray-100 rounded-xl animate-pulse" />
          <div className="h-4 w-28 bg-gray-100 rounded-xl animate-pulse" />
        </div>
        {/* Stats bar skeleton */}
        <div className="h-14 bg-gray-100 rounded-2xl animate-pulse" />
        {/* Stat cards skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-3 text-center space-y-1.5 animate-pulse">
              <div className="h-6 w-16 bg-gray-100 rounded-lg mx-auto" />
              <div className="h-2.5 w-12 bg-gray-100 rounded-full mx-auto" />
            </div>
          ))}
        </div>
        {/* Bet card skeletons */}
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl overflow-hidden animate-pulse">
              <div className="h-0.5 w-full bg-gray-100" />
              <div className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-7 bg-gray-100 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-gray-100 rounded-full w-4/5" />
                    <div className="h-3 bg-gray-100 rounded-full w-2/3" />
                  </div>
                  <div className="w-16 h-6 bg-gray-100 rounded-full shrink-0" />
                </div>
                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-100">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <div key={j} className="text-center space-y-1">
                      <div className="h-2 w-12 bg-gray-100 rounded-full mx-auto" />
                      <div className="h-4 w-14 bg-gray-100 rounded-lg mx-auto" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16 text-sm text-red-500">
        Error al cargar predicciones: {error}
      </div>
    );
  }

  // Stats
  const totalApostado = bets.reduce((s: number, b: any) => s + (b.amount ?? 0), 0);
  const totalGanado   = bets
    .filter((b: any) => b.status === "won")
    .reduce((s: number, b: any) => s + (b.payout_amount ?? b.potential_payout ?? 0), 0);
  const nGanadas   = bets.filter((b: any) => b.status === "won").length;
  const nPerdidas  = bets.filter((b: any) => b.status === "lost").length;
  const nResueltas = nGanadas + nPerdidas;
  const winRate    = nResueltas > 0 ? Math.round((nGanadas / nResueltas) * 100) : null;
  const roi        = totalApostado > 0 ? ((totalGanado - totalApostado) / totalApostado) * 100 : null;

  // Racha actual: recorrer bets ordenadas por fecha desc hasta encontrar una que no sea "won"
  const sorted  = [...bets].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  let streak = 0;
  for (const b of sorted) {
    if (b.status === "won") streak++;
    else if (b.status === "lost") break;
    // pending: no rompe racha, no suma
  }

  // Filtro
  const visible = filter === "all" ? bets : bets.filter((b: any) => b.status === filter);

  return (
    <>
    <SEOHead title="Mis Predicciones" url="/my-bets" noIndex={true} />
    <div className="max-w-2xl mx-auto space-y-5">

      {/* Encabezado */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-gray-100" style={{ letterSpacing: "-0.01em" }}>Mis predicciones</h1>
          <p className="text-sm text-gray-400 mt-0.5">{bets.length} predicción{bets.length !== 1 ? "es" : ""} en total</p>
        </div>
        <Link
          to="/stats"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-[13px] font-semibold rounded-xl transition-colors shrink-0"
        >
          <BarChart size={13} />
          Estadísticas
        </Link>
      </div>

      {/* Stats globales */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-2xl">
        {globalStats.map(({ icon: Icon, value, label }, i) => (
          <div key={i} className="flex items-center gap-2 flex-1 min-w-0">
            {i > 0 && <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 shrink-0" />}
            <div className={`flex items-center gap-2 ${i > 0 ? "flex-1 pl-3" : "flex-1"} min-w-0`}>
              <div className="w-6 h-6 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center shrink-0 shadow-sm">
                <Icon size={11} className="text-gray-500" />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-slate-900 dark:text-gray-100 tabular-nums leading-none">{value}</p>
                <p className="text-[10px] text-gray-400 leading-none mt-0.5 truncate">{label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Stats */}
      {bets.length > 0 && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: "Invertido",  value: `$${fmt(totalApostado)}`, color: "text-gray-900" },
              { label: "Ganado",    value: `$${fmt(totalGanado)}`,   color: "text-emerald-600" },
              { label: "Ganadas",   value: String(nGanadas),          color: "text-emerald-600" },
              { label: "Perdidas",  value: String(nPerdidas),         color: "text-rose-500" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white border border-gray-200 rounded-xl p-3 text-center">
                <p className={`text-lg font-bold tabular-nums ${color}`}>{value}</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Métricas avanzadas */}
          {nResueltas > 0 && (
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
                <p className={`text-lg font-bold tabular-nums ${(winRate ?? 0) >= 50 ? "text-emerald-600" : "text-rose-500"}`}>
                  {winRate}%
                </p>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-0.5">Win rate</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
                <p className={`text-lg font-bold tabular-nums ${(roi ?? 0) >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                  {roi !== null ? `${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%` : "—"}
                </p>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-0.5">ROI</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
                <p className={`text-lg font-bold tabular-nums ${streak > 0 ? "text-amber-500" : "text-gray-400"}`}>
                  {streak > 0 ? `🔥 ${streak}` : "—"}
                </p>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-0.5">Racha</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabs de filtro */}
      {bets.length > 0 && (
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          {FILTERS.map(({ id, label }) => {
            const count = id === "all"
              ? bets.length
              : bets.filter((b: any) => b.status === id).length;
            return (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className={[
                  "px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-all",
                  filter === id
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700",
                ].join(" ")}
              >
                {label}
                {count > 0 && (
                  <span className={`ml-1.5 text-[11px] font-bold ${filter === id ? "text-gray-400" : "text-gray-400"}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Lista */}
      {bets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
          <TrendingUp size={40} className="text-gray-200" />
          <p className="text-base font-semibold text-gray-700">Aún no tienes predicciones</p>
          <p className="text-sm text-gray-400">Ve a los mercados y haz tu primera predicción.</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16 text-sm text-gray-400">
          No hay predicciones en esta categoría.
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((bet: any) => {
            const cfg = STATUS_CONFIG[bet.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
            const Icon = cfg.icon;
            const isWon = bet.status === "won";
            const payout = bet.payout_amount ?? bet.potential_payout ?? 0;

            return (
              <div key={bet.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                {/* Franja superior de color según resultado */}
                <div className={`h-0.5 w-full ${isWon ? "bg-emerald-400" : bet.status === "lost" ? "bg-rose-400" : "bg-amber-300"}`} />

                <div className="p-4">
                  {/* Fila principal */}
                  <div className="flex items-start gap-3">
                    {/* Badge lado */}
                    <span className={`shrink-0 mt-0.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                      bet.side === "yes"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-rose-50 text-rose-600 border-rose-200"
                    }`}>
                      {bet.side === "yes" ? "SÍ" : "NO"}
                    </span>

                    {/* Título + fecha */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-gray-900 line-clamp-2 leading-snug">
                        {bet.markets?.title ?? `Mercado #${bet.market_id?.slice(0, 8)}`}
                      </p>
                      <p className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 mt-0.5">
                        {new Date(bet.created_at).toLocaleDateString("es-MX", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </p>
                    </div>

                    {/* Status */}
                    <span className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${cfg.cls}`}>
                      <Icon size={11} />
                      {cfg.label}
                    </span>
                  </div>

                  {/* Montos */}
                  <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 text-center">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Invertido</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-gray-100 tabular-nums mt-0.5">
                        ${fmt(bet.amount ?? 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Cuota</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-gray-100 tabular-nums mt-0.5">
                        {(bet.odds_at_bet ?? 0).toFixed(2)}x
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        {isWon ? "Cobrado" : "Potencial"}
                      </p>
                      <p className={`text-sm font-bold tabular-nums mt-0.5 ${isWon ? "text-emerald-600" : "text-gray-900 dark:text-gray-100"}`}>
                        ${fmt(payout)}
                      </p>
                    </div>
                  </div>

                  {/* Compartir — solo en predicciones resueltas */}
                  {bet.status !== "pending" && (
                    <div className="mt-2 pt-2 border-t border-gray-50 dark:border-gray-800/60 flex justify-end">
                      <button
                        onClick={() => shareCard(bet)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors active:scale-95"
                      >
                        <Share2 size={12} />
                        Compartir
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
    </>
  );
}
