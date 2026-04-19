import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Flame, Users, ChevronRight } from "lucide-react";
import { Market } from "@/lib/supabase";

// ─── Category themes ─────────────────────────────────────────────────────────
const CAT_THEME: Record<string, { grad: string; accent: string }> = {
  "Deportes":        { grad: "linear-gradient(135deg,#0f2027 0%,#203a43 50%,#2c5364 100%)", accent: "#60a5fa" },
  "Política":        { grad: "linear-gradient(135deg,#1a0000 0%,#3d0000 50%,#5c1010 100%)", accent: "#f87171" },
  "Economía":        { grad: "linear-gradient(135deg,#022c22 0%,#064e3b 50%,#065f46 100%)", accent: "#34d399" },
  "Entretenimiento": { grad: "linear-gradient(135deg,#1a0332 0%,#3b0764 50%,#4c1d95 100%)", accent: "#c084fc" },
  "Tecnología":      { grad: "linear-gradient(135deg,#0c1445 0%,#1e3a8a 50%,#1d4ed8 100%)", accent: "#93c5fd" },
  "Finanzas":        { grad: "linear-gradient(135deg,#0c2340 0%,#1e3a5f 50%,#1e4976 100%)", accent: "#fbbf24" },
};
const DEFAULT_THEME = { grad: "linear-gradient(135deg,#0f172a 0%,#1e293b 50%,#334155 100%)", accent: "#94a3b8" };

function theme(cat?: string | null) {
  return (cat && CAT_THEME[cat]) ?? DEFAULT_THEME;
}

function formatVol(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n || 0}`;
}

// ─── Component ───────────────────────────────────────────────────────────────
export function FeaturedSection({ markets }: { markets: Market[] }) {
  const navigate = useNavigate();
  const [idx, setIdx] = useState(0);

  const featuredList = useMemo(() => {
    const open     = markets.filter(m => m.status === "open");
    const trending = open.filter(m => m.is_trending);
    const hot      = open.filter(m => !m.is_trending).sort((a, b) => (b.bettor_count ?? 0) - (a.bettor_count ?? 0));
    return [...trending, ...hot].slice(0, 5);
  }, [markets]);

  const safeIdx = Math.min(idx, Math.max(0, featuredList.length - 1));
  const feat    = featuredList[safeIdx];

  const breaking = useMemo(() => markets
    .filter(m => m.status === "open" && m.id !== feat?.id)
    .sort((a, b) => (b.bettor_count ?? 0) - (a.bettor_count ?? 0))
    .slice(0, 3),
  [markets, feat]);

  const categories = useMemo(() => {
    const map = new Map<string, { count: number; pool: number }>();
    markets.forEach(m => {
      if (!m.category) return;
      const cur = map.get(m.category) ?? { count: 0, pool: 0 };
      map.set(m.category, { count: cur.count + 1, pool: cur.pool + (m.total_pool ?? 0) });
    });
    return [...map.entries()].sort((a, b) => b[1].pool - a[1].pool).slice(0, 5);
  }, [markets]);

  if (!feat) return null;

  const th    = theme(feat.category);
  const yesP  = feat.yes_percent ?? 50;
  const noP   = feat.no_percent  ?? (100 - yesP);

  return (
    <div style={{ display: "flex", gap: 14, alignItems: "stretch" }}>

      {/* ── Featured card ── */}
      <div
        onClick={() => navigate(`/market/${feat.id}`)}
        style={{
          flex: "0 0 auto", width: "58%",
          background: th.grad,
          borderRadius: 20, padding: "26px 26px 18px",
          display: "flex", flexDirection: "column", gap: 14,
          cursor: "pointer", position: "relative", overflow: "hidden",
          minHeight: 290, boxShadow: "0 4px 28px rgba(0,0,0,.2)",
        }}
      >
        {/* Glow blob */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: `radial-gradient(circle at 75% 25%, ${th.accent}1a 0%, transparent 55%)` }} />

        {/* Badges */}
        <div style={{ display: "flex", alignItems: "center", gap: 7, position: "relative" }}>
          {feat.category && (
            <span style={{ fontSize: 10, fontWeight: 700, color: th.accent, background: `${th.accent}22`, border: `1px solid ${th.accent}44`, padding: "3px 10px", borderRadius: 999, textTransform: "uppercase", letterSpacing: ".05em" }}>
              {feat.category}
            </span>
          )}
          {feat.is_trending && (
            <span style={{ fontSize: 10, fontWeight: 700, color: "#EF4444", background: "#EF444422", border: "1px solid #EF444444", padding: "3px 10px", borderRadius: 999, display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#EF4444", display: "inline-block", animation: "pulse 1.5s ease-in-out infinite" }} />
              LIVE
            </span>
          )}
        </div>

        {/* Title */}
        <p style={{ margin: 0, fontSize: 21, fontWeight: 800, color: "#fff", lineHeight: 1.25, letterSpacing: "-0.02em", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", position: "relative" }}>
          {feat.title}
        </p>

        {/* Probability */}
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontSize: 46, fontWeight: 900, color: th.accent, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
              {yesP.toFixed(0)}%
            </span>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,.45)", fontWeight: 500 }}>probabilidad Sí</span>
          </div>
          <div style={{ height: 4, background: "rgba(255,255,255,.1)", borderRadius: 4, marginTop: 10, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${yesP}%`, background: th.accent, borderRadius: 4 }} />
          </div>
        </div>

        {/* Bet buttons */}
        <div style={{ display: "flex", gap: 10, position: "relative" }}>
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/market/${feat.id}?side=yes`); }}
            style={{ flex: 1, height: 44, borderRadius: 12, border: 0, cursor: "pointer", background: "#10B981", color: "#fff", fontSize: 14, fontWeight: 800, boxShadow: "0 4px 14px rgba(16,185,129,.4)" }}
          >
            Sí · {yesP.toFixed(0)}¢
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/market/${feat.id}?side=no`); }}
            style={{ flex: 1, height: 44, borderRadius: 12, border: 0, cursor: "pointer", background: "#F43F5E", color: "#fff", fontSize: 14, fontWeight: 800, boxShadow: "0 4px 14px rgba(244,63,94,.4)" }}
          >
            No · {noP.toFixed(0)}¢
          </button>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", marginTop: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,.4)", fontWeight: 500 }}>Vol {formatVol(feat.total_pool ?? 0)} MXN</span>
            {(feat.bettor_count ?? 0) > 0 && (
              <span style={{ fontSize: 11, color: "rgba(255,255,255,.4)", display: "flex", alignItems: "center", gap: 4 }}>
                <Users size={10} /> {feat.bettor_count}
              </span>
            )}
          </div>
          {/* Carousel dots */}
          <div style={{ display: "flex", gap: 5 }}>
            {featuredList.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setIdx(i); }}
                style={{ width: i === safeIdx ? 18 : 6, height: 6, borderRadius: 3, border: 0, cursor: "pointer", background: i === safeIdx ? "#fff" : "rgba(255,255,255,.3)", padding: 0, transition: "width .2s" }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panels ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>

        {/* Mercados destacados */}
        <div style={{ background: "#fff", border: "1px solid #EEF0F3", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(15,23,42,.05)", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px 8px", borderBottom: "1px solid #F3F4F6" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: ".07em" }}>Noticias de última hora</span>
            <ChevronRight size={13} color="#D1D5DB" />
          </div>
          {breaking.map((m, i) => (
            <div
              key={m.id}
              onClick={() => navigate(`/market/${m.id}`)}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", borderBottom: i < breaking.length - 1 ? "1px solid #F3F4F6" : 0, cursor: "pointer" }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "#F9FAFB"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
            >
              <span style={{ fontSize: 10, fontWeight: 700, color: "#D1D5DB", width: 14, flexShrink: 0 }}>{i + 1}</span>
              <p style={{ flex: 1, margin: 0, fontSize: 11.5, fontWeight: 600, color: "#111827", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {m.title}
              </p>
              <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 6 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#059669", fontVariantNumeric: "tabular-nums" }}>{(m.yes_percent ?? 50).toFixed(0)}%</p>
                <p style={{ margin: 0, fontSize: 9.5, color: "#10B981", fontWeight: 600 }}>↑ Sí</p>
              </div>
            </div>
          ))}
          {breaking.length === 0 && (
            <p style={{ padding: "16px 14px", margin: 0, fontSize: 12, color: "#9CA3AF", textAlign: "center" }}>Sin mercados destacados</p>
          )}
        </div>

        {/* Temas populares */}
        <div style={{ background: "#fff", border: "1px solid #EEF0F3", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(15,23,42,.05)", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px 8px", borderBottom: "1px solid #F3F4F6" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: ".07em" }}>Temas populares</span>
            <Flame size={11} color="#F59E0B" />
          </div>
          {categories.map(([cat, { count, pool }], i) => {
            const cs = theme(cat);
            return (
              <div
                key={cat}
                onClick={() => navigate(`/?cat=${encodeURIComponent(cat)}`)}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 14px", borderBottom: i < categories.length - 1 ? "1px solid #F3F4F6" : 0, cursor: "pointer" }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "#F9FAFB"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
              >
                <span style={{ fontSize: 10, fontWeight: 700, color: "#D1D5DB", width: 14, flexShrink: 0 }}>{i + 1}</span>
                <div style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0, background: cs.grad, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 8, fontWeight: 900, color: cs.accent }}>{cat.slice(0, 2).toUpperCase()}</span>
                </div>
                <span style={{ flex: 1, fontSize: 11.5, fontWeight: 600, color: "#111827" }}>{cat}</span>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#374151", fontVariantNumeric: "tabular-nums" }}>{formatVol(pool)} hoy</p>
                  <p style={{ margin: 0, fontSize: 9.5, color: "#9CA3AF" }}>{count} mercado{count !== 1 ? "s" : ""}</p>
                </div>
                <Flame size={10} color="#F59E0B" style={{ flexShrink: 0 }} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
