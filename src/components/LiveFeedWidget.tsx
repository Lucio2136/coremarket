import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Activity } from "lucide-react";

interface FeedItem {
  id:           string;
  username:     string | null;
  user_id:      string;
  market_title: string;
  side:         "yes" | "no";
  amount:       number;
  created_at:   string;
  isNew?:       boolean;
}

const PALETTE = [
  { bg: "#0f172a", fg: "#f8fafc" }, { bg: "#1e3a5f", fg: "#e0f2fe" },
  { bg: "#14532d", fg: "#dcfce7" }, { bg: "#3b0764", fg: "#f3e8ff" },
  { bg: "#431407", fg: "#fef3c7" }, { bg: "#172554", fg: "#dbeafe" },
];

function avatarColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}

function initials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(diff / 3_600_000);
  if (h >= 1)  return `${h}h`;
  if (m >= 1)  return `${m}m`;
  return "ahora";
}

function formatMXN(n: number) {
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

function mapRow(b: Record<string, unknown>): FeedItem {
  return {
    id:           b.id as string,
    username:     (b.profiles as { username?: string } | null)?.username ?? null,
    user_id:      b.user_id as string,
    market_title: (b.markets as { title?: string } | null)?.title ?? "Mercado",
    side:         b.side as "yes" | "no",
    amount:       b.amount as number,
    created_at:   b.created_at as string,
  };
}

export function LiveFeedWidget() {
  const [items,   setItems]   = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial load
    supabase
      .from("bets")
      .select("id, user_id, market_id, side, amount, created_at, profiles(username), markets(title)")
      .order("created_at", { ascending: false })
      .limit(12)
      .then(({ data }) => {
        if (data) setItems((data as Record<string, unknown>[]).map(mapRow));
        setLoading(false);
      });

    // Realtime feed
    const channel = supabase
      .channel("live-feed-bets")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bets" }, async (payload) => {
        const bet = payload.new as Record<string, unknown>;

        const [{ data: profile }, { data: market }] = await Promise.all([
          supabase.from("profiles").select("username").eq("id", bet.user_id as string).single(),
          supabase.from("markets").select("title").eq("id", bet.market_id as string).single(),
        ]);

        const item: FeedItem = {
          id:           bet.id as string,
          username:     profile?.username ?? null,
          user_id:      bet.user_id as string,
          market_title: market?.title ?? "Mercado",
          side:         bet.side as "yes" | "no",
          amount:       bet.amount as number,
          created_at:   bet.created_at as string,
          isNew:        true,
        };

        setItems(prev => [item, ...prev].slice(0, 15));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <div style={{
      background: "#fff", border: "1px solid #EEF0F3", borderRadius: 16,
      overflow: "hidden", boxShadow: "0 1px 3px rgba(15,23,42,.05)",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 14px 8px", borderBottom: "1px solid #F3F4F6" }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#EF4444", display: "inline-block", animation: "pulse 1.5s ease-in-out infinite", flexShrink: 0 }} />
        <Activity size={11} color="#EF4444" />
        <span style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: ".07em" }}>
          Actividad en vivo
        </span>
      </div>

      {loading ? (
        Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", borderBottom: i < 4 ? "1px solid #F3F4F6" : 0 }}>
            <div style={{ width: 26, height: 26, borderRadius: 8, background: "#F3F4F6", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ height: 8, background: "#F3F4F6", borderRadius: 5, width: "70%", marginBottom: 5 }} />
              <div style={{ height: 8, background: "#F3F4F6", borderRadius: 5, width: "50%" }} />
            </div>
          </div>
        ))
      ) : items.length === 0 ? (
        <div style={{ padding: "22px 14px", textAlign: "center", fontSize: 12, color: "#9CA3AF" }}>
          Aún no hay actividad
        </div>
      ) : (
        items.map((item, i) => {
          const ac  = avatarColor(item.user_id);
          const yes = item.side === "yes";
          return (
            <div
              key={item.id}
              style={{
                display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 14px",
                borderBottom: i < items.length - 1 ? "1px solid #F3F4F6" : 0,
                background: item.isNew ? "#FAFFF5" : "transparent",
                transition: "background .8s",
                animation: item.isNew ? "fadeIn .35s ease" : "none",
              }}
            >
              {/* Avatar */}
              <div style={{
                width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                background: ac.bg, color: ac.fg,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 8, fontWeight: 800,
              }}>
                {initials(item.username)}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#111827" }}>
                    {item.username ?? "Anónimo"}
                  </span>
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: "#fff", background: yes ? "#10B981" : "#F43F5E", borderRadius: 5, padding: "1px 6px" }}>
                    {yes ? "Sí" : "No"}
                  </span>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: yes ? "#059669" : "#E11D48", background: yes ? "#F0FDF4" : "#FFF1F2", borderRadius: 5, padding: "1px 6px" }}>
                    {formatMXN(item.amount)}
                  </span>
                </div>
                <p style={{ margin: "2px 0 0", fontSize: 10.5, color: "#6B7280", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {item.market_title}
                </p>
              </div>

              {/* Time */}
              <span style={{ fontSize: 9.5, color: "#D1D5DB", flexShrink: 0, marginTop: 1, fontWeight: 500 }}>
                {timeAgo(item.created_at)}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}
