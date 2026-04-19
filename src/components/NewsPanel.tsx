import { useEffect, useState } from "react";
import { ExternalLink, Newspaper, RefreshCw, WifiOff } from "lucide-react";

interface NewsItem {
  title: string;
  link:    string;
  pubDate: string;
  source:  string;
}

const CACHE_TTL = 15 * 60 * 1000; // 15 min

const TOPICS = [
  { label: "México",      q: "México noticias" },
  { label: "Política",    q: "política México" },
  { label: "Economía",    q: "economía México" },
  { label: "Deportes",    q: "deportes México" },
  { label: "Trump",       q: "Trump" },
  { label: "Tech / IA",   q: "inteligencia artificial tecnología" },
];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor(diff / 60_000);
  if (h >= 24) return `${Math.floor(h / 24)}d`;
  if (h >= 1)  return `${h}h`;
  if (m >= 1)  return `${m}m`;
  return "ahora";
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

async function fetchGoogleNews(query: string): Promise<NewsItem[]> {
  const url = `${SUPABASE_URL}/functions/v1/fetch-news?q=${encodeURIComponent(query)}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const xmlText = await res.text();
  const parser  = new DOMParser();
  const xml     = parser.parseFromString(xmlText, "text/xml");

  return Array.from(xml.querySelectorAll("item"))
    .slice(0, 6)
    .map((el) => ({
      title:   el.querySelector("title")?.textContent?.replace(/ - [^-]+$/, "") ?? "",
      link:    el.querySelector("link")?.textContent ?? "",
      pubDate: el.querySelector("pubDate")?.textContent ?? "",
      source:  el.querySelector("source")?.textContent ?? "",
    }))
    .filter((it) => it.title && it.link);
}

export function NewsPanel() {
  const [news, setNews]       = useState<NewsItem[]>([]);
  const [topic, setTopic]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  const load = async (idx: number, force = false) => {
    const cacheKey = `lucebase_news_${idx}`;
    const tsKey    = `lucebase_news_ts_${idx}`;

    if (!force) {
      try {
        const cached = localStorage.getItem(cacheKey);
        const ts     = localStorage.getItem(tsKey);
        if (cached && ts && Date.now() - parseInt(ts) < CACHE_TTL) {
          setNews(JSON.parse(cached));
          setLoading(false);
          setError(false);
          return;
        }
      } catch { /* ignore */ }
    }

    setLoading(true);
    setError(false);
    try {
      const items = await fetchGoogleNews(TOPICS[idx].q);
      setNews(items);
      localStorage.setItem(cacheKey, JSON.stringify(items));
      localStorage.setItem(tsKey, String(Date.now()));
    } catch {
      setError(true);
      setNews([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(topic); }, [topic]);

  return (
    <aside style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Newspaper size={13} color="#6B7280" />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Noticias</span>
        </div>
        <button
          onClick={() => load(topic, true)}
          title="Actualizar"
          style={{ padding: 4, border: 0, background: "transparent", cursor: "pointer", color: "#9CA3AF", display: "flex", borderRadius: 6 }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#4B5563"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#9CA3AF"; }}
        >
          <RefreshCw size={12} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
        </button>
      </div>

      {/* Topic pills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {TOPICS.map((t, i) => (
          <button
            key={i}
            onClick={() => setTopic(i)}
            style={{
              padding: "3px 9px", borderRadius: 999,
              border: `1.5px solid ${topic === i ? "#2563EB" : "#E5E7EB"}`,
              background:  topic === i ? "#EFF6FF" : "#F9FAFB",
              color:       topic === i ? "#1D4ED8" : "#6B7280",
              fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Card */}
      <div style={{
        background: "#fff", border: "1px solid #EEF0F3", borderRadius: 16,
        overflow: "hidden", boxShadow: "0 1px 3px rgba(15,23,42,.05)",
      }}>
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ padding: "11px 14px", borderBottom: i < 4 ? "1px solid #F3F4F6" : 0 }}>
              <div style={{ height: 9, background: "#F3F4F6", borderRadius: 5, marginBottom: 6, width: "88%" }} />
              <div style={{ height: 9, background: "#F3F4F6", borderRadius: 5, width: "55%" }} />
            </div>
          ))
        ) : error ? (
          <div style={{ padding: "22px 14px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <WifiOff size={20} color="#D1D5DB" />
            <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0 }}>Sin conexión a noticias</p>
            <button
              onClick={() => load(topic, true)}
              style={{ fontSize: 11, color: "#2563EB", background: "none", border: 0, cursor: "pointer", fontWeight: 600 }}
            >
              Reintentar
            </button>
          </div>
        ) : news.length === 0 ? (
          <div style={{ padding: "20px 14px", textAlign: "center", fontSize: 12, color: "#9CA3AF" }}>
            Sin noticias disponibles
          </div>
        ) : (
          news.map((item, i) => (
            <a
              key={i}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "block", padding: "10px 14px", textDecoration: "none",
                borderBottom: i < news.length - 1 ? "1px solid #F3F4F6" : 0,
                background: "transparent", transition: "background .1s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "#F9FAFB"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
            >
              <p style={{
                margin: 0, fontSize: 12, fontWeight: 600, color: "#111827", lineHeight: 1.35,
                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
              }}>
                {item.title}
              </p>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 5 }}>
                <span style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 500 }}>
                  {item.source}{item.source && item.pubDate ? " · " : ""}{item.pubDate ? timeAgo(item.pubDate) : ""}
                </span>
                <ExternalLink size={10} color="#D1D5DB" />
              </div>
            </a>
          ))
        )}
      </div>

      <p style={{ fontSize: 10, color: "#D1D5DB", textAlign: "center" }}>
        Google News · cache 15 min
      </p>
    </aside>
  );
}
