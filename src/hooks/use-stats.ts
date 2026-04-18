import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

export interface StatBet {
  id: string;
  amount: number;
  payout_amount: number | null;
  potential_payout: number | null;
  status: "won" | "lost" | "pending";
  side: "yes" | "no";
  odds_at_bet: number;
  created_at: string;
  markets: { title: string; category: string | null; subject_name: string } | null;
}

export interface DailyPnL {
  date: string;
  pnl: number;
  cumulative: number;
}

export interface CategoryStat {
  category: string;
  total: number;
  won: number;
  lost: number;
  pending: number;
  wagered: number;
  returned: number;
}

export function useStats() {
  const { user } = useAuth();
  const [bets, setBets]       = useState<StatBet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setBets([]); setLoading(false); return; }
    supabase
      .from("bets")
      .select("id, amount, payout_amount, potential_payout, status, side, odds_at_bet, created_at, markets(title, category, subject_name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        setBets((data as StatBet[]) ?? []);
        setLoading(false);
      });
  }, [user]);

  // ── Métricas clave ──────────────────────────────────────────────────────────
  const resolved  = bets.filter((b) => b.status !== "pending");
  const won       = bets.filter((b) => b.status === "won");
  const lost      = bets.filter((b) => b.status === "lost");

  const totalWagered  = bets.reduce((s, b) => s + b.amount, 0);
  const totalReturned = won.reduce((s, b) => s + (b.payout_amount ?? b.potential_payout ?? 0), 0);
  const netPnL        = totalReturned - won.reduce((s, b) => s + b.amount, 0) - lost.reduce((s, b) => s + b.amount, 0);
  const roi           = totalWagered > 0 ? ((totalReturned - totalWagered) / totalWagered) * 100 : 0;
  const winRate       = resolved.length > 0 ? (won.length / resolved.length) * 100 : 0;

  // Racha actual
  let streak = 0;
  for (const b of [...bets].reverse()) {
    if (b.status === "won") streak++;
    else if (b.status === "lost") break;
  }

  // Mejor racha histórica
  let bestStreak = 0, cur = 0;
  for (const b of bets) {
    if (b.status === "won") { cur++; bestStreak = Math.max(bestStreak, cur); }
    else if (b.status === "lost") cur = 0;
  }

  // ── Gráfica P&L acumulado por día ──────────────────────────────────────────
  const pnlByDay: Record<string, number> = {};
  for (const b of bets) {
    const day = b.created_at.slice(0, 10);
    if (!pnlByDay[day]) pnlByDay[day] = 0;
    if (b.status === "won") {
      pnlByDay[day] += (b.payout_amount ?? b.potential_payout ?? 0) - b.amount;
    } else if (b.status === "lost") {
      pnlByDay[day] -= b.amount;
    }
  }

  let cumulative = 0;
  const dailyPnL: DailyPnL[] = Object.entries(pnlByDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, pnl]) => {
      cumulative += pnl;
      return { date, pnl, cumulative };
    });

  // ── Stats por categoría ─────────────────────────────────────────────────────
  const catMap: Record<string, CategoryStat> = {};
  for (const b of bets) {
    const cat = b.markets?.category ?? "Otros";
    if (!catMap[cat]) catMap[cat] = { category: cat, total: 0, won: 0, lost: 0, pending: 0, wagered: 0, returned: 0 };
    catMap[cat].total++;
    catMap[cat].wagered += b.amount;
    if (b.status === "won")     { catMap[cat].won++;     catMap[cat].returned += b.payout_amount ?? b.potential_payout ?? 0; }
    else if (b.status === "lost")  catMap[cat].lost++;
    else                           catMap[cat].pending++;
  }
  const categoryStats = Object.values(catMap).sort((a, b) => b.total - a.total);

  // ── Mejores / peores mercados ───────────────────────────────────────────────
  const marketMap: Record<string, { title: string; pnl: number; count: number }> = {};
  for (const b of bets) {
    const key = b.markets?.title ?? b.id;
    if (!marketMap[key]) marketMap[key] = { title: key, pnl: 0, count: 0 };
    marketMap[key].count++;
    if (b.status === "won") marketMap[key].pnl += (b.payout_amount ?? b.potential_payout ?? 0) - b.amount;
    else if (b.status === "lost") marketMap[key].pnl -= b.amount;
  }
  const marketList = Object.values(marketMap).filter((m) => m.pnl !== 0).sort((a, b) => b.pnl - a.pnl);
  const bestMarkets  = marketList.slice(0, 3);
  const worstMarkets = [...marketList].reverse().slice(0, 3);

  return {
    bets, loading,
    totalWagered, totalReturned, netPnL, roi, winRate,
    streak, bestStreak,
    wonCount: won.length, lostCount: lost.length, pendingCount: bets.filter(b => b.status === "pending").length,
    dailyPnL, categoryStats,
    bestMarkets, worstMarkets,
  };
}
