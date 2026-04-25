import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Wallet, TrendingUp } from "lucide-react";
import type { Market } from "@/lib/supabase";
import { toast } from "sonner";
import { useBet } from "@/hooks/use-bet";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

interface BetModalProps {
  market: Market | null;
  side: "yes" | "no" | null;
  onClose: () => void;
  onAuthRequired?: () => void;
}

// ── Scalar range slider ──────────────────────────────────────────────────────

interface ScalarSliderProps {
  min: number; max: number;
  low: number; high: number;
  onChange: (low: number, high: number) => void;
}

function ScalarSlider({ min, max, low, high, onChange }: ScalarSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pct = (v: number) => ((v - min) / (max - min)) * 100;

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current) return;
    const rect  = trackRef.current.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const val   = Math.round(min + ratio * (max - min));
    Math.abs(val - low) <= Math.abs(val - high)
      ? onChange(Math.min(val, high - 1), high)
      : onChange(low, Math.max(val, low + 1));
  };

  return (
    <div style={{ padding: "16px 0" }}>
      <div
        ref={trackRef}
        onClick={handleTrackClick}
        style={{ position: "relative", height: 8, borderRadius: 999, background: "#E5E7EB", cursor: "pointer" }}
      >
        <div style={{ position: "absolute", height: "100%", borderRadius: 999, background: "#2563EB", left: `${pct(low)}%`, width: `${pct(high) - pct(low)}%` }} />
        {/* invisible range inputs for drag */}
        <input type="range" min={min} max={max} value={low}
          onChange={(e) => { const v = parseInt(e.target.value); onChange(Math.min(v, high - 1), high); }}
          style={{ position: "absolute", inset: 0, width: "100%", opacity: 0, cursor: "pointer", height: "100%", zIndex: low > (min + max) / 2 ? 5 : 4 }}
        />
        <input type="range" min={min} max={max} value={high}
          onChange={(e) => { const v = parseInt(e.target.value); onChange(low, Math.max(v, low + 1)); }}
          style={{ position: "absolute", inset: 0, width: "100%", opacity: 0, cursor: "pointer", height: "100%", zIndex: high < (min + max) / 2 ? 5 : 4 }}
        />
        {/* visual thumbs */}
        <div style={{ position: "absolute", top: "50%", transform: "translate(-50%,-50%)", width: 20, height: 20, borderRadius: "50%", background: "#fff", border: "2px solid #2563EB", boxShadow: "0 1px 4px rgba(0,0,0,.15)", pointerEvents: "none", left: `${pct(low)}%`, zIndex: 6 }} />
        <div style={{ position: "absolute", top: "50%", transform: "translate(-50%,-50%)", width: 20, height: 20, borderRadius: "50%", background: "#fff", border: "2px solid #2563EB", boxShadow: "0 1px 4px rgba(0,0,0,.15)", pointerEvents: "none", left: `${pct(high)}%`, zIndex: 6 }} />
      </div>
    </div>
  );
}

// ── Modal principal ──────────────────────────────────────────────────────────

export function BetModal({ market, side, onClose, onAuthRequired }: BetModalProps) {
  const [amount, setAmount] = useState("");
  const { balance, isAuthenticated } = useAuth();
  const { placeBet, loading } = useBet();

  const isScalar   = market?.market_type === "scalar";
  const scalarMin  = market?.scalar_min  ?? 0;
  const scalarMax  = market?.scalar_max  ?? 100;
  const scalarUnit = market?.scalar_unit ?? "";

  const initLow  = Math.round(scalarMin + (scalarMax - scalarMin) * 0.35);
  const initHigh = Math.round(scalarMin + (scalarMax - scalarMin) * 0.65);
  const [scalarLow,     setScalarLow]     = useState(initLow);
  const [scalarHigh,    setScalarHigh]    = useState(initHigh);
  const [scalarLoading, setScalarLoading] = useState(false);

  useEffect(() => {
    setAmount("");
    if (isScalar) {
      setScalarLow(Math.round(scalarMin + (scalarMax - scalarMin) * 0.35));
      setScalarHigh(Math.round(scalarMin + (scalarMax - scalarMin) * 0.65));
    }
  }, [market?.id]);

  const scalarOdds = 2.0;
  const rangeWidth = scalarMax > scalarMin ? (scalarHigh - scalarLow) / (scalarMax - scalarMin) : 0;

  if (!market) return null;
  if (!isScalar && !side) return null;

  const odds      = isScalar ? scalarOdds : (side === "yes" ? market.yes_odds : market.no_odds);
  const num       = parseFloat(amount) || 0;
  const rawPayout = num * odds;
  const fee       = rawPayout * 0.03;
  const payout    = rawPayout - fee;
  const isValid   = num >= 10 && num <= balance;

  const addAmt = (v: number | "max") =>
    setAmount(v === "max" ? String(Math.floor(balance)) : String(Math.min(num + v, balance)));

  const handleBet = async () => {
    if (!isAuthenticated) { onAuthRequired?.(); return; }
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

  // ── Paleta de colores por lado ──
  const c = isScalar
    ? { bg: "#EFF6FF", bd: "rgba(37,99,235,.25)", fg: "#1D4ED8", name: "SCALAR" }
    : side === "yes"
    ? { bg: "#ECFDF5", bd: "rgba(16,185,129,.25)", fg: "#047857", name: "SÍ" }
    : { bg: "#FFF1F2", bd: "rgba(244,63,94,.25)",  fg: "#BE123C", name: "NO" };

  const ctaLabel = isProcessing
    ? "Procesando..."
    : !isAuthenticated
    ? "Iniciar sesión para participar"
    : isValid
    ? `Confirmar · $${num.toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN`
    : num > 0 ? (num < 10 ? "Mínimo $10" : "Saldo insuficiente")
    : "Ingresa un monto";

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 50,
          background: "rgba(0,0,0,.45)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "flex-end", justifyContent: "center",
        }}
      >
        <motion.div
          key="sheet"
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 320 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "100%", maxWidth: 400,
            background: "#fff",
            borderRadius: "24px 24px 0 0",
            boxShadow: "0 24px 60px rgba(0,0,0,.18)",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: 24, paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}>

            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "#111827" }}>Tomar posición</h3>
              <button onClick={onClose}
                style={{ padding: 6, background: "transparent", border: 0, color: "#9CA3AF", cursor: "pointer", borderRadius: 8, display: "inline-flex" }}>
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            {/* Título del mercado */}
            <p style={{
              fontSize: 13, color: "#6B7280", lineHeight: 1.45, margin: "0 0 14px",
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
            }}>
              {market.title}
            </p>

            {/* ── SCALAR: header informativo + slider ── */}
            {isScalar ? (
              <>
                <div style={{ background: "#EFF6FF", border: "1px solid rgba(37,99,235,.2)", borderRadius: 12, padding: "10px 14px", marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <TrendingUp size={14} strokeWidth={2} color="#2563EB" />
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#1D4ED8", textTransform: "uppercase", letterSpacing: ".1em" }}>Mercado Scalar</span>
                  </div>
                  <span style={{ fontSize: 11.5, color: "#2563EB" }}>
                    Rango válido: <strong>{scalarMin} – {scalarMax} {scalarUnit}</strong>
                  </span>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "#374151" }}>Tu predicción</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#1D4ED8", fontVariantNumeric: "tabular-nums" }}>
                      {scalarLow} – {scalarHigh} {scalarUnit}
                    </span>
                  </div>

                  <ScalarSlider min={scalarMin} max={scalarMax} low={scalarLow} high={scalarHigh}
                    onChange={(l, h) => { setScalarLow(l); setScalarHigh(h); }} />

                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    {[
                      { label: "Desde", val: scalarLow, set: (v: number) => setScalarLow(Math.min(v, scalarHigh - 1)), min: scalarMin, max: scalarHigh - 1 },
                      { label: "Hasta", val: scalarHigh, set: (v: number) => setScalarHigh(Math.max(v, scalarLow + 1)), min: scalarLow + 1, max: scalarMax },
                    ].map((f) => (
                      <label key={f.label} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                        <span style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 500 }}>{f.label}</span>
                        <input type="number" value={f.val} min={f.min} max={f.max}
                          onChange={(e) => { const v = parseInt(e.target.value); if (!isNaN(v)) f.set(v); }}
                          style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 8, padding: "6px 8px", fontSize: 13, fontWeight: 700, color: "#1E293B", textAlign: "center", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                        />
                      </label>
                    ))}
                  </div>

                  <p style={{ fontSize: 11, color: "#9CA3AF", textAlign: "center", marginTop: 8 }}>
                    Rango cubre <strong style={{ color: "#6B7280" }}>{(rangeWidth * 100).toFixed(0)}%</strong> del total · cuota fija <strong style={{ color: "#6B7280" }}>2x</strong>
                  </p>
                </div>
              </>
            ) : (
              /* ── BINARIO: pill de lado ── */
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                background: c.bg, border: "1px solid " + c.bd,
                borderRadius: 12, padding: "10px 14px", marginBottom: 16,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: c.fg, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: c.fg, lineHeight: 1 }}>
                    {c.name} · {odds}x
                  </div>
                  <div style={{ fontSize: 11.5, color: "#6B7280", marginTop: 3 }}>Cuota actual</div>
                </div>
              </div>
            )}

            {/* Input monto */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <label style={{ fontSize: 12.5, fontWeight: 500, color: "#374151" }}>Monto (MXN)</label>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "#9CA3AF" }}>
                  <Wallet size={11} strokeWidth={1.75} />
                  ${balance.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", fontWeight: 600, fontSize: 14 }}>$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*"
                  value={amount}
                  onKeyDown={(e) => {
                    const allowed = ["Backspace","Delete","ArrowLeft","ArrowRight","Tab","Enter","Home","End"];
                    if (!allowed.includes(e.key) && !/^\d$/.test(e.key) && !(e.key === "." && !amount.includes("."))) {
                      e.preventDefault();
                    }
                  }}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
                    setAmount(val);
                  }}
                  onPaste={(e) => {
                    e.preventDefault();
                    const text = e.clipboardData.getData("text").replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
                    setAmount(text);
                  }}
                  placeholder="0"
                  autoFocus
                  style={{
                    width: "100%", padding: "12px 14px 12px 28px",
                    background: "#F9FAFB", border: "1px solid #E5E7EB",
                    borderRadius: 12, color: "#111827", fontWeight: 700,
                    fontSize: 17, fontVariantNumeric: "tabular-nums",
                    outline: 0, boxSizing: "border-box", fontFamily: "inherit",
                  }}
                />
              </div>
            </div>

            {/* Quick amounts */}
            <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
              {[100, 200, 500, 1000].map((v) => (
                <Button key={v} variant="quick" onClick={() => addAmt(v)} style={{ flex: 1, justifyContent: "center" }}>
                  +${v}
                </Button>
              ))}
              <Button variant="quick" onClick={() => addAmt("max")} style={{ flex: 1, justifyContent: "center" }}>
                Máx.
              </Button>
            </div>

            {/* Ganancia potencial */}
            {num > 0 && (
              <div style={{ background: c.bg, border: "1px solid " + c.bd, borderRadius: 12, marginBottom: 12, overflow: "hidden" }}>
                <div style={{ padding: "10px 14px" }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: ".12em", marginBottom: 4 }}>
                    Ganancia potencial
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: c.fg, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                    ${payout.toFixed(2)}
                    <span style={{ fontSize: 12, fontWeight: 600, marginLeft: 6, opacity: 0.6 }}>MXN</span>
                  </div>
                </div>
                <div style={{
                  padding: "6px 14px", background: "rgba(255,255,255,.5)",
                  borderTop: "1px solid rgba(255,255,255,.6)",
                  display: "flex", justifyContent: "space-between",
                  fontSize: 11, color: "#9CA3AF",
                }}>
                  <span>Bruto {rawPayout.toFixed(2)} − fee 3%</span>
                  <span style={{ fontVariantNumeric: "tabular-nums", color: "#6B7280", fontWeight: 600 }}>
                    +{((payout / num - 1) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            )}

            {/* CTA */}
            <Button
              variant="cta"
              onClick={isAuthenticated ? handleBet : onAuthRequired}
              disabled={isProcessing || (isAuthenticated && !isValid && num > 0)}
            >
              {ctaLabel}
            </Button>

          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
