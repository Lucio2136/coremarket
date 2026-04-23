import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { SEOHead } from "@/components/SEOHead";
import { ShareModal } from "@/components/modals/ShareModal";
import {
  ArrowLeft, Users, Lock, TrendingUp, Share2, Wallet, AlertCircle,
  CheckCircle2, XCircle, Trophy, Activity, LineChart,
  MessageCircle, Send, Trash2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer,
  Tooltip as ReTooltip, ReferenceLine,
} from "recharts";
import { useMarket } from "@/hooks/use-market";
import { useMarkets } from "@/hooks/use-markets";
import { useAuth } from "@/context/AuthContext";
import { useBet } from "@/hooks/use-bet";
import { usePriceHistory, PricePoint } from "@/hooks/use-price-history";
import { useComments } from "@/hooks/use-comments";
import { supabase, Bet, MarketOption } from "@/lib/supabase";
import { MarketCard } from "@/components/MarketCard";
import { AuthModal } from "@/components/modals/AuthModal";
import { toast } from "sonner";

// ─── helpers ────────────────────────────────────────────────────────────────

function formatVol(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n || 0}`;
}

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("es-MX", {
    day: "numeric", month: "long", year: "numeric",
  });
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

const PALETTE = [
  { bg: "#0f172a", fg: "#f8fafc" }, { bg: "#1e3a5f", fg: "#e0f2fe" },
  { bg: "#14532d", fg: "#dcfce7" }, { bg: "#3b0764", fg: "#f3e8ff" },
  { bg: "#431407", fg: "#fef3c7" }, { bg: "#172554", fg: "#dbeafe" },
  { bg: "#134e4a", fg: "#ccfbf1" }, { bg: "#4a1942", fg: "#fdf4ff" },
];
function iconColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}

const AVATAR_COLORS: Record<string, string> = {
  violet: "from-violet-500 to-pink-500",
  blue:   "from-blue-500 to-cyan-400",
  green:  "from-emerald-500 to-teal-400",
  orange: "from-orange-400 to-amber-300",
  rose:   "from-rose-500 to-pink-400",
  indigo: "from-indigo-500 to-violet-400",
};

// ─── Gráfica de probabilidad histórica ──────────────────────────────────────

function formatChartTime(ts: number): string {
  const diff = Date.now() - ts;
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "ahora";
  if (h < 24) return `-${h}h`;
  const d = Math.floor(h / 24);
  return d === 0 ? `-${h}h` : `-${d}d`;
}

interface ChartTooltipProps {
  active?:  boolean;
  payload?: Array<{ value: number }>;
  label?:   number;
}

function ChartTooltipContent({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const pct = payload[0].value as number;
  const date = new Date(label!).toLocaleString("es-MX", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 shadow-lg text-[12px]">
      <p className="font-bold text-emerald-600">
        SÍ {pct.toFixed(1)}%
      </p>
      <p className="text-gray-400 mt-0.5">{date}</p>
    </div>
  );
}

function PriceChart({
  history,
  loading,
  currentPct,
}: {
  history:    PricePoint[];
  loading:    boolean;
  currentPct: number;
}) {
  if (loading) {
    return (
      <div className="h-[120px] animate-pulse bg-gray-50 dark:bg-gray-800/40 rounded-xl" />
    );
  }

  // Con solo 1 punto (el seed inicial), hay poca historia; mostramos igual con el punto actual
  const rawData = history.length >= 1 ? history : [];
  const data = rawData.map((p) => ({
    time: new Date(p.recorded_at).getTime(),
    pct:  p.yes_percent,
  }));

  // Siempre añadir el punto "ahora" si el último dato no es reciente
  if (
    data.length === 0 ||
    Date.now() - data[data.length - 1].time > 60_000
  ) {
    data.push({ time: Date.now(), pct: currentPct });
  }

  if (data.length < 2) {
    return (
      <div className="h-[120px] flex flex-col items-center justify-center gap-2 text-center bg-gray-50 dark:bg-gray-800/30 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
        <LineChart size={20} className="text-gray-300 dark:text-gray-700" />
        <p className="text-[11px] text-gray-400">La gráfica se irá llenando con cada apuesta</p>
      </div>
    );
  }

  const minPct  = Math.max(0, Math.min(...data.map((d) => d.pct)) - 5);
  const maxPct  = Math.min(100, Math.max(...data.map((d) => d.pct)) + 5);

  return (
    <div className="h-[140px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
          <defs>
            <linearGradient id="yesAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#10b981" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0}    />
            </linearGradient>
          </defs>
          <ReferenceLine
            y={50}
            stroke="#e5e7eb"
            strokeDasharray="3 3"
            strokeWidth={1}
          />
          <XAxis
            dataKey="time"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={formatChartTime}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 9, fill: "#9ca3af" }}
            minTickGap={40}
          />
          <YAxis
            domain={[minPct, maxPct]}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 9, fill: "#9ca3af" }}
            tickFormatter={(v) => `${v}%`}
            width={38}
          />
          <ReTooltip
            content={<ChartTooltipContent />}
            cursor={{ stroke: "#10b981", strokeWidth: 1, strokeDasharray: "3 3" }}
          />
          <Area
            type="monotone"
            dataKey="pct"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#yesAreaGrad)"
            dot={false}
            activeDot={{ r: 4, fill: "#10b981", strokeWidth: 0 }}
            isAnimationActive
            animationDuration={700}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}


// ─── Banner de resultado ─────────────────────────────────────────────────────

function ResultBanner({
  result,
  winningOption,
  scalarResult,
  scalarUnit,
}: {
  result: "yes" | "no" | null;
  winningOption?: MarketOption | null;
  scalarResult?: number | null;
  scalarUnit?: string | null;
}) {
  const isScalar = scalarResult != null;
  const label = isScalar
    ? `${scalarResult} ${scalarUnit ?? ""}`
    : winningOption ? winningOption.label
    : result === "yes" ? "SÍ" : "NO";
  const isPositive = isScalar || winningOption ? true : result === "yes";

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border mb-5 ${
        isPositive
          ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
          : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800"
      }`}
    >
      <CheckCircle2 size={18} className={isPositive ? "text-emerald-600 shrink-0" : "text-rose-500 shrink-0"} />
      <div>
        <p className={`text-sm font-bold ${isPositive ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
          {isScalar ? "Mercado resuelto — resultado:" : "Mercado resuelto — ganó"}{" "}
          <span className="font-black">{label}</span>
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Este mercado ya cerró y fue resuelto.
        </p>
      </div>
    </motion.div>
  );
}

// ─── Mi posición ─────────────────────────────────────────────────────────────

function UserPosition({ marketId, result }: { marketId: string; result: "yes" | "no" | null }) {
  const { user } = useAuth();
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    supabase
      .from("bets")
      .select("*")
      .eq("market_id", marketId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setBets(data ?? []); setLoading(false); });
  }, [marketId, user]);

  if (!user || loading || bets.length === 0) return null;

  const totalBet    = bets.reduce((s, b) => s + b.amount, 0);
  const totalPayout = bets.reduce((s, b) => s + (b.payout_amount ?? b.potential_payout), 0);
  const wonBets     = bets.filter((b) => b.status === "won");

  return (
    <div className="mt-6">
      <h3 className="flex items-center gap-2 text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">
        <Trophy size={12} /> Mi posición
      </h3>
      <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden divide-y divide-gray-100 dark:divide-gray-800/70">
        <div className="flex items-center gap-5 px-4 py-3 bg-gray-50/60 dark:bg-white/[0.02]">
          <div>
            <p className="text-[9.5px] text-gray-400 uppercase font-bold tracking-widest mb-0.5">Invertido</p>
            <p className="font-bold text-gray-900 dark:text-gray-100 text-sm">
              ${totalBet.toFixed(2)}
            </p>
          </div>
          <div className="w-px h-8 bg-gray-200 dark:bg-gray-700" />
          <div>
            <p className="text-[9.5px] text-gray-400 uppercase font-bold tracking-widest mb-0.5">
              {result ? "Resultado" : "Potencial"}
            </p>
            <p className={`font-bold text-sm ${
              result
                ? wonBets.length > 0 ? "text-emerald-600" : "text-rose-500"
                : "text-gray-900 dark:text-gray-100"
            }`}>
              {result
                ? wonBets.length > 0
                  ? `+$${wonBets.reduce((s, b) => s + (b.payout_amount ?? 0), 0).toFixed(2)}`
                  : "Perdiste"
                : `$${totalPayout.toFixed(2)}`
              }
            </p>
          </div>
        </div>
        {bets.map((bet) => (
          <div key={bet.id} className="flex items-center gap-3 px-4 py-2.5">
            {bet.scalar_low != null ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 tabular-nums">
                {bet.scalar_low}–{bet.scalar_high}
              </span>
            ) : (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                bet.side === "yes"
                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
                  : "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400"
              }`}>
                {bet.side === "yes" ? "SÍ" : "NO"}
              </span>
            )}
            <span className="text-sm text-gray-600 dark:text-gray-300 flex-1">
              ${bet.amount.toFixed(2)} · {bet.odds_at_bet}x
            </span>
            <span className={`text-xs font-semibold ${
              bet.status === "won" ? "text-emerald-600" : bet.status === "lost" ? "text-rose-500" : "text-gray-400"
            }`}>
              {bet.status === "won" ? `+$${(bet.payout_amount ?? 0).toFixed(2)}`
                : bet.status === "lost" ? "Perdida" : "Pendiente"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}


// ─── Actividad reciente ──────────────────────────────────────────────────────

interface ActivityBet {
  id: string;
  side: "yes" | "no";
  amount: number;
  created_at: string;
  profiles: { username: string; avatar_color: string } | null;
}

function RecentActivity({ marketId }: { marketId: string }) {
  const [activity, setActivity] = useState<ActivityBet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("bets")
      .select("id, side, amount, created_at, profiles(username, avatar_color)")
      .eq("market_id", marketId)
      .order("created_at", { ascending: false })
      .limit(15)
      .then(({ data }) => { setActivity((data as ActivityBet[]) ?? []); setLoading(false); });
  }, [marketId]);

  if (loading) {
    return (
      <div className="space-y-2 mt-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-10 bg-gray-100 dark:bg-gray-800/60 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (activity.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2 text-center mt-4">
        <Activity size={24} className="text-gray-300 dark:text-gray-700" />
        <p className="text-sm text-gray-400">Aún no hay actividad</p>
      </div>
    );
  }

  return (
    <div className="mt-4 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden divide-y divide-gray-50 dark:divide-gray-800/70">
      {activity.map((a) => {
        const color = AVATAR_COLORS[a.profiles?.avatar_color ?? "violet"] ?? AVATAR_COLORS.violet;
        const initial = (a.profiles?.username ?? "?").slice(0, 1).toUpperCase();
        return (
          <div key={a.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50/60 dark:hover:bg-white/[0.02] transition-colors">
            <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
              {initial}
            </div>
            <span className="text-[13px] text-gray-700 dark:text-gray-300 flex-1 truncate font-medium">
              {a.profiles?.username ?? "Usuario"}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
              a.side === "yes"
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
                : "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400"
            }`}>
              {a.side === "yes" ? "SÍ" : "NO"}
            </span>
            <span className="text-[12px] font-semibold text-gray-700 dark:text-gray-300 tabular-nums shrink-0">
              ${a.amount.toFixed(0)}
            </span>
            <span className="text-[11px] text-gray-400 dark:text-gray-500 shrink-0 w-8 text-right">
              {timeAgo(a.created_at)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Sección de actividad ────────────────────────────────────────────────────

function MarketActivity({ marketId }: { marketId: string }) {
  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 pb-2.5 mb-0">
        <Activity size={14} strokeWidth={2} className="text-gray-400" />
        <span className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">Actividad reciente</span>
      </div>
      <RecentActivity marketId={marketId} />
    </div>
  );
}

// ─── Comentarios ─────────────────────────────────────────────────────────────

const COMMENT_AVATAR_GRADIENTS: Record<string, string> = {
  violet: "from-violet-500 to-pink-500",
  blue:   "from-blue-500 to-cyan-400",
  green:  "from-emerald-500 to-teal-400",
  orange: "from-orange-400 to-amber-300",
  rose:   "from-rose-500 to-pink-400",
  indigo: "from-indigo-500 to-violet-400",
};

function MarketComments({ marketId }: { marketId: string }) {
  const { user, profile, isAuthenticated } = useAuth();
  const { comments, loading, posting, postComment, deleteComment } = useComments(marketId);
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const MAX = 280;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || text.length > MAX) return;
    const ok = await postComment(text);
    if (ok) {
      setText("");
    } else {
      toast.error("No se pudo publicar el comentario");
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  return (
    <div className="mt-8">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 pb-2.5 mb-4">
        <MessageCircle size={14} strokeWidth={2} className="text-gray-400" />
        <span className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">
          Comentarios
        </span>
        {!loading && comments.length > 0 && (
          <span className="text-[11px] font-semibold text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-full">
            {comments.length}
          </span>
        )}
      </div>

      {/* Input */}
      {isAuthenticated ? (
        <form onSubmit={handleSubmit} className="flex gap-2.5 mb-5">
          {/* Avatar propio */}
          <div className="shrink-0 mt-0.5">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.username}
                className="w-7 h-7 rounded-full object-cover"
              />
            ) : (
              <div
                className={`w-7 h-7 rounded-full bg-gradient-to-br flex items-center justify-center text-white text-[10px] font-bold ${
                  COMMENT_AVATAR_GRADIENTS[profile?.avatar_color ?? "violet"] ??
                  COMMENT_AVATAR_GRADIENTS.violet
                }`}
              >
                {profile?.username?.slice(0, 1).toUpperCase() ?? "?"}
              </div>
            )}
          </div>

          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Escribe un comentario... (Enter para enviar)"
              maxLength={MAX}
              rows={1}
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 pr-10 text-[13px] text-gray-900 dark:text-gray-100 placeholder:text-gray-400 resize-none focus:outline-none focus:border-gray-400 dark:focus:border-gray-500 transition-colors leading-relaxed"
              style={{ minHeight: 38 }}
            />
            {/* Char counter */}
            {text.length > 200 && (
              <span
                className={`absolute right-3 bottom-2 text-[10px] font-semibold tabular-nums ${
                  text.length > MAX - 20 ? "text-rose-500" : "text-gray-400"
                }`}
               
              >
                {MAX - text.length}
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={!text.trim() || text.length > MAX || posting}
            className="shrink-0 mt-0.5 w-8 h-8 flex items-center justify-center rounded-full bg-gray-900 dark:bg-white hover:bg-gray-700 dark:hover:bg-gray-200 text-white dark:text-gray-900 disabled:opacity-40 transition-colors"
          >
            <Send size={13} />
          </button>
        </form>
      ) : (
        <div className="mb-5 px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-center">
          <p className="text-[12.5px] text-gray-500 dark:text-gray-400">
            <button
              onClick={() => {
                // dispara AuthModal — el padre lo maneja
                document.dispatchEvent(new CustomEvent("lucebase:open-auth"));
              }}
              className="font-semibold text-blue-600 hover:underline"
            >
              Inicia sesión
            </button>{" "}
            para comentar
          </p>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-2.5 animate-pulse">
              <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 shrink-0" />
              <div className="flex-1 space-y-1.5 pt-1">
                <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full w-24" />
                <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full w-full" />
                <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-10">
          <MessageCircle size={28} className="text-gray-200 dark:text-gray-700 mx-auto mb-2" />
          <p className="text-[12.5px] text-gray-400">Sé el primero en comentar</p>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((c) => {
            const isOwn = c.user_id === user?.id;
            const gradient =
              COMMENT_AVATAR_GRADIENTS[c.profiles?.avatar_color ?? "violet"] ??
              COMMENT_AVATAR_GRADIENTS.violet;
            const initials = c.profiles?.username?.slice(0, 1).toUpperCase() ?? "?";

            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-2.5 group"
              >
                {/* Avatar */}
                <div className="shrink-0 mt-0.5">
                  {c.profiles?.avatar_url ? (
                    <img
                      src={c.profiles.avatar_url}
                      alt={c.profiles.username}
                      className="w-7 h-7 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className={`w-7 h-7 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-[10px] font-bold`}
                    >
                      {initials}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-[12px] font-semibold text-gray-900 dark:text-gray-100">
                      {c.profiles?.username ?? "Usuario"}
                    </span>
                    <span
                      className="text-[10px] text-gray-400"
                     
                    >
                      {timeAgo(c.created_at)}
                    </span>
                  </div>
                  <p className="text-[12.5px] text-gray-700 dark:text-gray-300 leading-relaxed mt-0.5 break-words">
                    {c.content}
                  </p>
                </div>

                {/* Delete (propio) */}
                {isOwn && (
                  <button
                    onClick={() => deleteComment(c.id)}
                    className="shrink-0 mt-1 p-1 text-gray-300 dark:text-gray-600 hover:text-rose-500 dark:hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all rounded"
                    title="Eliminar"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Botón Sí/No (mismo estilo que MarketCard) ───────────────────────────────

function SidePillBtn({
  isYes, selected, disabled, onClick, label, pct,
}: { isYes: boolean; selected: boolean; disabled: boolean; onClick: () => void; label: string; pct: number }) {
  const [hover, setHover] = useState(false);
  const solid = selected || hover;
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => !disabled && setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flex: 1, height: 46, borderRadius: 12, border: 0,
        fontWeight: 700, fontSize: 15, cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.6 : 1,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        fontFamily: "inherit", position: "relative", overflow: "hidden",
        transition: "background .15s, box-shadow .15s, transform .12s",
        background: solid ? (isYes ? "#10B981" : "#F43F5E") : (isYes ? "#ECFDF5" : "#FFF1F2"),
        color: solid ? "#fff" : (isYes ? "#047857" : "#BE123C"),
        boxShadow: solid
          ? `0 1px 0 rgba(255,255,255,.25) inset, 0 8px 18px -6px ${isYes ? "rgba(16,185,129,.55)" : "rgba(244,63,94,.55)"}, 0 2px 4px rgba(15,23,42,.08)`
          : "none",
        transform: hover && !disabled ? "translateY(-1px)" : "translateY(0)",
      }}
    >
      {solid && (
        <span style={{
          position: "absolute", inset: 0, borderRadius: "inherit", pointerEvents: "none",
          background: "linear-gradient(180deg,rgba(255,255,255,.22) 0%,transparent 45%)",
        }} />
      )}
      <span style={{ position: "relative", zIndex: 1 }}>{label}</span>
      <span style={{ position: "relative", zIndex: 1, fontSize: 13, fontWeight: 600, opacity: solid ? 0.85 : 1 }}>{pct}%</span>
    </button>
  );
}

// ─── Panel de apuesta ────────────────────────────────────────────────────────

interface BetPanelProps {
  market: {
    id: string;
    market_type: "binary" | "multiple" | "scalar";
    yes_odds: number;
    no_odds: number;
    yes_percent: number;
    status: "open" | "closed";
    market_options?: MarketOption[];
    scalar_min?: number | null;
    scalar_max?: number | null;
    scalar_unit?: string | null;
  };
  initialSide?: "yes" | "no";
  initialOptionId?: string;
  onAuthRequired: () => void;
}

// ── Inline scalar slider para BetPanel ──────────────────────────────────────

function ScalarRangeSlider({
  min, max, low, high,
  onChange,
}: {
  min: number; max: number; low: number; high: number;
  onChange: (l: number, h: number) => void;
}) {
  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  return (
    <div className="py-3">
      <div className="relative h-2 rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          className="absolute h-full rounded-full bg-blue-500"
          style={{ left: `${pct(low)}%`, width: `${pct(high) - pct(low)}%` }}
        />
        <input type="range" min={min} max={max} value={low}
          onChange={(e) => onChange(Math.min(parseInt(e.target.value), high - 1), high)}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-full" style={{ zIndex: low > (min + max) / 2 ? 5 : 4 }}
        />
        <input type="range" min={min} max={max} value={high}
          onChange={(e) => onChange(low, Math.max(parseInt(e.target.value), low + 1))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-full" style={{ zIndex: high < (min + max) / 2 ? 5 : 4 }}
        />
        <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-blue-500 shadow pointer-events-none"
          style={{ left: `calc(${pct(low)}% - 8px)`, zIndex: 6 }} />
        <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-blue-500 shadow pointer-events-none"
          style={{ left: `calc(${pct(high)}% - 8px)`, zIndex: 6 }} />
      </div>
    </div>
  );
}

function BetPanel({ market, initialSide, initialOptionId, onAuthRequired }: BetPanelProps) {
  const isClosed   = market.status === "closed";
  const isMultiple = market.market_type === "multiple";
  const isScalar   = market.market_type === "scalar";

  const scalarMin  = market.scalar_min  ?? 0;
  const scalarMax  = market.scalar_max  ?? 100;
  const scalarUnit = market.scalar_unit ?? "";

  const [side, setSide] = useState<"yes" | "no">(initialSide ?? "yes");
  const [selectedOption, setSelectedOption] = useState<MarketOption | null>(
    () => market.market_options?.find((o) => o.id === initialOptionId) ?? null
  );
  const [amount, setAmount]     = useState("");
  const [scalarLow, setScalarLow]   = useState(() => Math.round(scalarMin + (scalarMax - scalarMin) * 0.35));
  const [scalarHigh, setScalarHigh] = useState(() => Math.round(scalarMin + (scalarMax - scalarMin) * 0.65));
  const [scalarLoading, setScalarLoading] = useState(false);

  const { balance, isAuthenticated } = useAuth();
  const { placeBet, loading } = useBet();

  useEffect(() => { if (initialSide && !isMultiple && !isScalar) setSide(initialSide); }, [initialSide, isMultiple, isScalar]);
  useEffect(() => {
    if (initialOptionId && isMultiple) {
      setSelectedOption(market.market_options?.find((o) => o.id === initialOptionId) ?? null);
    }
  }, [initialOptionId, isMultiple, market.market_options]);

  const noP    = 100 - market.yes_percent;
  const scalarOdds = 2.0;
  const odds   = isScalar ? scalarOdds : isMultiple
    ? (selectedOption?.odds ?? 2)
    : (side === "yes" ? market.yes_odds : market.no_odds);
  const num    = parseFloat(amount) || 0;
  const rawPayout = num * odds;
  const fee       = rawPayout * 0.03;
  const payout    = rawPayout - fee;
  const isValid   = num >= 10 && num <= balance && (isMultiple ? !!selectedOption : true);

  const addAmt = (v: number | "max") =>
    setAmount(v === "max" ? String(Math.floor(balance)) : String(Math.min(num + v, balance)));

  const handleBet = async () => {
    if (!isAuthenticated) { onAuthRequired(); return; }
    if (!isValid) return;

    if (isScalar) {
      if (scalarLow >= scalarHigh) { toast.error("Rango inválido"); return; }
      setScalarLoading(true);
      try {
        const { error } = await supabase.rpc("place_scalar_bet", {
          p_market_id: market.id,
          p_amount:    num,
          p_odds:      scalarOdds,
          p_low:       scalarLow,
          p_high:      scalarHigh,
        });
        if (error) throw error;
        toast.success(`¡Posición tomada! ${scalarLow}–${scalarHigh} ${scalarUnit} · $${num.toFixed(2)} MXN`);
        setAmount("");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al confirmar posición");
      } finally {
        setScalarLoading(false);
      }
      return;
    }

    try {
      if (isMultiple && selectedOption) {
        await placeBet(market.id, num, null, odds, selectedOption.id);
        toast.success(`¡Posición tomada! ${selectedOption.label} · $${num.toFixed(2)} MXN`);
      } else {
        await placeBet(market.id, num, side, odds);
        toast.success(`¡Posición tomada! ${side === "yes" ? "SÍ" : "NO"} · $${num.toFixed(2)} MXN`);
      }
      setAmount("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al confirmar posición");
    }
  };

  const isProcessing = loading || scalarLoading;

  return (
    <div className="bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">

      {/* Tabs row */}
      <div className="flex border-b border-gray-100 dark:border-gray-800 text-[13px] font-semibold">
        <div className="flex-1 py-3 text-center border-b-2 border-gray-900 dark:border-gray-100 text-gray-900 dark:text-gray-100 bg-white dark:bg-transparent cursor-default">
          Comprar
        </div>
        <button disabled className="flex-1 py-3 text-center text-gray-400 bg-gray-50 dark:bg-white/[0.02] cursor-not-allowed border-b-2 border-transparent">
          Vender
        </button>
      </div>

      <div className="p-4 flex flex-col gap-4">

        {/* ── Selector: scalar / binario / múltiple ── */}
        {isScalar ? (
          /* ── SCALAR: doble slider ── */
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">📊 Tu predicción</span>
              <span className="text-[12px] font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                {scalarLow} – {scalarHigh} {scalarUnit}
              </span>
            </div>
            <ScalarRangeSlider
              min={scalarMin} max={scalarMax}
              low={scalarLow} high={scalarHigh}
              onChange={(l, h) => { setScalarLow(l); setScalarHigh(h); }}
            />
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[10px] text-gray-400 font-medium">Desde</label>
                <input type="number" value={scalarLow} min={scalarMin} max={scalarHigh - 1}
                  onChange={(e) => { const v = parseInt(e.target.value); if (!isNaN(v)) setScalarLow(Math.min(v, scalarHigh - 1)); }}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-sm font-bold text-gray-800 dark:text-gray-100 text-center focus:outline-none focus:ring-2 focus:ring-blue-400/30 bg-white dark:bg-white/[0.03]"
                />
              </div>
              <div className="flex items-end pb-1.5 text-gray-300 font-bold">–</div>
              <div className="flex-1">
                <label className="text-[10px] text-gray-400 font-medium">Hasta</label>
                <input type="number" value={scalarHigh} min={scalarLow + 1} max={scalarMax}
                  onChange={(e) => { const v = parseInt(e.target.value); if (!isNaN(v)) setScalarHigh(Math.max(v, scalarLow + 1)); }}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-sm font-bold text-gray-800 dark:text-gray-100 text-center focus:outline-none focus:ring-2 focus:ring-blue-400/30 bg-white dark:bg-white/[0.03]"
                />
              </div>
            </div>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2 text-center">
              Cuota fija 2x · fee 3%
            </p>
          </div>
        ) : isMultiple ? (
          selectedOption ? (
            /* Opción ya seleccionada — mostrar chip compacto con opción de cambiar */
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-blue-600 border border-blue-600">
              <span className="flex-1 text-[13px] font-bold text-white truncate">{selectedOption.label}</span>
              <span className="shrink-0 text-[12px] font-bold text-white/80 tabular-nums">
                {selectedOption.percent.toFixed(0)}% · {selectedOption.odds.toFixed(2)}x
              </span>
              <button
                onClick={() => setSelectedOption(null)}
                className="shrink-0 text-white/70 hover:text-white text-[11px] font-bold px-1.5 py-0.5 rounded hover:bg-blue-700 transition-colors"
              >
                ✕
              </button>
            </div>
          ) : (
            /* Sin opción seleccionada — instrucción */
            <div className="flex items-center justify-center gap-2 px-3 py-4 rounded-lg border-2 border-dashed border-blue-200 dark:border-blue-900/60 text-[12px] text-blue-400 dark:text-blue-500 font-semibold">
              ← Elige una opción de la lista
            </div>
          )
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            {(["yes", "no"] as const).map((s) => {
              const isYes     = s === "yes";
              const selected  = side === s;
              const pctLabel  = isYes ? market.yes_percent : noP;
              return (
                <SidePillBtn
                  key={s}
                  isYes={isYes}
                  selected={selected}
                  disabled={isClosed}
                  onClick={() => setSide(s)}
                  label={isYes ? "Sí" : "No"}
                  pct={pctLabel}
                />
              );
            })}
          </div>
        )}

        {/* Importe */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Importe</span>
            <span className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500">
              <Wallet size={11} />
              ${balance.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold select-none">$</span>
            <input
              type="number"
              min="10"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl pl-8 pr-4 py-3 text-gray-900 dark:text-gray-100 font-bold text-xl bg-gray-50 dark:bg-white/[0.03] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all placeholder:text-gray-300 dark:placeholder:text-gray-700"
             
            />
          </div>
        </div>

        {/* Quick amounts */}
        <div className="flex gap-1.5">
          {[50, 100, 200, 500].map((v) => (
            <button
              key={v}
              onClick={() => addAmt(v)}
              className="flex-1 py-1.5 text-[11px] font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-95 rounded-lg transition-all"
            >
              +${v}
            </button>
          ))}
          <button
            onClick={() => addAmt("max")}
            className="flex-1 py-1.5 text-[11px] font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-95 rounded-lg transition-all"
          >
            Máx.
          </button>
        </div>

        {/* Pago potencial */}
        <AnimatePresence>
          {num > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 2px" }}>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#6B7280", display: "flex", alignItems: "center", gap: 5 }}>
                    Para ganar
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10B981", display: "inline-block" }} />
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: "#9CA3AF" }}>
                    Cuota {odds.toFixed(2)}x · comisión 3%
                  </p>
                </div>
                <p style={{
                  margin: 0, fontSize: 30, fontWeight: 900,
                  color: "#059669", fontVariantNumeric: "tabular-nums",
                  letterSpacing: "-.02em", lineHeight: 1,
                }}>
                  ${payout.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* CTA */}
        <button
          disabled={isClosed || isProcessing || (isAuthenticated && !isValid && num > 0)}
          onClick={isAuthenticated ? handleBet : onAuthRequired}
          className={[
            "w-full py-3.5 rounded-xl text-[13px] font-bold transition-all active:scale-[0.98]",
            isClosed
              ? "bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
              : isProcessing
              ? "bg-blue-400 text-white cursor-wait"
              : isAuthenticated && !isValid && num > 0
              ? "bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
              : "bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 text-white dark:text-gray-900",
          ].join(" ")}
        >
          {isClosed              ? "Mercado cerrado"
            : isProcessing       ? "Procesando..."
            : !isAuthenticated   ? "Iniciar sesión para participar"
            : isMultiple && !selectedOption ? "Elige una opción"
            : "Confirmar"}
        </button>

        <p className="text-[10px] text-gray-400 dark:text-gray-600 text-center -mt-1">
          Al operar aceptas las condiciones de uso.
        </p>
      </div>
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function MarketPageSkeleton() {
  return (
    <div className="max-w-[1100px] mx-auto px-4 py-6 animate-pulse">
      <div className="h-4 w-20 bg-gray-200 dark:bg-gray-800 rounded mb-6" />
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 space-y-4">
          <div className="flex gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gray-200 dark:bg-gray-800 shrink-0" />
            <div className="flex-1 space-y-3 pt-1">
              <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/4" />
              <div className="h-5 bg-gray-200 dark:bg-gray-800 rounded w-full" />
              <div className="h-5 bg-gray-200 dark:bg-gray-800 rounded w-3/4" />
            </div>
          </div>
          <div className="h-px bg-gray-100 dark:bg-gray-800" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-20 bg-gray-100 dark:bg-gray-800 rounded-xl" />
            <div className="h-20 bg-gray-100 dark:bg-gray-800 rounded-xl" />
          </div>
        </div>
        <div className="lg:w-72 xl:w-80 shrink-0">
          <div className="h-80 bg-gray-100 dark:bg-gray-800 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ────────────────────────────────────────────────────────

export default function MarketPage() {
  const { id }  = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [authOpen, setAuthOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  // Permite que MarketComments abra el modal de auth vía evento custom
  useEffect(() => {
    const handler = () => setAuthOpen(true);
    document.addEventListener("lucebase:open-auth", handler);
    return () => document.removeEventListener("lucebase:open-auth", handler);
  }, []);

  const initialSide     = searchParams.get("side") as "yes" | "no" | null;
  const initialOptionId = searchParams.get("option") ?? undefined;
  const { market, loading, error } = useMarket(id);
  const { history: priceHistory, loading: priceLoading } = usePriceHistory(id);
  const { markets: allMarkets } = useMarkets();

  // Para mercados múltiples: opción activa seleccionada desde las filas de la izquierda
  const [activeOptionId, setActiveOptionId] = useState<string | undefined>(initialOptionId);
  const betPanelRef = useRef<HTMLDivElement>(null);

  const handleSelectOption = (optionId: string) => {
    setActiveOptionId(optionId);
    betPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  if (loading) return <MarketPageSkeleton />;

  if (error || !market) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <AlertCircle size={48} className="text-red-400 opacity-60" />
        <h2 className="font-bold text-xl text-gray-800 dark:text-gray-200">
          Mercado no encontrado
        </h2>
        <Link to="/" className="text-blue-600 hover:underline text-sm">← Volver a mercados</Link>
      </div>
    );
  }

  const yesP     = market.yes_percent ?? 50;
  const noP      = 100 - yesP;
  const isClosed = market.status === "closed";
  const ic       = iconColor(market.subject_name);
  const yesPrice = (yesP / 100).toFixed(2);
  const noPrice  = (noP  / 100).toFixed(2);

  const handleShare = () => setShareOpen(true);

  return (
    <>
      <SEOHead
        title={market.title}
        description={`¿${market.title}? Predice el resultado en Lucebase. Sí: ${yesP}% · No: ${noP}%. Apuesta con pesos mexicanos.`}
        url={`/market/${id}`}
      />
      <div className="max-w-[1100px] mx-auto px-4 py-4 md:py-6">

        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-[13px] text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors mb-6 group"
        >
          <ArrowLeft size={15} className="transition-transform group-hover:-translate-x-0.5" />
          Mercados
        </button>

        <div className="flex flex-col lg:flex-row gap-6 items-start">

          {/* ═══ Columna izquierda ═══ */}
          <div className="flex-1 min-w-0">

            {/* Resultado banner */}
            {isClosed && (market.result || market.winning_option_id || market.scalar_result != null) && (
              <ResultBanner
                result={market.result}
                winningOption={market.market_options?.find((o) => o.id === market.winning_option_id)}
                scalarResult={market.scalar_result}
                scalarUnit={market.scalar_unit}
              />
            )}

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {market.category && (
                <Link
                  to={`/?cat=${encodeURIComponent(market.category)}`}
                  className="text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-widest hover:text-gray-900 transition-colors"
                >
                  {market.category}
                </Link>
              )}
              {market.closes_at && (
                <>
                  <span className="text-gray-300 dark:text-gray-700">·</span>
                  <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300">
                    Cierra {formatDate(market.closes_at)}
                  </span>
                </>
              )}
              {market.is_trending && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full border border-amber-200/70 dark:border-amber-800/50">
                  <TrendingUp size={9} /> Tendencia
                </span>
              )}
              {isClosed && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full border border-red-200/70 dark:border-red-800/50">
                  <Lock size={9} /> Cerrado
                </span>
              )}
            </div>

            {/* Icon + title + share */}
            <div className="flex items-start gap-4 mb-6">
              <div
                className="w-14 h-14 rounded-2xl shrink-0 overflow-hidden flex items-center justify-center text-base font-bold"
                style={market.subject_photo_url ? undefined : { backgroundColor: ic.bg, color: ic.fg }}
              >
                {market.subject_photo_url ? (
                  <img
                    src={market.subject_photo_url}
                    alt={market.subject_name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const t = e.currentTarget;
                      t.style.display = "none";
                      const parent = t.parentElement!;
                      parent.style.backgroundColor = ic.bg;
                      parent.style.color = ic.fg;
                      parent.textContent = getInitials(market.subject_name);
                    }}
                  />
                ) : getInitials(market.subject_name)}
              </div>
              <div className="flex-1 min-w-0">
                <h1
                  className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100 leading-snug"
                  style={{ letterSpacing: "-0.015em" }}
                >
                  {market.title}
                </h1>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mt-1">{market.subject_name}</p>
              </div>
              <button
                onClick={handleShare}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0"
              >
                <Share2 size={16} />
              </button>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-5 mb-5 text-sm">
              <span className="font-bold text-gray-900 dark:text-gray-100">
                {formatVol(market.total_pool)}{" "}
                <span className="text-gray-600 dark:text-gray-400 font-semibold text-xs">Vol. MXN</span>
              </span>
              {market.bettor_count > 0 && (
                <span className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300 font-semibold">
                  <Users size={13} />
                  <span>
                    {market.bettor_count.toLocaleString("es-MX")}
                  </span>
                  <span className="text-gray-600 dark:text-gray-400 font-semibold text-xs">participantes</span>
                </span>
              )}
            </div>

            <div className="h-px bg-gray-100 dark:border-gray-800 mb-5" />

            {/* Opciones del mercado: scalar / múltiple / binario */}
            {market.market_type === "scalar" ? (
              /* ── SCALAR: info visual del rango ── */
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">📊 Mercado Scalar</span>
                </div>
                {/* Rango del mercado */}
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/60 dark:bg-blue-950/20 mb-2">
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Rango válido</p>
                    <p className="text-lg font-black text-blue-700 dark:text-blue-400 tabular-nums">
                      {market.scalar_min ?? 0} – {market.scalar_max ?? 100}
                      <span className="text-sm font-semibold ml-1.5 text-blue-500">{market.scalar_unit}</span>
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Cuota fija</p>
                    <p className="text-lg font-black text-gray-800 dark:text-gray-200 tabular-nums">2x</p>
                  </div>
                </div>
                {/* Barra visual de rango */}
                <div className="relative h-3 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                  <div className="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-blue-300 via-blue-500 to-blue-300 dark:from-blue-800 dark:via-blue-600 dark:to-blue-800 opacity-60 rounded-full" />
                  {market.scalar_result != null && market.scalar_min != null && market.scalar_max != null && (
                    <div
                      className="absolute top-0 h-full w-1 bg-emerald-500 rounded-full shadow"
                      style={{
                        left: `${((market.scalar_result - market.scalar_min) / (market.scalar_max - market.scalar_min)) * 100}%`,
                      }}
                    />
                  )}
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-gray-400 tabular-nums">{market.scalar_min ?? 0}</span>
                  {market.scalar_result != null && (
                    <span className="text-[10px] font-bold text-emerald-600 tabular-nums">
                      ✓ {market.scalar_result} {market.scalar_unit}
                    </span>
                  )}
                  <span className="text-[10px] text-gray-400 tabular-nums">{market.scalar_max ?? 100}</span>
                </div>
              </div>
            ) : market.market_type === "multiple" && market.market_options && market.market_options.length > 0 ? (
              /* ── MÚLTIPLE OPCIÓN ── estilo Polymarket */
              <div className="flex flex-col gap-[3px] mb-4">
                {market.market_options.map((opt) => {
                  const isWinner  = market.winning_option_id === opt.id;
                  const isActive  = activeOptionId === opt.id;
                  const pct = opt.percent ?? 0;
                  return (
                    <div
                      key={opt.id}
                      className={[
                        "relative overflow-hidden rounded-xl transition-all duration-200",
                        isActive ? "ring-2 ring-blue-500/60 dark:ring-blue-400/50" : "",
                      ].join(" ")}
                      style={{ minHeight: 52 }}
                    >
                      {/* Barra de probabilidad de fondo */}
                      <div
                        className={[
                          "absolute inset-y-0 left-0 transition-all duration-700 ease-out",
                          isWinner ? "bg-emerald-100/80 dark:bg-emerald-900/30"
                          : isActive ? "bg-blue-100/60 dark:bg-blue-950/30"
                          : "bg-slate-50 dark:bg-white/[0.02]",
                        ].join(" ")}
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      />
                      <div className="relative flex items-center gap-3 px-4 py-3">
                        {/* Avatar opción */}
                        <div className="w-8 h-8 rounded-full shrink-0 overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-[11px] font-bold text-gray-400 border border-gray-200 dark:border-gray-700">
                          {opt.photo_url ? (
                            <img src={opt.photo_url} alt={opt.label} className="w-full h-full object-cover"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                            />
                          ) : opt.label.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
                        </div>
                        {/* Nombre */}
                        <span
                          className="flex-1 text-[14px] font-semibold text-slate-800 dark:text-gray-200 truncate"
                         
                        >
                          {isWinner && <Trophy size={12} className="inline mr-1.5 text-emerald-600" strokeWidth={2.5} />}
                          {opt.label}
                        </span>
                        {/* Porcentaje */}
                        <span
                          className={[
                            "shrink-0 text-[15px] font-bold tabular-nums",
                            isWinner ? "text-emerald-600 dark:text-emerald-400"
                            : isActive ? "text-blue-600 dark:text-blue-400"
                            : "text-slate-600 dark:text-gray-300",
                          ].join(" ")}
                         
                        >
                          {pct.toFixed(0)}%
                        </span>
                        {/* Cuota */}
                        <span
                          className="shrink-0 text-[12px] text-gray-400 tabular-nums"
                         
                        >
                          {opt.odds.toFixed(2)}x
                        </span>
                        {/* Botón Comprar */}
                        {!isClosed && (
                          <motion.button
                            onClick={() => handleSelectOption(opt.id)}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className={[
                              "shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors",
                              isActive
                                ? "bg-blue-600 text-white"
                                : "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 border border-blue-200/60 dark:border-blue-800/40",
                            ].join(" ")}
                          >
                            {isActive ? "✓ Elegida" : "Comprar"}
                          </motion.button>
                        )}
                        {isWinner && (
                          <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60">
                            Ganó
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : market.market_type === "multiple" ? (
              /* múltiple pero sin opciones cargadas */
              <div className="flex items-center justify-center h-20 text-[13px] text-gray-400 mb-4">
                Sin opciones — aplica el fix de SQL en Supabase
              </div>
            ) : (
              /* ── BINARIO ── */
              <>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {([
                    { side: "yes" as const, label: "Sí", pct: yesP, price: yesPrice, color: "emerald" },
                    { side: "no"  as const, label: "No", pct: noP,  price: noPrice,  color: "rose" },
                  ]).map(({ side, label, pct, price, color }) => {
                    const isWinner = market.result === side;
                    return (
                      <div
                        key={side}
                        className={[
                          "relative flex flex-col gap-1 px-4 py-3.5 rounded-xl border",
                          color === "emerald"
                            ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/50 dark:border-emerald-900/40"
                            : "bg-rose-50/60 dark:bg-rose-950/20 border-rose-200/50 dark:border-rose-900/40",
                          isClosed && market.result && !isWinner && "opacity-40",
                        ].join(" ")}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-bold uppercase tracking-widest ${color === "emerald" ? "text-emerald-600 dark:text-emerald-500" : "text-rose-600 dark:text-rose-500"}`}>
                            {label}
                          </span>
                          {isWinner && (
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                              color === "emerald"
                                ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400"
                                : "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400"
                            }`}>
                              GANADOR
                            </span>
                          )}
                        </div>
                        <span
                          className={`text-3xl font-bold leading-none ${color === "emerald" ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}
                         
                        >
                          {pct}%
                        </span>
                        <span
                          className={`text-[12px] ${color === "emerald" ? "text-emerald-600/70 dark:text-emerald-400/70" : "text-rose-600/70 dark:text-rose-400/70"}`}
                         
                        >
                          ${price} MXN
                        </span>
                      </div>
                    );
                  })}
                </div>
                {/* Bicolor bar */}
                <div className="flex h-1 rounded-full overflow-hidden bg-rose-200/40 dark:bg-rose-900/20">
                  <div
                    className="h-full bg-emerald-400 dark:bg-emerald-500 transition-all duration-700 ease-out"
                    style={{ width: `${yesP}%` }}
                  />
                </div>
              </>
            )}

            {/* BetPanel en móvil — justo después de las opciones */}
            <div className="mt-4 lg:hidden" ref={betPanelRef}>
              <BetPanel
                market={market}
                initialSide={initialSide ?? undefined}
                initialOptionId={activeOptionId}
                onAuthRequired={() => setAuthOpen(true)}
              />
            </div>

            {/* Contexto y Normas */}
            {(market.description || market.rules) && (
              <div className="mt-6 flex flex-col gap-3">
                {market.description && (
                  <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-white/[0.02] px-4 py-3.5">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Contexto</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{market.description}</p>
                  </div>
                )}
                {market.rules && (
                  <div className="rounded-xl border border-amber-100 dark:border-amber-900/30 bg-amber-50/60 dark:bg-amber-950/10 px-4 py-3.5">
                    <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-1.5">Normas de resolución</p>
                    <p className="text-sm text-amber-700 dark:text-amber-400 leading-relaxed">{market.rules}</p>
                  </div>
                )}
              </div>
            )}

            {/* Gráfica de probabilidad histórica — solo para mercados binarios */}
            {market.market_type !== "multiple" && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                      Probabilidad · Sí
                    </span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 dark:bg-emerald-500 shrink-0" />
                  </div>
                  <span className="text-[11px] text-gray-400 dark:text-gray-500">
                    {priceHistory.length > 1 ? `${priceHistory.length} puntos` : "tiempo real"}
                  </span>
                </div>
                <PriceChart
                  history={priceHistory}
                  loading={priceLoading}
                  currentPct={yesP}
                />
              </div>
            )}

            {/* Mi posición */}
            <UserPosition marketId={market.id} result={market.result} />

            {/* Actividad reciente */}
            <MarketActivity marketId={market.id} />

            {/* Comentarios */}
            <MarketComments marketId={market.id} />

            {/* ── Mercados relacionados ── */}
            {(() => {
              const related = allMarkets
                .filter((m) =>
                  m.id !== market.id &&
                  (m.subject_name === market.subject_name || m.category === market.category)
                )
                .slice(0, 4);
              if (related.length === 0) return null;
              return (
                <div className="mt-6">
                  <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">
                    También te puede interesar
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {related.map((m, i) => (
                      <MarketCard key={m.id} market={m} index={i} />
                    ))}
                  </div>
                </div>
              );
            })()}


          </div>

          {/* ═══ Columna derecha: BetPanel sticky ═══ */}
          <div className="hidden lg:block lg:w-72 xl:w-80 shrink-0 sticky top-24 self-start" ref={betPanelRef}>
            <BetPanel
              market={market}
              initialSide={initialSide ?? undefined}
              initialOptionId={activeOptionId}
              onAuthRequired={() => setAuthOpen(true)}
            />
          </div>

        </div>
      </div>

      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title={market.title}
        yesPercent={yesP}
        marketId={id!}
        slug={market.slug}
      />
    </>
  );
}
