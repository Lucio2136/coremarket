import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Market } from "@/lib/supabase";
import { Users, Lock, Clock, Share2, Bookmark, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import type { UserMarketPosition } from "@/hooks/use-user-positions";
import { Button } from "@/components/ui/button";
import { ShareModal } from "@/components/modals/ShareModal";

// ─── helpers ────────────────────────────────────────────────────────────────

function formatVol(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n || 0}`;
}

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
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

// ─── Countdown ──────────────────────────────────────────────────────────────

interface TimeLeft { display: string; hoursLeft: number; }

function useCountdown(closesAt: string | null | undefined): TimeLeft | null {
  const calc = (): TimeLeft | null => {
    if (!closesAt) return null;
    const ms = new Date(closesAt).getTime() - Date.now();
    if (ms <= 0) return null;
    const days    = Math.floor(ms / 86_400_000);
    const hours   = Math.floor((ms % 86_400_000) / 3_600_000);
    const minutes = Math.floor((ms % 3_600_000) / 60_000);
    const seconds = Math.floor((ms % 60_000) / 1_000);
    if (days > 3) return null;
    const display = days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m ${seconds}s`;
    return { display, hoursLeft: days * 24 + hours + minutes / 60 };
  };
  const [left, setLeft] = useState<TimeLeft | null>(() => calc());
  useEffect(() => {
    const t = setInterval(() => setLeft(calc()), 1_000);
    return () => clearInterval(t);
  }, [closesAt]);
  return left;
}

// ─── Radial gauge ───────────────────────────────────────────────────────────

function RadialGauge({ pct }: { pct: number }) {
  const C      = 2 * Math.PI * 22;
  const offset = C * (1 - pct / 100);
  const color  = pct >= 50 ? "#10B981" : "#F43F5E";
  return (
    <div style={{ position: "relative", width: 54, height: 54, flexShrink: 0 }}>
      <svg width="54" height="54" viewBox="0 0 54 54" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="27" cy="27" r="22" fill="none" stroke="#F1F2F5" strokeWidth="6" />
        <circle
          cx="27" cy="27" r="22" fill="none"
          stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset .7s ease-out" }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1,
      }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: "#0D1117", lineHeight: 1, fontVariantNumeric: "tabular-nums", letterSpacing: "-.02em" }}>
          {pct}%
        </span>
        <span style={{ fontSize: 9, fontWeight: 600, color: "#9CA3AF", lineHeight: 1, textTransform: "lowercase" }}>sí</span>
      </div>
    </div>
  );
}

// ─── Botón Sí/No (plano tintado → sólido en hover/selected) ─────────────────

function YesNoBtn({
  side, selected, isClosed, onClick,
}: { side: "yes" | "no"; selected: boolean; isClosed: boolean; onClick: (e: React.MouseEvent) => void }) {
  const [hovering, setHovering] = useState(false);

  const yes = side === "yes";
  const solid = selected || hovering;

  const style: React.CSSProperties = {
    position: "relative", height: 46, borderRadius: 12,
    fontWeight: 700, fontSize: 15, border: 0,
    cursor: isClosed ? "default" : "pointer",
    opacity: isClosed ? 0.6 : 1,
    display: "flex", alignItems: "center", justifyContent: "center",
    overflow: "hidden", transition: "background .15s, box-shadow .15s, transform .12s",
    fontFamily: "inherit",
    background: solid
      ? (yes ? "#10B981" : "#F43F5E")
      : (yes ? "#ECFDF5" : "#FFF1F2"),
    color: solid ? "#fff" : (yes ? "#047857" : "#BE123C"),
    boxShadow: solid
      ? `0 1px 0 rgba(255,255,255,.25) inset, 0 8px 18px -6px ${yes ? "rgba(16,185,129,.55)" : "rgba(244,63,94,.55)"}, 0 2px 4px rgba(15,23,42,.08)`
      : "none",
    transform: hovering && !isClosed ? "translateY(-1px)" : "translateY(0)",
  };

  return (
    <button
      style={style}
      onClick={onClick}
      disabled={isClosed}
      onMouseEnter={() => !isClosed && setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {/* shimmer layer */}
      {solid && (
        <span style={{
          position: "absolute", inset: 0, borderRadius: "inherit", pointerEvents: "none",
          background: "linear-gradient(180deg,rgba(255,255,255,.22) 0%,transparent 45%)",
        }} />
      )}
      <span style={{ position: "relative", zIndex: 1 }}>{yes ? "Sí" : "No"}</span>
    </button>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────

interface MarketCardProps {
  market:        Market;
  index?:        number;
  userPosition?: UserMarketPosition | null;
  isSaved?:      boolean;
  onToggleSave?: (id: string, e: React.MouseEvent) => void;
}

export const MarketCard = memo(function MarketCard({
  market,
  index = 0,
  userPosition,
  isSaved = false,
  onToggleSave,
}: MarketCardProps) {
  const navigate   = useNavigate();
  const countdown  = useCountdown(market.closes_at);
  const [shareOpen, setShareOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [picked, setPicked]   = useState<"yes" | "no" | null>(null);

  const yesP     = market.yes_percent ?? 50;
  const noP      = 100 - yesP;
  const isClosed = market.status === "closed";
  const ic       = iconColor(market.subject_name);

  // Flash on odds change
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

  const marketPath = market.slug || market.id;
  const handleOpen = useCallback(() => navigate(`/market/${marketPath}`), [navigate, marketPath]);

  const handleBuy = useCallback((e: React.MouseEvent, side: "yes" | "no") => {
    e.stopPropagation();
    setPicked(side);
    navigate(`/market/${marketPath}?side=${side}`);
  }, [navigate, marketPath]);

  const handleShare = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShareOpen(true);
  }, []);

  const activeSide = picked ?? userPosition?.side ?? null;

  const urgency = countdown
    ? countdown.hoursLeft < 1 ? "critical" : countdown.hoursLeft < 24 ? "warning" : "normal"
    : "normal";

  return (
    <div
      onClick={handleOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && handleOpen()}
      style={{
        background: "#fff",
        borderRadius: 20,
        border: "1px solid #EEF0F3",
        padding: "18px 18px 16px",
        display: "flex", flexDirection: "column", gap: 14,
        cursor: "pointer",
        boxShadow: hovered && !isClosed
          ? "0 4px 16px rgba(0,0,0,.08), 0 2px 4px rgba(0,0,0,.04)"
          : "0 1px 2px rgba(15,23,42,.04), 0 2px 8px -4px rgba(15,23,42,.08)",
        transform: hovered && !isClosed ? "translateY(-3px)" : "translateY(0)",
        transition: "transform .2s ease-out, box-shadow .2s",
        outline: "none",
        opacity: isClosed ? 0.8 : 1,
      }}
    >
      {/* ── Header: avatar + title + gauge ── */}
      <header style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        {/* Avatar */}
        <div style={{
          width: 46, height: 46, borderRadius: 14, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 800, overflow: "hidden",
          background: ic.bg, color: ic.fg,
          boxShadow: "inset 0 1px 2px rgba(0,0,0,.15), 0 1px 2px rgba(15,23,42,.1)",
        }}>
          {market.subject_photo_url ? (
            <img
              src={market.subject_photo_url}
              alt={market.subject_name}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={(e) => {
                const t = e.currentTarget;
                t.style.display = "none";
                const p = t.parentElement!;
                p.style.background = ic.bg;
                p.style.color = ic.fg;
                p.textContent = getInitials(market.subject_name);
              }}
            />
          ) : getInitials(market.subject_name)}
        </div>

        {/* Title */}
        <h3 style={{
          flex: 1, minWidth: 0,
          fontSize: 16, fontWeight: 700, color: "#0D1117",
          lineHeight: 1.28, letterSpacing: "-.015em",
          margin: 0, paddingTop: 2,
          display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
        }}>
          {/* Badges inline */}
          {market.is_trending && !isClosed && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 3, verticalAlign: "middle",
              fontSize: 10, fontWeight: 700, color: "#DC2626",
              background: "#FEF2F2", border: "1px solid rgba(239,68,68,.3)",
              padding: "1px 6px", borderRadius: 999, marginRight: 6,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#EF4444", display: "inline-block", animation: "pulse 1.5s ease-in-out infinite" }} />
              LIVE
            </span>
          )}
          {isClosed && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 3, verticalAlign: "middle",
              fontSize: 10, fontWeight: 700, color: "#6B7280",
              background: "#F3F4F6", padding: "1px 5px", borderRadius: 999, marginRight: 6,
            }}>
              <Lock size={8} strokeWidth={2.5} />Cerrado
            </span>
          )}
          {market.title}
        </h3>

        {/* Radial gauge — solo mercados binarios */}
        {(!market.market_type || market.market_type === "binary") && (
          <RadialGauge pct={yesP} />
        )}
      </header>

      {/* ── Sección según tipo de mercado ── */}
      {market.market_type === "scalar" ? (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#2563EB", textTransform: "uppercase", letterSpacing: ".1em" }}>
              📊 Scalar
            </span>
            {market.scalar_result != null && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "#ECFDF5", color: "#047857", border: "1px solid rgba(16,185,129,.3)" }}>
                {market.scalar_result} {market.scalar_unit}
              </span>
            )}
          </div>
          <div style={{ height: 24, borderRadius: 8, background: "#EFF6FF", border: "1px solid rgba(59,130,246,.15)", display: "flex", alignItems: "center", padding: "0 8px", justifyContent: "space-between" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#93C5FD", fontVariantNumeric: "tabular-nums" }}>{market.scalar_min ?? 0}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#2563EB" }}>{market.scalar_unit}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#93C5FD", fontVariantNumeric: "tabular-nums" }}>{market.scalar_max ?? 100}</span>
          </div>
          {!isClosed && (
            <Button variant="cta" onClick={(e) => { e.stopPropagation(); navigate(`/market/${marketPath}`); }} style={{ marginTop: 8 }}>
              Predecir rango
            </Button>
          )}
        </div>

      ) : market.market_type === "multiple" && market.market_options && market.market_options.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {market.market_options.slice(0, 5).map((opt) => {
            const isWinner = market.winning_option_id === opt.id;
            const pct = opt.percent ?? 0;
            return (
              <div key={opt.id} style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 0" }}>
                {/* avatar */}
                <div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, overflow: "hidden", background: "#E5E7EB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, color: "#6B7280" }}>
                  {opt.photo_url
                    ? <img src={opt.photo_url} alt={opt.label} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                    : opt.label[0]?.toUpperCase()}
                </div>
                {/* label */}
                <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "#1E293B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {isWinner && <Check size={9} strokeWidth={3} style={{ display: "inline", marginRight: 3, color: "#047857" }} />}
                  {opt.label}
                </span>
                {/* % */}
                <span style={{ fontSize: 12, fontWeight: 800, color: isWinner ? "#047857" : "#4B5563", fontVariantNumeric: "tabular-nums", minWidth: 34, textAlign: "right", flexShrink: 0 }}>
                  {pct.toFixed(0)}%
                </span>
                {/* chips sí/no */}
                {!isClosed ? (
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/market/${marketPath}?option=${opt.id}&side=yes`); }}
                      style={{ padding: "4px 9px", borderRadius: 7, border: 0, fontSize: 11, fontWeight: 700, cursor: "pointer", background: "#ECFDF5", color: "#047857", fontFamily: "inherit" }}
                    >Sí</button>
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/market/${marketPath}?option=${opt.id}&side=no`); }}
                      style={{ padding: "4px 9px", borderRadius: 7, border: 0, fontSize: 11, fontWeight: 700, cursor: "pointer", background: "#FFF1F2", color: "#BE123C", fontFamily: "inherit" }}
                    >No</button>
                  </div>
                ) : isWinner ? (
                  <span style={{ padding: "2px 7px", borderRadius: 999, fontSize: 9, fontWeight: 700, background: "#ECFDF5", color: "#047857", border: "1px solid rgba(16,185,129,.3)", flexShrink: 0 }}>Ganó</span>
                ) : null}
              </div>
            );
          })}
          {market.market_options.length > 5 && (
            <p style={{ fontSize: 10, color: "#9CA3AF", textAlign: "center", margin: "0" }}>
              +{market.market_options.length - 5} más
            </p>
          )}
        </div>

      ) : (
        /* ── BINARIO ── */
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <YesNoBtn side="yes" selected={activeSide === "yes"} isClosed={isClosed} onClick={(e) => handleBuy(e, "yes")} />
          <YesNoBtn side="no"  selected={activeSide === "no"}  isClosed={isClosed} onClick={(e) => handleBuy(e, "no")} />
        </div>
      )}

      {/* ── Footer ── */}
      <footer style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Subcategoría (descripción corta) */}
        {market.description && market.description.length <= 25 && (
          <span style={{
            display: "inline-flex", alignItems: "center", alignSelf: "flex-start",
            fontSize: 10, fontWeight: 600, color: "#6B7280",
            background: "#F3F4F6", border: "1px solid #E5E7EB",
            padding: "1px 7px", borderRadius: 999,
          }}>
            {market.description}
          </span>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 12.5, fontWeight: 700, color: "#4B5563", fontVariantNumeric: "tabular-nums",
        }}>
          {formatVol(market.total_pool)} Vol.
          <ArrowUpDown size={12} strokeWidth={2.2} color="#9CA3AF" />
          {market.bettor_count > 0 && (
            <>
              <Users size={11} strokeWidth={2} color="#9CA3AF" />
              <span style={{ fontWeight: 600, color: "#9CA3AF" }}>{market.bettor_count.toLocaleString("es-MX")}</span>
            </>
          )}
          {countdown && (
            <>
              <Clock size={10} strokeWidth={2} color={urgency === "critical" ? "#EF4444" : urgency === "warning" ? "#F59E0B" : "#9CA3AF"} />
              <span style={{ fontWeight: 700, color: urgency === "critical" ? "#EF4444" : urgency === "warning" ? "#F59E0B" : "#9CA3AF" }}>
                {countdown.display}
              </span>
            </>
          )}
        </span>

        <div style={{ display: "flex", gap: 2 }}>
          <button
            onClick={handleShare}
            title="Copiar enlace"
            style={{ padding: 6, borderRadius: 8, background: "transparent", border: 0, cursor: "pointer", color: copied ? "#10B981" : "#D1D5DB", display: "inline-flex" }}
          >
            {copied ? <Check size={15} strokeWidth={2.5} /> : <Share2 size={15} strokeWidth={2} />}
          </button>
          {onToggleSave && (
            <button
              onClick={(e) => onToggleSave(market.id, e)}
              title={isSaved ? "Quitar de guardados" : "Guardar"}
              style={{ padding: 6, borderRadius: 8, background: "transparent", border: 0, cursor: "pointer", color: isSaved ? "#F59E0B" : "#D1D5DB", display: "inline-flex" }}
            >
              <Bookmark size={15} strokeWidth={2} fill={isSaved ? "#F59E0B" : "none"} />
            </button>
          )}
        </div>
        </div>
      </footer>
      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title={market.title}
        yesPercent={market.yes_percent ?? 50}
        marketId={market.id}
        slug={market.slug}
      />
    </div>
  );
});
