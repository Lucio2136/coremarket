import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Users, Gift, Bookmark, Share2, Wallet, Lock, TrendingUp,
} from "lucide-react";
import { Market } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useBet } from "@/hooks/use-bet";
import { toast } from "sonner";

interface Props {
  market: Market | null;
  onClose: () => void;
  onAuthRequired: () => void;
}

// ─── helpers ────────────────────────────────────────────────────────────────

function formatVol(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n || 0}`;
}

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("es-MX", {
    day: "numeric", month: "short", year: "numeric",
  });
}

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

// ─── componente ─────────────────────────────────────────────────────────────

export function MarketDetailModal({ market, onClose, onAuthRequired }: Props) {
  const [side, setSide] = useState<"yes" | "no">("yes");
  const [amount, setAmount] = useState("");
  const { balance, isAuthenticated } = useAuth();
  const { placeBet, loading } = useBet();

  const handleClose = useCallback(() => onClose(), [onClose]);

  if (!market) return null;

  const yesP = market.yes_percent ?? 50;
  const noP = 100 - yesP;
  const odds = side === "yes" ? market.yes_odds : market.no_odds;
  const num = parseFloat(amount) || 0;
  const payout = num * odds;
  const isValid = num >= 10 && num <= balance;
  const isClosed = market.status === "closed";
  const ic = iconColor(market.subject_name);

  const handleBet = async () => {
    if (!isAuthenticated) { onAuthRequired(); return; }
    if (!isValid) return;
    try {
      await placeBet(market.id, num, side, odds);
      toast.success(
        `¡Posición tomada! ${side === "yes" ? "SÍ" : "NO"} · $${num.toFixed(2)} MXN`
      );
      setAmount("");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al confirmar posición");
    }
  };

  const addAmt = (v: number | "max") =>
    setAmount(
      v === "max"
        ? String(Math.floor(balance))
        : String(Math.min(num + v, balance))
    );

  return (
    <AnimatePresence>
      {market && (
        <motion.div
          key="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.48)", backdropFilter: "blur(6px)" }}
          onClick={handleClose}
        >
          <motion.div
            key="modal"
            initial={{ y: 48, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 48, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl bg-white rounded-t-3xl md:rounded-2xl shadow-[0_32px_80px_rgba(0,0,0,0.22)] overflow-hidden flex flex-col md:flex-row"
            style={{ maxHeight: "90vh" }}
          >
            {/* ══ Panel izquierdo — detalle del mercado ══ */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-6 md:p-8">

                {/* ── Top bar ── */}
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
                    {market.category && <span>{market.category}</span>}
                    {market.category && market.closes_at && <span>·</span>}
                    {market.closes_at && <span>Cierra {formatDate(market.closes_at)}</span>}
                    {market.is_trending && (
                      <span className="ml-2 flex items-center gap-1 text-amber-500 normal-case tracking-normal">
                        <TrendingUp size={11} /> Tendencia
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const url = `${window.location.origin}/?q=${encodeURIComponent(market.title)}`;
                        if (navigator.share) {
                          navigator.share({ title: market.title, url }).catch(() => {});
                        } else {
                          navigator.clipboard.writeText(url).then(() =>
                            toast.success("Enlace copiado al portapapeles")
                          ).catch(() => toast.error("No se pudo copiar el enlace"));
                        }
                      }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                      title="Compartir mercado"
                    >
                      <Share2 size={15} />
                    </button>
                    <button className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                      <Bookmark size={15} />
                    </button>
                    <button
                      onClick={handleClose}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors ml-1"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {/* ── Icon + título ── */}
                <div className="flex items-start gap-4 mb-5">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-base font-bold shrink-0 shadow-sm"
                    style={{ backgroundColor: ic.bg, color: ic.fg }}
                  >
                    {getInitials(market.subject_name)}
                  </div>
                  <h2 className="text-[22px] font-bold text-gray-900 leading-snug mt-1">
                    {market.title}
                  </h2>
                </div>

                {/* ── Stats ── */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-5 text-sm text-gray-500">
                  <span className="font-semibold text-gray-800">
                    {formatVol(market.total_pool)} Vol.
                  </span>
                  {market.bettor_count > 0 && (
                    <span className="flex items-center gap-1.5">
                      <Users size={13} />
                      {market.bettor_count.toLocaleString("es-MX")} participantes
                    </span>
                  )}
                  {isClosed && (
                    <span className="flex items-center gap-1 text-red-500 font-semibold text-xs">
                      <Lock size={12} /> Mercado cerrado
                    </span>
                  )}
                </div>

                <div className="h-px bg-gray-100 mb-5" />

                {/* ── Opciones ── */}
                <div className="space-y-1">
                  {[
                    { label: "Sí", pct: yesP, pool: market.total_pool * yesP / 100, s: "yes" as const },
                    { label: "No", pct: noP, pool: market.total_pool * noP / 100, s: "no" as const },
                  ].map(({ label, pct, pool, s }) => (
                    <div
                      key={s}
                      className="flex items-center gap-3 py-3.5 px-3 -mx-3 rounded-xl hover:bg-gray-50 transition-colors"
                    >
                      {/* Nombre + vol */}
                      <div className="w-16 shrink-0">
                        <p className="text-sm font-semibold text-gray-900">{label}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                          {formatVol(pool)}
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="text-gray-300 hover:text-amber-400 transition-colors"
                          >
                            <Gift size={10} />
                          </button>
                        </p>
                      </div>

                      {/* Porcentaje */}
                      <span className="text-2xl font-bold text-gray-900 tabular-nums w-16">
                        {pct}%
                      </span>

                      <div className="flex-1" />

                      {/* Botones comprar */}
                      <div className="flex gap-2 shrink-0">
                        <button
                          disabled={isClosed}
                          onClick={() => setSide("yes")}
                          className={`px-3.5 py-2 text-xs font-bold rounded-xl border transition-all active:scale-95 ${
                            side === "yes"
                              ? "bg-emerald-500 text-white border-emerald-500 shadow-sm"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                          } disabled:opacity-40 disabled:pointer-events-none`}
                        >
                          Comprar Sí&nbsp;&nbsp;{market.yes_odds}x
                        </button>
                        <button
                          disabled={isClosed}
                          onClick={() => setSide("no")}
                          className={`px-3.5 py-2 text-xs font-bold rounded-xl border transition-all active:scale-95 ${
                            side === "no"
                              ? "bg-rose-500 text-white border-rose-500 shadow-sm"
                              : "bg-rose-50 text-rose-500 border-rose-200 hover:bg-rose-100"
                          } disabled:opacity-40 disabled:pointer-events-none`}
                        >
                          Comprar No&nbsp;&nbsp;{market.no_odds}x
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            </div>

            {/* ══ Panel derecho — apuesta ══ */}
            <div className="md:w-72 lg:w-80 shrink-0 border-t border-gray-100 md:border-t-0 md:border-l bg-white">
              <div className="p-5 flex flex-col h-full min-h-[420px]">

                {/* Subject icon + name */}
                <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ backgroundColor: ic.bg, color: ic.fg }}
                  >
                    {getInitials(market.subject_name)}
                  </div>
                  <p className="text-sm font-semibold text-gray-900 truncate leading-tight">
                    {market.subject_name}
                  </p>
                </div>

                {/* Tabs Comprar / Vender */}
                <div className="flex rounded-xl border border-gray-200 overflow-hidden mb-4 text-sm font-semibold">
                  <div className="flex-1 py-2 text-center text-gray-900 bg-white border-b-2 border-gray-900 cursor-default">
                    Comprar
                  </div>
                  <button
                    disabled
                    className="flex-1 py-2 text-center text-gray-400 bg-gray-50 cursor-not-allowed"
                  >
                    Vender
                  </button>
                </div>

                {/* Sí / No selector */}
                <div className="flex gap-2 mb-5">
                  <button
                    disabled={isClosed}
                    onClick={() => setSide("yes")}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                      side === "yes"
                        ? "bg-emerald-500 text-white shadow-md shadow-emerald-100"
                        : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    } disabled:opacity-50 disabled:pointer-events-none`}
                  >
                    Sí&nbsp;&nbsp;{yesP}%
                  </button>
                  <button
                    disabled={isClosed}
                    onClick={() => setSide("no")}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                      side === "no"
                        ? "bg-rose-500 text-white shadow-md shadow-rose-100"
                        : "bg-rose-50 text-rose-500 hover:bg-rose-100"
                    } disabled:opacity-50 disabled:pointer-events-none`}
                  >
                    No&nbsp;&nbsp;{noP}%
                  </button>
                </div>

                {/* Importe label */}
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-gray-500 font-medium">Importe</span>
                  <span className="text-sm font-bold text-gray-900 tabular-nums">
                    {num > 0 ? `$${num.toFixed(2)}` : "$0"}
                  </span>
                </div>

                {/* Saldo */}
                <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-3">
                  <Wallet size={11} />
                  Saldo ${balance.toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN
                </div>

                {/* Input */}
                <div className="relative mb-3">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold select-none">
                    $
                  </span>
                  <input
                    type="number"
                    min="10"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    className="w-full border border-gray-200 rounded-xl pl-8 pr-4 py-3 text-gray-900 font-bold text-lg focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-400 transition-all placeholder:text-gray-300 bg-gray-50 hover:bg-white"
                  />
                </div>

                {/* Quick amounts */}
                <div className="flex gap-1.5 mb-4">
                  {[50, 100, 200, 500].map((v) => (
                    <button
                      key={v}
                      onClick={() => addAmt(v)}
                      className="flex-1 py-2 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 rounded-lg transition-colors"
                    >
                      +${v}
                    </button>
                  ))}
                  <button
                    onClick={() => addAmt("max")}
                    className="flex-1 py-2 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 rounded-lg transition-colors"
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
                      <div className="flex items-center justify-between py-3 border-t border-gray-100 mb-4">
                        <span className="text-sm text-gray-500">Pago potencial</span>
                        <span className="text-sm font-bold text-gray-900 tabular-nums">
                          ${payout.toFixed(2)} MXN
                        </span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex-1" />

                {/* CTA */}
                <button
                  disabled={isClosed || loading || (isAuthenticated && !isValid)}
                  onClick={isAuthenticated ? handleBet : onAuthRequired}
                  className={`w-full py-3.5 rounded-xl text-sm font-bold transition-all active:scale-[0.98] ${
                    isClosed
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : loading
                      ? "bg-blue-400 text-white cursor-wait"
                      : isAuthenticated && !isValid && num > 0
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-100/60"
                  }`}
                >
                  {isClosed
                    ? "Mercado cerrado"
                    : loading
                    ? "Procesando..."
                    : !isAuthenticated
                    ? "Iniciar sesión para participar"
                    : "Confirmar"}
                </button>

                <p className="text-[10px] text-gray-400 text-center mt-3 leading-relaxed">
                  Al operar, aceptas las{" "}
                  <span className="underline cursor-pointer hover:text-gray-600 transition-colors">
                    condiciones de uso
                  </span>.
                </p>

              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
