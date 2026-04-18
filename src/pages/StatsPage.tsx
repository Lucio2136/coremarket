import { Link } from "react-router-dom";
import { useState } from "react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, ResponsiveContainer, Tooltip as ReTooltip,
  ReferenceLine, CartesianGrid,
} from "recharts";
import {
  TrendingUp, TrendingDown, Target, Flame, Trophy,
  BarChart2, LogIn, ArrowRight,
} from "lucide-react";
import { useStats } from "@/hooks/use-stats";
import { useAuth } from "@/context/AuthContext";
import { AuthModal } from "@/components/modals/AuthModal";
import { useState as useLocalState } from "react";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 2) {
  return n.toLocaleString("es-MX", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtPct(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function shortDate(d: string) {
  const [, m, day] = d.split("-");
  const MONTHS = ["", "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${parseInt(day)} ${MONTHS[parseInt(m)]}`;
}

// ── Custom tooltip para la gráfica ──────────────────────────────────────────

const PnLTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const v: number = payload[0]?.value ?? 0;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 shadow-xl">
      <p className="text-[11px] text-gray-400 mb-0.5">{label}</p>
      <p className={`text-[14px] font-bold tabular-nums ${v >= 0 ? "text-emerald-400" : "text-rose-400"}`}
       >
        {v >= 0 ? "+" : ""}${fmt(v)} MXN
      </p>
    </div>
  );
};

const BarTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 shadow-xl">
      <p className="text-[11px] text-gray-400 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="text-[12px] font-semibold" style={{ color: p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

// ── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, color = "text-gray-900 dark:text-gray-100", bg = "bg-white dark:bg-[#0d1117]",
}: {
  label: string; value: string; sub?: string;
  color?: string; bg?: string;
}) {
  return (
    <div className={`${bg} border border-gray-200 dark:border-gray-800 rounded-2xl p-4`}>
      <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5">{label}</p>
      <p className={`text-xl font-bold tabular-nums leading-none ${color}`}>
        {value}
      </p>
      {sub && <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function StatsSkeleton() {
  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-gray-100 dark:bg-gray-800 rounded-xl" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800 rounded-2xl" />
        ))}
      </div>
      <div className="h-52 bg-gray-100 dark:bg-gray-800 rounded-2xl" />
      <div className="h-48 bg-gray-100 dark:bg-gray-800 rounded-2xl" />
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function StatsPage() {
  const { isAuthenticated } = useAuth();
  const [authOpen, setAuthOpen] = useLocalState(false);

  const {
    bets, loading,
    totalWagered, totalReturned, netPnL, roi, winRate,
    streak, bestStreak,
    wonCount, lostCount, pendingCount,
    dailyPnL, categoryStats,
    bestMarkets, worstMarkets,
  } = useStats();

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <BarChart2 size={44} className="text-gray-200 dark:text-gray-700" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Inicia sesión para ver tus estadísticas</h2>
        <p className="text-sm text-gray-400">Aquí verás tu rendimiento, gráficas de P&L y más.</p>
        <button
          onClick={() => setAuthOpen(true)}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
        >
          <LogIn size={16} /> Iniciar sesión
        </button>
        <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
      </div>
    );
  }

  if (loading) return <StatsSkeleton />;

  if (bets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-center">
        <TrendingUp size={44} className="text-gray-200 dark:text-gray-700" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Aún sin estadísticas</h2>
        <p className="text-sm text-gray-400">Haz tu primera predicción para empezar a ver tu rendimiento.</p>
        <Link to="/" className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors text-sm">
          Ver mercados <ArrowRight size={14} />
        </Link>
      </div>
    );
  }

  const pnlPositive = netPnL >= 0;
  const roiPositive = roi >= 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100" style={{ letterSpacing: "-0.01em" }}>
          Mis estadísticas
        </h1>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
          {bets.length} predicciones · {wonCount} acertadas · {lostCount} fallidas{pendingCount > 0 ? ` · ${pendingCount} en curso` : ""}
        </p>
      </div>

      {/* ── Métricas principales ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="P&L neto"
          value={`${pnlPositive ? "+" : ""}$${fmt(netPnL)}`}
          sub="MXN"
          color={pnlPositive ? "text-emerald-600" : "text-rose-500"}
        />
        <StatCard
          label="ROI"
          value={fmtPct(roi)}
          sub="retorno total"
          color={roiPositive ? "text-emerald-600" : "text-rose-500"}
        />
        <StatCard
          label="Win rate"
          value={`${winRate.toFixed(0)}%`}
          sub={`${wonCount}/${wonCount + lostCount} resueltas`}
          color={winRate >= 50 ? "text-emerald-600" : "text-rose-500"}
        />
        <StatCard
          label="Racha actual"
          value={streak > 0 ? `🔥 ${streak}` : streak < 0 ? `${streak}` : "—"}
          sub={`Mejor: ${bestStreak} seguidas`}
          color={streak > 0 ? "text-amber-500" : "text-gray-500"}
        />
        <StatCard label="Total invertido"   value={`$${fmt(totalWagered)}`}  sub="MXN apostado"   />
        <StatCard label="Total cobrado"     value={`$${fmt(totalReturned)}`} sub="MXN retornado"  color="text-emerald-600" />
        <StatCard label="Acertadas"         value={String(wonCount)}         sub="predicciones"   color="text-emerald-600" />
        <StatCard label="Mejor racha"       value={String(bestStreak)}       sub="victorias seguidas" color="text-amber-500" />
      </div>

      {/* ── Gráfica P&L acumulado ── */}
      {dailyPnL.length >= 2 && (
        <div className="bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">P&L acumulado</p>
              <p className={`text-lg font-bold tabular-nums mt-0.5 ${pnlPositive ? "text-emerald-600" : "text-rose-500"}`}
               >
                {pnlPositive ? "+" : ""}${fmt(netPnL)} MXN
              </p>
            </div>
            {pnlPositive
              ? <TrendingUp size={20} className="text-emerald-500" />
              : <TrendingDown size={20} className="text-rose-500" />
            }
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={dailyPnL} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <defs>
                <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={pnlPositive ? "#10b981" : "#f43f5e"} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={pnlPositive ? "#10b981" : "#f43f5e"} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" strokeOpacity={0.5} />
              <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false}
                tickFormatter={(v) => `$${Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`} />
              <ReTooltip content={<PnLTooltip />} />
              <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 2" strokeOpacity={0.5} />
              <Area
                type="monotone" dataKey="cumulative"
                stroke={pnlPositive ? "#10b981" : "#f43f5e"}
                strokeWidth={2}
                fill="url(#pnlGrad)"
                dot={false}
                activeDot={{ r: 4, fill: pnlPositive ? "#10b981" : "#f43f5e", stroke: "white", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Apuestas por categoría ── */}
      {categoryStats.length > 0 && (
        <div className="bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
          <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">Predicciones por categoría</p>
          <ResponsiveContainer width="100%" height={Math.max(120, categoryStats.length * 36)}>
            <BarChart data={categoryStats} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="category" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} width={80} />
              <ReTooltip content={<BarTooltip />} />
              <Bar dataKey="won"     name="Acertadas"  stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
              <Bar dataKey="lost"    name="Fallidas"   stackId="a" fill="#f43f5e" radius={[0, 0, 0, 0]} />
              <Bar dataKey="pending" name="En curso"   stackId="a" fill="#f59e0b" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Mejores y peores mercados ── */}
      {(bestMarkets.length > 0 || worstMarkets.length > 0) && (
        <div className="grid sm:grid-cols-2 gap-4">

          {/* Mejores */}
          {bestMarkets.length > 0 && (
            <div className="bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Trophy size={14} className="text-amber-500" />
                <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Mejores mercados</p>
              </div>
              <div className="space-y-2">
                {bestMarkets.map((m, i) => (
                  <div key={m.title} className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-gray-300 dark:text-gray-600 w-4 text-right">{i + 1}</span>
                    <p className="flex-1 text-[12px] font-medium text-gray-700 dark:text-gray-300 truncate">{m.title}</p>
                    <span className="text-[12px] font-bold text-emerald-600 tabular-nums shrink-0"
                     >
                      +${fmt(m.pnl)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Peores */}
          {worstMarkets.filter((m) => m.pnl < 0).length > 0 && (
            <div className="bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown size={14} className="text-rose-500" />
                <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Mercados con pérdida</p>
              </div>
              <div className="space-y-2">
                {worstMarkets.filter((m) => m.pnl < 0).map((m, i) => (
                  <div key={m.title} className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-gray-300 dark:text-gray-600 w-4 text-right">{i + 1}</span>
                    <p className="flex-1 text-[12px] font-medium text-gray-700 dark:text-gray-300 truncate">{m.title}</p>
                    <span className="text-[12px] font-bold text-rose-500 tabular-nums shrink-0"
                     >
                      ${fmt(m.pnl)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Notificaciones push ── */}
      <PushSection />

    </div>
  );
}

// ── Sección de notificaciones push ──────────────────────────────────────────

import { usePushNotifications } from "@/hooks/use-push-notifications";
import { Bell, BellOff } from "lucide-react";

function PushSection() {
  const { supported, permission, subscribed, loading, subscribe, unsubscribe } = usePushNotifications();

  if (!supported) return null;

  return (
    <div className="bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-gray-800 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
      <div className="flex items-center gap-3 flex-1">
        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 flex items-center justify-center shrink-0">
          {subscribed ? <Bell size={16} className="text-blue-600" /> : <BellOff size={16} className="text-gray-400" />}
        </div>
        <div>
          <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">
            Notificaciones push
          </p>
          <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">
            {subscribed
              ? "Recibirás avisos cuando tus predicciones se resuelvan."
              : "Activa los avisos para saber cuándo ganaste o perdiste."}
          </p>
        </div>
      </div>
      {permission === "denied" ? (
        <p className="text-[12px] text-rose-500 shrink-0">Bloqueadas en el navegador</p>
      ) : (
        <button
          onClick={subscribed ? unsubscribe : subscribe}
          disabled={loading}
          className={`shrink-0 px-4 py-2 rounded-xl text-[13px] font-semibold transition-colors disabled:opacity-50 ${
            subscribed
              ? "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          {loading ? "..." : subscribed ? "Desactivar" : "Activar"}
        </button>
      )}
    </div>
  );
}
