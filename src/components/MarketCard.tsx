import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Market } from "@/lib/supabase";
import { Users, TrendingUp, Lock, Clock, Share2, Check, Bookmark } from "lucide-react";
import { toast } from "sonner";
import type { UserMarketPosition } from "@/hooks/use-user-positions";

interface MarketCardProps {
  market:        Market;
  index?:        number;
  userPosition?: UserMarketPosition | null;
  isSaved?:      boolean;
  onToggleSave?: (id: string, e: React.MouseEvent) => void;
}

// ─── helpers ────────────────────────────────────────────────────────────────

function formatVol(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n || 0}`;
}

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

// ─── Colores por categoría ───────────────────────────────────────────────────

const CAT_STYLES: Record<string, { bar: string; pill: string; dot: string }> = {
  "Política":        { bar: "bg-blue-500",    dot: "bg-blue-500",    pill: "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200/80 dark:border-blue-700/50"   },
  "Deportes":        { bar: "bg-emerald-500", dot: "bg-emerald-500", pill: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-700/50" },
  "Entretenimiento": { bar: "bg-violet-500",  dot: "bg-violet-500",  pill: "bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border-violet-200/80 dark:border-violet-700/50"   },
  "Finanzas":        { bar: "bg-amber-500",   dot: "bg-amber-500",   pill: "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-700/50"     },
  "Tech":            { bar: "bg-cyan-500",    dot: "bg-cyan-500",    pill: "bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 border-cyan-200/80 dark:border-cyan-700/50"       },
  "Música":          { bar: "bg-rose-500",    dot: "bg-rose-500",    pill: "bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border-rose-200/80 dark:border-rose-700/50"       },
  "Negocios":        { bar: "bg-indigo-500",  dot: "bg-indigo-500",  pill: "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-700/50"   },
  "Elecciones":      { bar: "bg-red-500",     dot: "bg-red-500",     pill: "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200/80 dark:border-red-700/50"           },
  "Redes":           { bar: "bg-sky-500",     dot: "bg-sky-500",     pill: "bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 border-sky-200/80 dark:border-sky-700/50"           },
  "Cultura":         { bar: "bg-orange-500",  dot: "bg-orange-500",  pill: "bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-200/80 dark:border-orange-700/50"   },
};
const CAT_DEFAULT = {
  bar:  "bg-gray-400 dark:bg-gray-600",
  dot:  "bg-gray-400",
  pill: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700",
};

const PALETTE = [
  { bg: "#0f172a", fg: "#f8fafc" },
  { bg: "#1e3a5f", fg: "#e0f2fe" },
  { bg: "#14532d", fg: "#dcfce7" },
  { bg: "#3b0764", fg: "#f3e8ff" },
  { bg: "#431407", fg: "#fef3c7" },
  { bg: "#172554", fg: "#dbeafe" },
  { bg: "#134e4a", fg: "#ccfbf1" },
  { bg: "#4a1942", fg: "#fdf4ff" },
];

function iconColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}

// ─── Countdown inline ────────────────────────────────────────────────────────

interface TimeLeft {
  display: string;
  urgency: "normal" | "warning" | "critical";
}

function useCountdown(closesAt: string | null | undefined): TimeLeft | null {
  const calc = (): TimeLeft | null => {
    if (!closesAt) return null;
    const ms = new Date(closesAt).getTime() - Date.now();
    if (ms <= 0) return null;

    const days    = Math.floor(ms / 86_400_000);
    const hours   = Math.floor((ms % 86_400_000) / 3_600_000);
    const minutes = Math.floor((ms % 3_600_000) / 60_000);
    const seconds = Math.floor((ms % 60_000) / 1_000);

    // Solo mostrar si cierra en ≤ 3 días
    if (days > 3) return null;

    let display: string;
    if (days > 0)       display = `${days}d ${hours}h`;
    else if (hours > 0) display = `${hours}h ${minutes}m`;
    else                display = `${minutes}m ${seconds}s`;

    const urgency: TimeLeft["urgency"] =
      ms < 3_600_000    ? "critical" :   // < 1h
      ms < 86_400_000   ? "warning"  :   // < 24h
      "normal";

    return { display, urgency };
  };

  const [left, setLeft] = useState<TimeLeft | null>(() => calc());

  useEffect(() => {
    const t = setInterval(() => setLeft(calc()), 1_000);
    return () => clearInterval(t);
  }, [closesAt]);

  return left;
}

// ─── Componente principal ────────────────────────────────────────────────────

export const MarketCard = memo(function MarketCard({
  market,
  index = 0,
  userPosition,
  isSaved = false,
  onToggleSave,
}: MarketCardProps) {
  const navigate   = useNavigate();
  const countdown  = useCountdown(market.closes_at);
  const [copied, setCopied] = useState(false);

  const yesP = market.yes_percent ?? 50;
  const noP  = 100 - yesP;
  const isClosed = market.status === "closed";
  const ic = iconColor(market.subject_name);
  const catStyle = CAT_STYLES[market.category ?? ""] ?? CAT_DEFAULT;

  const yesPrice = (yesP / 100).toFixed(2);
  const noPrice  = (noP  / 100).toFixed(2);

  // ── Realtime flash when odds change ──
  const prevYesP = useRef(yesP);
  const [flashYes, setFlashYes] = useState<"up" | "down" | null>(null);
  const [flashNo,  setFlashNo]  = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (prevYesP.current !== yesP) {
      const dir = yesP > prevYesP.current ? "up" : "down";
      setFlashYes(dir);
      setFlashNo(dir === "up" ? "down" : "up");
      const t = setTimeout(() => { setFlashYes(null); setFlashNo(null); }, 600);
      prevYesP.current = yesP;
      return () => clearTimeout(t);
    }
  }, [yesP]);

  const handleOpen = useCallback(() => {
    navigate(`/market/${market.id}`);
  }, [navigate, market.id]);

  const handleBuy = useCallback((e: React.MouseEvent, side: "yes" | "no") => {
    e.stopPropagation();
    navigate(`/market/${market.id}?side=${side}`);
  }, [navigate, market.id]);

  const handleShare = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/market/${market.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      toast.success("Enlace copiado");
      setTimeout(() => setCopied(false), 2000);
    });
  }, [market.id]);

  // Posición del usuario en este lado concreto
  const posYes = userPosition?.side === "yes" ? userPosition : null;
  const posNo  = userPosition?.side === "no"  ? userPosition : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={isClosed ? {} : { y: -5, scale: 1.018, boxShadow: "0 12px 32px rgba(0,0,0,0.10)" }}
      whileTap={isClosed ? {} : { scale: 0.975 }}
      transition={{
        opacity:    { duration: 0.22, delay: Math.min(index * 0.035, 0.35), ease: [0.25, 0.1, 0.25, 1] },
        y:          { type: "spring", stiffness: 380, damping: 28 },
        scale:      { type: "spring", stiffness: 380, damping: 28 },
        boxShadow:  { duration: 0.2 },
      }}
      onClick={handleOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && handleOpen()}
      className={[
        "group relative bg-white dark:bg-[#0d1117] rounded-2xl outline-none select-none overflow-hidden",
        "border border-gray-200/80 dark:border-gray-800/60",
        "flex flex-col h-full",
        "shadow-sm dark:shadow-none",
        "transition-all duration-200 ease-out",
        isClosed
          ? "cursor-pointer opacity-70"
          : "cursor-pointer hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-md dark:hover:shadow-[0_4px_24px_rgba(0,0,0,0.4)]",
      ].join(" ")}
    >
      {/* ── Card body ── */}
      <div className="p-4 flex flex-col flex-1 gap-0">

        {/* Top row */}
        <div className="flex items-center gap-2.5 mb-2.5">

          {/* Avatar */}
          <div
            className="w-9 h-9 rounded-xl shrink-0 overflow-hidden flex items-center justify-center text-[10px] font-bold shadow-sm"
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

          {/* Nombre + categoría */}
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-bold text-gray-900 dark:text-gray-100 truncate leading-none">
              {market.subject_name}
            </p>
            {market.category && (
              <p className="text-[9.5px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5 leading-none">
                {market.category}
              </p>
            )}
          </div>

          {/* Status badges */}
          <div className="shrink-0 flex items-center gap-1.5">
            {market.is_trending && !isClosed && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200/70 dark:border-amber-800/50 px-1.5 py-0.5 rounded-full">
                <TrendingUp size={9} strokeWidth={2.5} />
                Top
              </span>
            )}
            {isClosed && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-full">
                <Lock size={9} strokeWidth={2.5} />
                Cerrado
              </span>
            )}
          </div>
        </div>

        {/* Title — negrita más impactante */}
        <h3
          className="flex-1 text-[14.5px] font-bold text-slate-900 dark:text-gray-100 leading-snug line-clamp-3 mb-3"
          style={{ letterSpacing: "-0.02em" }}
        >
          {market.title}
        </h3>

        {/* ── Opciones: scalar / múltiple / binario ── */}
        {market.market_type === "scalar" ? (
          /* ── SCALAR ── */
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                📊 Mercado Scalar
              </span>
              {market.scalar_result != null && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60">
                  Resultado: {market.scalar_result} {market.scalar_unit}
                </span>
              )}
            </div>
            {/* Barra de rango */}
            <div className="relative h-6 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 overflow-hidden">
              <div className="absolute inset-0 flex items-center px-2 justify-between">
                <span className="text-[10px] font-bold text-blue-400 tabular-nums">
                  {market.scalar_min ?? 0}
                </span>
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                  {market.scalar_unit}
                </span>
                <span className="text-[10px] font-bold text-blue-400 tabular-nums">
                  {market.scalar_max ?? 100}
                </span>
              </div>
            </div>
            {!isClosed && (
              <motion.button
                onClick={(e) => { e.stopPropagation(); navigate(`/market/${market.id}`); }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.95 }}
                className="mt-2 w-full py-1.5 rounded-lg text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors"
               
              >
                Predecir rango
              </motion.button>
            )}
          </div>
        ) : market.market_type === "multiple" && market.market_options && market.market_options.length > 0 ? (
          /* ── MÚLTIPLE OPCIÓN — estilo Polymarket ── */
          <div className="flex flex-col gap-[3px] mb-3">
            {market.market_options.slice(0, 4).map((opt) => {
              const isWinner = market.winning_option_id === opt.id;
              const pct = opt.percent ?? 0;
              const price = (pct / 100).toFixed(2);
              return (
                <div
                  key={opt.id}
                  className="relative overflow-hidden rounded-lg"
                  style={{ minHeight: 36 }}
                >
                  {/* Barra de probabilidad de fondo */}
                  <div
                    className={[
                      "absolute inset-y-0 left-0 transition-all duration-700 ease-out",
                      isWinner
                        ? "bg-emerald-100/70 dark:bg-emerald-900/30"
                        : "bg-blue-50/80 dark:bg-blue-950/20",
                    ].join(" ")}
                    style={{ width: `${Math.max(pct, 3)}%` }}
                  />

                  {/* Fila */}
                  <div className="relative flex items-center gap-2 px-2.5 py-[7px]">
                    {/* Avatar opción */}
                    <div className="w-5 h-5 rounded-full shrink-0 overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[8px] font-bold text-gray-500">
                      {opt.photo_url ? (
                        <img src={opt.photo_url} alt={opt.label} className="w-full h-full object-cover"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : opt.label.split(" ").slice(0, 1).map((w) => w[0]).join("").toUpperCase()}
                    </div>
                    {/* Nombre opción */}
                    <span
                      className="flex-1 text-[11.5px] font-semibold text-slate-800 dark:text-gray-200 truncate leading-tight"
                     
                    >
                      {isWinner && (
                        <Check size={9} className="inline mr-1 text-emerald-600" strokeWidth={3} />
                      )}
                      {opt.label}
                    </span>

                    {/* Porcentaje */}
                    <span
                      className={[
                        "shrink-0 text-[12px] font-bold tabular-nums",
                        isWinner ? "text-emerald-600 dark:text-emerald-400" : "text-slate-600 dark:text-gray-300",
                      ].join(" ")}
                      style={{ minWidth: 36, textAlign: "right" }}
                    >
                      {pct.toFixed(0)}%
                    </span>

                    {/* Botón comprar */}
                    {!isClosed && (
                      <motion.button
                        onClick={(e) => { e.stopPropagation(); navigate(`/market/${market.id}?option=${opt.id}`); }}
                        whileHover={{ scale: 1.06 }}
                        whileTap={{ scale: 0.92 }}
                        transition={{ type: "spring", stiffness: 500, damping: 25 }}
                        className="shrink-0 px-2 py-[3px] rounded-md text-[10px] font-bold bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:hover:bg-emerald-800/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/50 transition-colors"
                       
                      >
                        ${price}
                      </motion.button>
                    )}
                    {isClosed && isWinner && (
                      <span className="shrink-0 px-1.5 py-[2px] rounded-full text-[9px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60">
                        Ganó
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {market.market_options.length > 4 && (
              <p className="text-[10px] text-gray-400 text-center mt-0.5">
                +{market.market_options.length - 4} opciones más
              </p>
            )}
          </div>
        ) : (
          /* ── BINARIO (original) ── */
          <>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {/* YES */}
              <div className="relative">
                <motion.button
                  onClick={(e) => handleBuy(e, "yes")}
                  disabled={isClosed}
                  whileHover={isClosed ? {} : { scale: 1.04 }}
                  whileTap={isClosed ? {} : { scale: 0.93 }}
                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                  style={{ minHeight: 56 }}
                  className={[
                    "w-full flex flex-col items-start gap-1 px-3 py-2.5 rounded-lg border text-left",
                    "bg-emerald-50/80 dark:bg-emerald-950/25 border-emerald-200/60 dark:border-emerald-900/40",
                    "transition-[background-color,border-color] duration-150",
                    !isClosed && "hover:bg-emerald-100/80 dark:hover:bg-emerald-950/50 hover:border-emerald-300/70 dark:hover:border-emerald-800 active:bg-emerald-200/70 dark:active:bg-emerald-900/50",
                    isClosed && "opacity-60 cursor-default",
                    posYes && "ring-1 ring-emerald-400/60 dark:ring-emerald-600/60",
                  ].join(" ")}
                >
                  <span className="text-[9.5px] font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-widest leading-none">
                    Comprar Sí
                  </span>
                  <span
                    className={[
                      "text-[18px] font-bold leading-none text-emerald-700 dark:text-emerald-400",
                      flashYes === "up" ? "flash-up" : flashYes === "down" ? "flash-down" : "",
                    ].join(" ")}
                   
                  >
                    {yesP}%
                  </span>
                  <span className="text-[10.5px] font-semibold text-emerald-600/80 dark:text-emerald-400/80 leading-none">
                    ${yesPrice}
                  </span>
                </motion.button>
                {posYes && (
                  <span className="absolute -top-1.5 -right-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500 text-white shadow-sm z-10">
                    <Check size={8} strokeWidth={3} />
                    Tú
                  </span>
                )}
              </div>

              {/* NO */}
              <div className="relative">
                <motion.button
                  onClick={(e) => handleBuy(e, "no")}
                  disabled={isClosed}
                  whileHover={isClosed ? {} : { scale: 1.04 }}
                  whileTap={isClosed ? {} : { scale: 0.93 }}
                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                  style={{ minHeight: 56 }}
                  className={[
                    "w-full flex flex-col items-start gap-1 px-3 py-2.5 rounded-lg border text-left",
                    "bg-rose-50/80 dark:bg-rose-950/25 border-rose-200/60 dark:border-rose-900/40",
                    "transition-[background-color,border-color] duration-150",
                    !isClosed && "hover:bg-rose-100/80 dark:hover:bg-rose-950/50 hover:border-rose-300/70 dark:hover:border-rose-800 active:bg-rose-200/70 dark:active:bg-rose-900/50",
                    isClosed && "opacity-60 cursor-default",
                    posNo && "ring-1 ring-rose-400/60 dark:ring-rose-600/60",
                  ].join(" ")}
                >
                  <span className="text-[9.5px] font-bold text-rose-600 dark:text-rose-500 uppercase tracking-widest leading-none">
                    Comprar No
                  </span>
                  <span
                    className={[
                      "text-[18px] font-bold leading-none text-rose-700 dark:text-rose-400",
                      flashNo === "up" ? "flash-up" : flashNo === "down" ? "flash-down" : "",
                    ].join(" ")}
                   
                  >
                    {noP}%
                  </span>
                  <span className="text-[10.5px] font-semibold text-rose-600/80 dark:text-rose-400/80 leading-none">
                    ${noPrice}
                  </span>
                </motion.button>
                {posNo && (
                  <span className="absolute -top-1.5 -right-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-rose-500 text-white shadow-sm z-10">
                    <Check size={8} strokeWidth={3} />
                    Tú
                  </span>
                )}
              </div>
            </div>

            {/* Bicolor progress bar */}
            <div className="flex h-[3px] rounded-full overflow-hidden bg-rose-200/50 dark:bg-rose-900/30 mb-3">
              <div
                className="h-full bg-emerald-400 dark:bg-emerald-500 transition-all duration-700 ease-out rounded-l-full"
                style={{ width: `${yesP}%` }}
              />
            </div>
          </>
        )}

        {/* ── Footer stats ── */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-2.5 text-[11px] text-gray-600 dark:text-gray-400 min-w-0">
            <span className="font-bold text-gray-700 dark:text-gray-300">
              {formatVol(market.total_pool)} MXN
            </span>
            {market.bettor_count > 0 && (
              <>
                <span className="text-gray-300 dark:text-gray-700">·</span>
                <span className="flex items-center gap-1 font-semibold text-gray-600 dark:text-gray-400">
                  <Users size={10} strokeWidth={2} />
                  {market.bettor_count.toLocaleString("es-MX")}
                </span>
              </>
            )}
            {countdown && (
              <>
                <span className="text-gray-300 dark:text-gray-700">·</span>
                <span
                  className={[
                    "flex items-center gap-1 font-bold",
                    countdown.urgency === "critical"
                      ? "text-red-500 dark:text-red-400"
                      : countdown.urgency === "warning"
                      ? "text-amber-500 dark:text-amber-400"
                      : "text-gray-700 dark:text-gray-300",
                  ].join(" ")}
                 
                >
                  {countdown.urgency === "critical" && (
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                  )}
                  <Clock size={9} strokeWidth={2} className="shrink-0" />
                  {countdown.display}
                </span>
              </>
            )}
          </div>

          {/* Botones de acción: guardar + compartir */}
          <div className="flex items-center gap-0.5 shrink-0">
            {/* Guardar */}
            {onToggleSave && (
              <motion.button
                onClick={(e) => onToggleSave(market.id, e)}
                whileTap={{ scale: 0.82 }}
                title={isSaved ? "Quitar de guardados" : "Guardar predicción"}
                className={[
                  "p-1 rounded-md transition-all",
                  isSaved
                    ? "text-amber-500 opacity-100"
                    : "opacity-0 group-hover:opacity-100 text-gray-300 dark:text-gray-600 hover:text-amber-500 dark:hover:text-amber-400",
                ].join(" ")}
              >
                <Bookmark
                  size={12}
                  strokeWidth={2}
                  className={isSaved ? "fill-amber-500" : ""}
                />
              </motion.button>
            )}

            {/* Compartir */}
            {!isClosed && (
              <motion.button
                onClick={handleShare}
                whileTap={{ scale: 0.85 }}
                title="Copiar enlace"
                className={[
                  "p-1 rounded-md transition-all",
                  "opacity-0 group-hover:opacity-100",
                  copied
                    ? "text-emerald-500"
                    : "text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400",
                ].join(" ")}
              >
                {copied
                  ? <Check size={12} strokeWidth={2.5} />
                  : <Share2 size={12} strokeWidth={2} />
                }
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
});
