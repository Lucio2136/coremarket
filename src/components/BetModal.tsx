import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Wallet, TrendingUp } from "lucide-react";
import type { Market } from "@/lib/supabase";
import { toast } from "sonner";
import { useBet } from "@/hooks/use-bet";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

interface BetModalProps {
  market: Market | null;
  side: "yes" | "no" | null;
  onClose: () => void;
  onAuthRequired?: () => void;
}

// ── Scalar range slider ─────────────────────────────────────────────────────

interface ScalarSliderProps {
  min: number;
  max: number;
  low: number;
  high: number;
  onChange: (low: number, high: number) => void;
}

function ScalarSlider({ min, max, low, high, onChange }: ScalarSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  const pct = (v: number) => ((v - min) / (max - min)) * 100;

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const val = Math.round(min + ratio * (max - min));
    const distLow  = Math.abs(val - low);
    const distHigh = Math.abs(val - high);
    if (distLow <= distHigh) {
      onChange(Math.min(val, high - 1), high);
    } else {
      onChange(low, Math.max(val, low + 1));
    }
  };

  return (
    <div className="py-4">
      {/* Track */}
      <div
        ref={trackRef}
        onClick={handleTrackClick}
        className="relative h-2 rounded-full bg-gray-200 cursor-pointer"
      >
        {/* Rango activo */}
        <div
          className="absolute h-full rounded-full bg-blue-500"
          style={{ left: `${pct(low)}%`, width: `${pct(high) - pct(low)}%` }}
        />
        {/* Thumb bajo */}
        <input
          type="range"
          min={min}
          max={max}
          value={low}
          onChange={(e) => {
            const v = parseInt(e.target.value);
            onChange(Math.min(v, high - 1), high);
          }}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
          style={{ zIndex: low > (min + max) / 2 ? 5 : 4 }}
        />
        {/* Thumb alto */}
        <input
          type="range"
          min={min}
          max={max}
          value={high}
          onChange={(e) => {
            const v = parseInt(e.target.value);
            onChange(low, Math.max(v, low + 1));
          }}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
          style={{ zIndex: high < (min + max) / 2 ? 5 : 4 }}
        />
        {/* Thumb visual bajo */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white border-2 border-blue-500 shadow-md pointer-events-none"
          style={{ left: `calc(${pct(low)}% - 10px)`, zIndex: 6 }}
        />
        {/* Thumb visual alto */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white border-2 border-blue-500 shadow-md pointer-events-none"
          style={{ left: `calc(${pct(high)}% - 10px)`, zIndex: 6 }}
        />
      </div>
    </div>
  );
}

// ── Modal principal ─────────────────────────────────────────────────────────

export function BetModal({ market, side, onClose, onAuthRequired }: BetModalProps) {
  const [amount, setAmount] = useState("");
  const { balance, isAuthenticated } = useAuth();
  const { placeBet, loading } = useBet();

  const isScalar = market?.market_type === "scalar";
  const scalarMin  = market?.scalar_min  ?? 0;
  const scalarMax  = market?.scalar_max  ?? 100;
  const scalarUnit = market?.scalar_unit ?? "";

  const initLow  = Math.round(scalarMin + (scalarMax - scalarMin) * 0.35);
  const initHigh = Math.round(scalarMin + (scalarMax - scalarMin) * 0.65);

  const [scalarLow,  setScalarLow]  = useState(initLow);
  const [scalarHigh, setScalarHigh] = useState(initHigh);
  const [scalarLoading, setScalarLoading] = useState(false);

  // Reinicializar rango si cambia el mercado
  useEffect(() => {
    if (isScalar) {
      setScalarLow(Math.round(scalarMin + (scalarMax - scalarMin) * 0.35));
      setScalarHigh(Math.round(scalarMin + (scalarMax - scalarMin) * 0.65));
    }
  }, [market?.id]);

  // Para scalar usamos odds fija de 2x (el usuario gana si el resultado cae en su rango)
  // El ancho del rango afecta la probabilidad implícita
  const scalarOdds = 2.0;
  const rangeWidth = scalarMax > scalarMin ? (scalarHigh - scalarLow) / (scalarMax - scalarMin) : 0;

  if (!market) return null;
  // Para binario/multiple, side es requerido
  if (!isScalar && !side) return null;

  const odds = isScalar ? scalarOdds : (side === "yes" ? market.yes_odds : market.no_odds);
  const num = parseFloat(amount) || 0;
  const rawPayout = num * odds;
  const fee = rawPayout * 0.03;
  const payout = rawPayout - fee;
  const isValid = num >= 10 && num <= balance;

  const addAmt = (v: number | "max") =>
    setAmount(v === "max" ? String(Math.floor(balance)) : String(Math.min(num + v, balance)));

  const handleBet = async () => {
    if (!isAuthenticated) { onAuthRequired?.(); return; }
    if (!isValid) return;

    if (isScalar) {
      if (scalarLow >= scalarHigh) { toast.error("Rango inválido"); return; }
      setScalarLoading(true);
      try {
        const { data, error } = await supabase.rpc("place_scalar_bet", {
          p_market_id: market.id,
          p_amount:    num,
          p_odds:      scalarOdds,
          p_low:       scalarLow,
          p_high:      scalarHigh,
        });
        if (error) throw error;
        toast.success(`¡Posición tomada! ${scalarLow}–${scalarHigh} ${scalarUnit} · $${num.toFixed(2)} MXN`);
        onClose();
        setAmount("");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al confirmar posición");
      } finally {
        setScalarLoading(false);
      }
      return;
    }

    try {
      await placeBet(market.id, num, side, odds);
      toast.success(`¡Posición tomada! ${side === "yes" ? "SÍ" : "NO"} · $${num.toFixed(2)} MXN`);
      onClose();
      setAmount("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al confirmar posición");
    }
  };

  const isProcessing = loading || scalarLoading;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4"
        style={{ backgroundColor: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 40, opacity: 0, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 40, opacity: 0, scale: 0.98 }}
          transition={{ type: "spring", damping: 28, stiffness: 320 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm bg-white rounded-t-3xl md:rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.18)] overflow-hidden"
        >
          <div className="p-6" style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Tomar posición</h3>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Mercado */}
            <p className="text-sm text-gray-500 mb-4 leading-relaxed line-clamp-2">
              {market.title}
            </p>

            {isScalar ? (
              /* ── MODO SCALAR ── */
              <>
                <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 mb-5">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp size={14} className="text-blue-600" />
                    <p className="text-xs font-bold text-blue-700 uppercase tracking-wider">Mercado Scalar</p>
                  </div>
                  <p className="text-xs text-blue-600">
                    Rango válido: <strong>{scalarMin} – {scalarMax} {scalarUnit}</strong>
                  </p>
                </div>

                {/* Doble slider */}
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-semibold text-gray-700">Tu predicción</label>
                    <span className="text-sm font-bold text-blue-600 tabular-nums">
                      {scalarLow} – {scalarHigh} {scalarUnit}
                    </span>
                  </div>

                  <ScalarSlider
                    min={scalarMin}
                    max={scalarMax}
                    low={scalarLow}
                    high={scalarHigh}
                    onChange={(l, h) => { setScalarLow(l); setScalarHigh(h); }}
                  />

                  {/* Inputs manuales */}
                  <div className="flex gap-2 mt-1">
                    <div className="flex-1">
                      <label className="text-[10px] text-gray-400 font-medium">Desde</label>
                      <input
                        type="number"
                        value={scalarLow}
                        min={scalarMin}
                        max={scalarHigh - 1}
                        onChange={(e) => {
                          const v = parseInt(e.target.value);
                          if (!isNaN(v)) setScalarLow(Math.min(v, scalarHigh - 1));
                        }}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-bold text-gray-800 text-center focus:outline-none focus:ring-2 focus:ring-blue-400/30"
                      />
                    </div>
                    <div className="flex items-end pb-1.5 text-gray-300 font-bold">–</div>
                    <div className="flex-1">
                      <label className="text-[10px] text-gray-400 font-medium">Hasta</label>
                      <input
                        type="number"
                        value={scalarHigh}
                        min={scalarLow + 1}
                        max={scalarMax}
                        onChange={(e) => {
                          const v = parseInt(e.target.value);
                          if (!isNaN(v)) setScalarHigh(Math.max(v, scalarLow + 1));
                        }}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-bold text-gray-800 text-center focus:outline-none focus:ring-2 focus:ring-blue-400/30"
                      />
                    </div>
                  </div>

                  {/* Ancho del rango */}
                  <p className="text-[11px] text-gray-400 mt-2 text-center">
                    Rango cubre <strong className="text-gray-600">{(rangeWidth * 100).toFixed(0)}%</strong> del total · cuota fija <strong className="text-gray-600">2x</strong>
                  </p>
                </div>
              </>
            ) : (
              /* ── MODO BINARIO / MÚLTIPLE ── */
              <div className={`flex items-center gap-3 rounded-xl px-4 py-3 mb-5 border ${
                side === "yes"
                  ? "bg-emerald-50 border-emerald-200"
                  : "bg-rose-50 border-rose-200"
              }`}>
                <div className={`w-2 h-2 rounded-full ${side === "yes" ? "bg-emerald-500" : "bg-rose-500"}`} />
                <div>
                  <p className={`font-bold text-sm ${side === "yes" ? "text-emerald-700" : "text-rose-600"}`}>
                    {side === "yes" ? "SÍ" : "NO"} · {odds}x
                  </p>
                  <p className="text-xs text-gray-500">Cuota actual</p>
                </div>
              </div>
            )}

            {/* Input monto */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-gray-700">Monto (MXN)</label>
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <Wallet size={11} />
                  ${balance.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm">$</span>
                <input
                  type="number"
                  min="10"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  autoFocus
                  className="w-full border border-gray-200 rounded-xl pl-8 pr-4 py-3 text-gray-900 font-bold text-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all placeholder:text-gray-300"
                />
              </div>
            </div>

            {/* Quick amounts */}
            <div className="flex gap-1.5 mb-4">
              {[100, 200, 500, 1000].map((v) => (
                <button
                  key={v}
                  onClick={() => addAmt(v)}
                  className="flex-1 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 rounded-lg transition-colors"
                >
                  +${v}
                </button>
              ))}
              <button
                onClick={() => addAmt("max")}
                className="flex-1 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 rounded-lg transition-colors"
              >
                Máx.
              </button>
            </div>

            {/* Ganancia potencial */}
            {num > 0 && (
              <div className={`rounded-xl border mb-4 overflow-hidden transition-all ${
                isScalar ? "border-blue-200 bg-blue-50" :
                side === "yes" ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"
              }`}>
                <div className="px-4 pt-3 pb-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
                    Ganancia potencial
                  </p>
                  <p className={`text-2xl font-black tabular-nums leading-none ${
                    isScalar ? "text-blue-700" :
                    side === "yes" ? "text-emerald-700" : "text-rose-600"
                  }`}>
                    ${payout.toFixed(2)}
                    <span className="text-sm font-semibold ml-1 opacity-60">MXN</span>
                  </p>
                </div>
                <div className="flex items-center justify-between px-4 py-2 bg-white/50 border-t border-white/60">
                  <span className="text-[11px] text-gray-400">Bruto {rawPayout.toFixed(2)} − fee 3% ({fee.toFixed(2)})</span>
                  <span className="text-[11px] font-semibold text-gray-500 tabular-nums">
                    {((payout / num - 1) * 100).toFixed(1)}% retorno
                  </span>
                </div>
              </div>
            )}

            {/* CTA */}
            <button
              onClick={isAuthenticated ? handleBet : onAuthRequired}
              disabled={isProcessing || (isAuthenticated && !isValid)}
              className={`w-full py-3.5 rounded-xl text-sm font-bold transition-all active:scale-[0.98] ${
                isProcessing
                  ? "bg-blue-400 text-white cursor-wait"
                  : isAuthenticated && !isValid && num > 0
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-100/60"
              }`}
            >
              {isProcessing
                ? "Procesando..."
                : !isAuthenticated
                ? "Iniciar sesión para participar"
                : "Confirmar"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
