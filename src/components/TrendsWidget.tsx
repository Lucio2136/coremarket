import { useEffect, useState } from "react";
import { RefreshCw, ExternalLink } from "lucide-react";

interface Trend {
  title: string;
  traffic: string | null;
}

const RANK_COLORS = [
  { bg: "#FEF3C7", color: "#D97706", border: "#FDE68A" }, // 1
  { bg: "#F3F4F6", color: "#374151", border: "#E5E7EB" }, // 2
  { bg: "#FEF3C7", color: "#D97706", border: "#FDE68A" }, // 3 — bronze
];

export function TrendsWidget() {
  const [trends,   setTrends]   = useState<Trend[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [updated,  setUpdated]  = useState<Date | null>(null);

  const parseXml = (xml: string): Trend[] => {
    const parsed: Trend[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match: RegExpExecArray | null;
    while ((match = itemRegex.exec(xml)) !== null && parsed.length < 15) {
      const item = match[1];
      const titleMatch   = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ??
                           item.match(/<title>(.*?)<\/title>/);
      const trafficMatch = item.match(/<ht:approx_traffic>(.*?)<\/ht:approx_traffic>/);
      if (titleMatch) {
        parsed.push({
          title:   titleMatch[1].trim(),
          traffic: trafficMatch ? trafficMatch[1].trim() : null,
        });
      }
    }
    return parsed;
  };

  const load = async () => {
    setSpinning(true);
    setError(false);
    try {
      const TARGET = "https://trends.google.com/trends/trendingsearches/daily/rss?geo=MX";

      const PROXIES: (() => Promise<string>)[] = [
        async () => {
          const r = await fetch(`https://corsproxy.io/?${encodeURIComponent(TARGET)}`, { signal: AbortSignal.timeout(10_000) });
          if (!r.ok) throw new Error("corsproxy fail");
          return r.text();
        },
        async () => {
          const r = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(TARGET)}`, { signal: AbortSignal.timeout(10_000) });
          if (!r.ok) throw new Error("allorigins fail");
          const j = await r.json();
          return j.contents ?? "";
        },
        async () => {
          const r = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(TARGET)}`, { signal: AbortSignal.timeout(10_000) });
          if (!r.ok) throw new Error("codetabs fail");
          return r.text();
        },
      ];

      let xml = "";
      for (const proxy of PROXIES) {
        try { xml = await proxy(); if (xml.includes("<item>")) break; } catch { /* siguiente */ }
      }
      if (!xml.includes("<item>")) throw new Error("all proxies failed");

      const parsed = parseXml(xml);
      if (parsed.length === 0) throw new Error("no items parsed");
      setTrends(parsed);
      setUpdated(new Date());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setSpinning(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 15 * 60 * 1000); // cada 15 min
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{
      background: "#fff",
      border: "1px solid #EEF0F3",
      borderRadius: 16,
      overflow: "hidden",
      boxShadow: "0 1px 3px rgba(15,23,42,.05)",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px 8px",
        borderBottom: "1px solid #F3F4F6",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13 }}>🔥</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: ".07em" }}>
            Tendencias · México
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {updated && !loading && (
            <span style={{ fontSize: 9, color: "#D1D5DB" }}>
              {updated.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <button
            onClick={load}
            title="Actualizar"
            style={{ padding: 3, border: 0, background: "transparent", cursor: "pointer", color: "#9CA3AF", display: "flex" }}
          >
            <RefreshCw size={11} style={{ animation: spinning ? "spin 0.8s linear infinite" : "none" }} />
          </button>
        </div>
      </div>

      {error ? (
        <div style={{ padding: "16px 14px", textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 11, color: "#9CA3AF" }}>No se pudo cargar</p>
          <button onClick={load} style={{ fontSize: 11, color: "#2563EB", background: "none", border: 0, cursor: "pointer", fontWeight: 600, marginTop: 4 }}>
            Reintentar
          </button>
        </div>
      ) : loading ? (
        <div style={{ padding: "6px 0" }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 14px" }}>
              <div style={{ width: 18, height: 18, borderRadius: 5, background: "#F3F4F6", flexShrink: 0 }} />
              <div style={{ height: 10, background: "#F3F4F6", borderRadius: 4, width: `${50 + Math.random() * 40}%` }} />
            </div>
          ))}
        </div>
      ) : (
        <div>
          {trends.map((t, i) => {
            const isTop = i < 3;
            const rankStyle = i === 0
              ? { bg: "#FFF7ED", color: "#EA580C", border: "#FED7AA" }
              : i === 1
              ? { bg: "#F8FAFC", color: "#475569", border: "#E2E8F0" }
              : i === 2
              ? { bg: "#FFFBEB", color: "#B45309", border: "#FDE68A" }
              : { bg: "transparent", color: "#9CA3AF", border: "transparent" };

            return (
              <a
                key={i}
                href={`https://trends.google.com/trends/explore?q=${encodeURIComponent(t.title)}&geo=MX`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "7px 14px",
                  borderBottom: i < trends.length - 1 ? "1px solid #F9FAFB" : "none",
                  textDecoration: "none",
                  cursor: "pointer",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "#F9FAFB"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                  <span style={{
                    width: 20, height: 20, borderRadius: 6,
                    background: rankStyle.bg,
                    color: rankStyle.color,
                    border: `1px solid ${rankStyle.border}`,
                    fontSize: 10, fontWeight: 800,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    {i + 1}
                  </span>
                  <span style={{
                    fontSize: 12, fontWeight: isTop ? 700 : 500,
                    color: "#111827",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {t.title}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                  {t.traffic && (
                    <span style={{ fontSize: 9, color: "#9CA3AF", whiteSpace: "nowrap" }}>
                      {t.traffic}
                    </span>
                  )}
                  <ExternalLink size={9} color="#D1D5DB" />
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
