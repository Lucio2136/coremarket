import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Flame, ChevronLeft, ChevronRight, Bookmark, TrendingUp, TrendingDown } from "lucide-react";
import { Market } from "@/lib/supabase";

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatVol(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n || 0}`;
}

// Genera curva de probabilidad histórica plausible
function genProbHistory(yesP: number, seed: number, points = 24): number[] {
  const start = 35 + ((seed * 37) % 30);
  return Array.from({ length: points }, (_, i) => {
    const p = i / (points - 1);
    const base = start + (yesP - start) * Math.pow(p, 1.2);
    const noise = Math.sin(i * 1.9 + seed) * 4 + Math.cos(i * 3.1 + seed) * 2.5;
    return Math.max(4, Math.min(96, base + noise));
  });
}

// Sparkline de probabilidad
function ProbChart({ data, accent }: { data: number[]; accent: string }) {
  const W = 260, H = 90, PAD = 6;
  const min = Math.min(...data) - 5;
  const max = Math.max(...data) + 5;
  const range = max - min || 1;
  const x = (i: number) => PAD + (i / (data.length - 1)) * (W - PAD * 2);
  const y = (v: number) => H - PAD - ((v - min) / range) * (H - PAD * 2);
  const pts = data.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const last = data[data.length - 1];
  const prev = data[data.length - 2];
  const up = last >= prev;

  return (
    <svg width={W} height={H} style={{ overflow: "visible", display: "block" }}>
      <defs>
        <linearGradient id="probGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={accent} stopOpacity={0.12} />
          <stop offset="100%" stopColor={accent} stopOpacity={0}    />
        </linearGradient>
      </defs>
      {/* Grid lines */}
      {[25, 50, 75].map(pct => {
        const yy = y(pct);
        return (
          <g key={pct}>
            <line x1={0} y1={yy} x2={W} y2={yy} stroke="#F3F4F6" strokeWidth={1} />
            <text x={W - 2} y={yy - 2} fontSize={8} fill="#D1D5DB" textAnchor="end">{pct}%</text>
          </g>
        );
      })}
      <path
        d={`M ${data.map((v, i) => `${x(i)},${y(v)}`).join(" L ")} L ${x(data.length - 1)},${H} L ${x(0)},${H} Z`}
        fill="url(#probGrad)"
      />
      <polyline points={pts} fill="none" stroke={accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(data.length - 1)} cy={y(last)} r={4} fill={accent} />
    </svg>
  );
}

// ── Article row (noticias embed) ──────────────────────────────────────────────
interface Article { title: string; source: string; pubDate?: string }

function ArticleRow({ a }: { a: Article }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 0" }}>
      <div style={{ width: 28, height: 16, borderRadius: 3, background: "#F3F4F6", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 7, fontWeight: 800, color: "#6B7280", textTransform: "uppercase" }}>
          {(a.source ?? "").slice(0, 3)}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 11, color: "#374151", lineHeight: 1.35, flex: 1, display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {a.title}
      </p>
    </div>
  );
}

// ── Category accent colors ────────────────────────────────────────────────────
const CAT_COLOR: Record<string, string> = {
  Deportes:        "#3B82F6",
  Política:        "#EF4444",
  Economía:        "#10B981",
  Entretenimiento: "#8B5CF6",
  Finanzas:        "#F59E0B",
  Tecnología:      "#06B6D4",
  Cultura:         "#EC4899",
  Elecciones:      "#F97316",
};

// ── Main component ────────────────────────────────────────────────────────────
export function FeaturedSection({ markets }: { markets: Market[] }) {
  const navigate = useNavigate();
  const [idx,  setIdx]  = useState(0);
  const [news, setNews] = useState<Article[]>([]);

  const featuredList = useMemo(() => {
    const open     = markets.filter(m => m.status === "open");
    const trending = open.filter(m => m.is_trending);
    const hot      = open.filter(m => !m.is_trending)
                         .sort((a, b) => (b.bettor_count ?? 0) - (a.bettor_count ?? 0));
    return [...trending, ...hot].slice(0, 6);
  }, [markets]);

  const safeIdx = Math.min(idx, Math.max(0, featuredList.length - 1));
  const feat    = featuredList[safeIdx];

  const breaking = useMemo(() =>
    markets.filter(m => m.status === "open" && m.id !== feat?.id)
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

  // Fetch noticias relacionadas al mercado actual
  useEffect(() => {
    if (!feat) return;
    const q = encodeURIComponent(feat.subject_name || feat.title.slice(0, 40));
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-news?q=${q}`;
    fetch(url, {
      headers: {
        apikey:        import.meta.env.VITE_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
    })
      .then(r => r.json())
      .then(d => setNews((d.articles ?? []).slice(0, 4)))
      .catch(() => setNews([]));
  }, [feat?.id]);

  if (!feat) return null;

  const yesP    = feat.yes_percent ?? 50;
  const noP     = 100 - yesP;
  const accent  = CAT_COLOR[feat.category ?? ""] ?? "#2563EB";
  const seed    = feat.id ? feat.id.charCodeAt(0) + feat.id.charCodeAt(feat.id.length - 1) : 42;
  const history = genProbHistory(yesP, seed);
  const prevVal = history[history.length - 2];
  const pctChange = yesP - prevVal;
  const up      = pctChange >= 0;

  const prev = featuredList[safeIdx - 1];
  const next = featuredList[safeIdx + 1];

  return (
    <div style={{ display: "flex", gap: 14, alignItems: "stretch" }}>

      {/* ── Left: Featured card ───────────────────────────────────────────── */}
      <div style={{
        flex: "0 0 auto", width: "59%",
        background: "#fff",
        border: "1px solid #E5E7EB",
        borderRadius: 20,
        overflow: "hidden",
        boxShadow: "0 2px 16px rgba(0,0,0,.06)",
        display: "flex", flexDirection: "column",
        minHeight: 320,
      }}>
        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px 10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {feat.subject_photo_url && (
              <img src={feat.subject_photo_url} alt="" style={{ width: 34, height: 34, borderRadius: 8, objectFit: "cover", border: "1px solid #F3F4F6" }} />
            )}
            <div>
              <span style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 600 }}>
                {feat.category ?? "General"}
                {feat.description && feat.description.length <= 25 ? ` · ${feat.description}` : ""}
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {feat.is_trending && (
              <span style={{ fontSize: 9, fontWeight: 800, background: "#FEF2F2", color: "#EF4444", borderRadius: 20, padding: "2px 8px", display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#EF4444", display: "inline-block", animation: "pulse 1.5s ease-in-out infinite" }} />
                LIVE
              </span>
            )}
            <button style={{ border: 0, background: "transparent", cursor: "pointer", color: "#9CA3AF", padding: 2, display: "flex" }}>
              <Bookmark size={14} />
            </button>
          </div>
        </div>

        {/* Title */}
        <p style={{ margin: "0 18px 12px", fontSize: 16, fontWeight: 800, color: "#111827", lineHeight: 1.3, letterSpacing: "-0.01em", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {feat.title}
        </p>

        {/* Prob + chart */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "0 18px 10px", gap: 10 }}>
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 32, fontWeight: 900, color: accent, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                {yesP.toFixed(0)}%
              </span>
              <span style={{ fontSize: 12, color: "#6B7280", fontWeight: 500 }}>probabilidad</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
              {up ? <TrendingUp size={11} color="#10B981" /> : <TrendingDown size={11} color="#EF4444" />}
              <span style={{ fontSize: 11, fontWeight: 700, color: up ? "#10B981" : "#EF4444" }}>
                {up ? "+" : ""}{pctChange.toFixed(1)}%
              </span>
            </div>
          </div>
          <ProbChart data={history} accent={accent} />
        </div>

        {/* Sí / No buttons */}
        <div style={{ display: "flex", gap: 8, margin: "0 18px 12px" }}>
          <button
            onClick={() => navigate(`/market/${feat.id}?side=yes`)}
            style={{ flex: 1, height: 38, borderRadius: 10, cursor: "pointer", background: "#ECFDF5", color: "#059669", border: "1.5px solid #6EE7B7", fontSize: 13, fontWeight: 800 }}
          >
            Sí
          </button>
          <button
            onClick={() => navigate(`/market/${feat.id}?side=no`)}
            style={{ flex: 1, height: 38, borderRadius: 10, cursor: "pointer", background: "#FFF1F2", color: "#BE123C", border: "1.5px solid #FDA4AF", fontSize: 13, fontWeight: 800 }}
          >
            No
          </button>
        </div>

        {/* Noticias embed */}
        {news.length > 0 && (
          <div style={{ margin: "0 18px 10px", borderTop: "1px solid #F3F4F6", paddingTop: 8 }}>
            {news.map((a, i) => <ArticleRow key={i} a={a} />)}
          </div>
        )}

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 18px 14px", marginTop: "auto", borderTop: "1px solid #F9FAFB" }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF" }}>
            {formatVol(feat.total_pool ?? 0)} Vol
          </span>
          {/* Navigation */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button
              disabled={safeIdx === 0}
              onClick={() => setIdx(safeIdx - 1)}
              style={{ display: "flex", alignItems: "center", gap: 3, padding: "4px 8px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", cursor: safeIdx === 0 ? "not-allowed" : "pointer", color: safeIdx === 0 ? "#D1D5DB" : "#374151", fontSize: 10, fontWeight: 600 }}
            >
              <ChevronLeft size={11} />
              {prev ? prev.subject_name ?? "Anterior" : "Anterior"}
            </button>
            <button
              disabled={safeIdx >= featuredList.length - 1}
              onClick={() => setIdx(safeIdx + 1)}
              style={{ display: "flex", alignItems: "center", gap: 3, padding: "4px 8px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", cursor: safeIdx >= featuredList.length - 1 ? "not-allowed" : "pointer", color: safeIdx >= featuredList.length - 1 ? "#D1D5DB" : "#374151", fontSize: 10, fontWeight: 600 }}
            >
              {next ? next.subject_name ?? "Siguiente" : "Siguiente"}
              <ChevronRight size={11} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Right panels ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>

        {/* Noticias de última hora */}
        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.04)", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px 8px", borderBottom: "1px solid #F3F4F6" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#111827" }}>Noticias de última hora</span>
            <ChevronRight size={13} color="#D1D5DB" />
          </div>
          {breaking.map((m, i) => {
            const mUp = (m.yes_percent ?? 50) >= 50;
            return (
              <div
                key={m.id}
                onClick={() => navigate(`/market/${m.id}`)}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", borderBottom: i < breaking.length - 1 ? "1px solid #F9FAFB" : 0, cursor: "pointer" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#F9FAFB"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <span style={{ fontSize: 10, fontWeight: 800, color: "#D1D5DB", width: 12, flexShrink: 0 }}>{i + 1}</span>
                <p style={{ flex: 1, margin: 0, fontSize: 11, fontWeight: 600, color: "#111827", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {m.title}
                </p>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#111827", fontVariantNumeric: "tabular-nums" }}>
                    {(m.yes_percent ?? 50).toFixed(0)}%
                  </p>
                  <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: mUp ? "#10B981" : "#EF4444" }}>
                    {mUp ? "↑" : "↓"}{Math.abs((m.yes_percent ?? 50) - 50).toFixed(0)}%
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Temas populares */}
        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.04)", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px 8px", borderBottom: "1px solid #F3F4F6" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#111827" }}>Temas populares</span>
            <ChevronRight size={13} color="#D1D5DB" />
          </div>
          {categories.map(([cat, { count, pool }], i) => (
            <div
              key={cat}
              onClick={() => navigate(`/?cat=${encodeURIComponent(cat)}`)}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 14px", borderBottom: i < categories.length - 1 ? "1px solid #F9FAFB" : 0, cursor: "pointer" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#F9FAFB"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <span style={{ fontSize: 10, fontWeight: 800, color: "#D1D5DB", width: 12, flexShrink: 0 }}>{i + 1}</span>
              <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "#111827" }}>{cat}</span>
              <span style={{ fontSize: 10, color: "#6B7280", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                {formatVol(pool)} hoy
              </span>
              <Flame size={10} color="#F59E0B" style={{ flexShrink: 0 }} />
              <ChevronRight size={10} color="#D1D5DB" style={{ flexShrink: 0 }} />
            </div>
          ))}

          <div
            onClick={() => navigate("/")}
            style={{ padding: "10px 14px", borderTop: "1px solid #F3F4F6", cursor: "pointer", textAlign: "center" }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>Explorar todo</span>
          </div>
        </div>
      </div>
    </div>
  );
}
