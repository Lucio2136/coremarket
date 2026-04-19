import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Leader {
  id:         string;
  username:   string | null;
  total_won:  number;
  total_bet:  number;
  avatar_color?: string | null;
}

const MEDAL = ["🥇", "🥈", "🥉"];

function initials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function formatMXN(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

const AVATAR_COLORS = [
  { bg: "#0f172a", fg: "#f8fafc" }, { bg: "#1e3a5f", fg: "#e0f2fe" },
  { bg: "#14532d", fg: "#dcfce7" }, { bg: "#3b0764", fg: "#f3e8ff" },
  { bg: "#431407", fg: "#fef3c7" }, { bg: "#172554", fg: "#dbeafe" },
];

function avatarColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export function LeaderboardWidget() {
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, username, total_won, total_bet, avatar_color")
      .gt("total_won", 0)
      .order("total_won", { ascending: false })
      .limit(5)
      .then(({ data }) => {
        setLeaders((data as Leader[]) ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <div style={{
      background: "#fff", border: "1px solid #EEF0F3", borderRadius: 16,
      overflow: "hidden", boxShadow: "0 1px 3px rgba(15,23,42,.05)",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 14px 8px", borderBottom: "1px solid #F3F4F6" }}>
        <Trophy size={12} color="#F59E0B" />
        <span style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: ".07em" }}>
          Top ganadores
        </span>
      </div>

      {loading ? (
        Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", borderBottom: i < 4 ? "1px solid #F3F4F6" : 0 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "#F3F4F6" }} />
            <div style={{ flex: 1 }}>
              <div style={{ height: 9, background: "#F3F4F6", borderRadius: 5, width: "60%", marginBottom: 5 }} />
              <div style={{ height: 8, background: "#F3F4F6", borderRadius: 5, width: "40%" }} />
            </div>
          </div>
        ))
      ) : leaders.length === 0 ? (
        <div style={{ padding: "20px 14px", textAlign: "center", fontSize: 12, color: "#9CA3AF" }}>
          Aún no hay ganadores
        </div>
      ) : (
        <>
          {/* Cabecera de columnas */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, padding: "5px 14px 4px", borderBottom: "1px solid #F3F4F6" }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: ".07em", textAlign: "right" }}>Ganado</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: ".07em", textAlign: "right" }}>Apostado</span>
          </div>

          {leaders.map((l, i) => {
            const ac     = avatarColor(l.id);
            const profit = l.total_won - l.total_bet;
            return (
              <div
                key={l.id}
                style={{
                  padding: "8px 14px",
                  borderBottom: i < leaders.length - 1 ? "1px solid #F3F4F6" : 0,
                  background: i === 0 ? "linear-gradient(90deg,#FFFBEB 0%,#fff 100%)" : "transparent",
                }}
              >
                {/* Fila superior: medal + avatar + nombre */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                  <span style={{ fontSize: 13, width: 16, flexShrink: 0, textAlign: "center", lineHeight: 1 }}>
                    {i < 3 ? MEDAL[i] : <span style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF" }}>#{i+1}</span>}
                  </span>
                  <div style={{
                    width: 22, height: 22, borderRadius: 7, flexShrink: 0,
                    background: ac.bg, color: ac.fg,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 8, fontWeight: 800,
                  }}>
                    {initials(l.username)}
                  </div>
                  <span style={{ flex: 1, fontSize: 11.5, fontWeight: 700, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {l.username ?? "Anónimo"}
                  </span>
                </div>

                {/* Fila inferior: dos columnas de stats */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, paddingLeft: 22 }}>
                  {/* Ganado */}
                  <div style={{ background: "#F0FDF4", borderRadius: 7, padding: "4px 7px", textAlign: "right" }}>
                    <p style={{ margin: 0, fontSize: 11.5, fontWeight: 800, color: "#059669", fontVariantNumeric: "tabular-nums" }}>
                      {formatMXN(l.total_won)}
                    </p>
                    {profit > 0 && (
                      <p style={{ margin: 0, fontSize: 9, fontWeight: 600, color: "#10B981", fontVariantNumeric: "tabular-nums" }}>
                        +{formatMXN(profit)}
                      </p>
                    )}
                  </div>
                  {/* Apostado */}
                  <div style={{ background: "#F8FAFC", borderRadius: 7, padding: "4px 7px", textAlign: "right" }}>
                    <p style={{ margin: 0, fontSize: 11.5, fontWeight: 700, color: "#374151", fontVariantNumeric: "tabular-nums" }}>
                      {formatMXN(l.total_bet)}
                    </p>
                    <p style={{ margin: 0, fontSize: 9, fontWeight: 500, color: "#9CA3AF" }}>invertido</p>
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
