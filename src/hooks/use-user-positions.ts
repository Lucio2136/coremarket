import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

export interface UserMarketPosition {
  side:   "yes" | "no";
  status: "pending" | "won" | "lost";
}

/**
 * Returns a Map<market_id, UserMarketPosition> for the current user.
 * When the user has multiple bets on the same market, the side with the
 * highest total amount invested wins. Status prefers "pending" > "won" > "lost".
 */
export function useUserPositions(): Map<string, UserMarketPosition> {
  const { user } = useAuth();
  const [positions, setPositions] = useState<Map<string, UserMarketPosition>>(new Map());

  useEffect(() => {
    if (!user) {
      setPositions(new Map());
      return;
    }

    supabase
      .from("bets")
      .select("market_id, side, status, amount")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (!data) return;

        const grouped = new Map<string, { yes: number; no: number; status: string }>();
        for (const b of data) {
          const entry = grouped.get(b.market_id) ?? { yes: 0, no: 0, status: "lost" };
          if (b.side === "yes") entry.yes += b.amount;
          else entry.no += b.amount;
          // Precedencia: pending > won > lost
          if (b.status === "pending") entry.status = "pending";
          else if (b.status === "won" && entry.status === "lost") entry.status = "won";
          grouped.set(b.market_id, entry);
        }

        const map = new Map<string, UserMarketPosition>();
        for (const [marketId, entry] of grouped) {
          map.set(marketId, {
            side:   entry.yes >= entry.no ? "yes" : "no",
            status: entry.status as UserMarketPosition["status"],
          });
        }
        setPositions(map);
      });

    // Actualizar en tiempo real cuando cambia una apuesta del usuario
    const channel = supabase
      .channel(`positions-${user.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "bets",
        filter: `user_id=eq.${user.id}`,
      }, async () => {
        const { data } = await supabase
          .from("bets")
          .select("market_id, side, status, amount")
          .eq("user_id", user.id);
        if (!data) return;
        const grouped = new Map<string, { yes: number; no: number; status: string }>();
        for (const b of data) {
          const entry = grouped.get(b.market_id) ?? { yes: 0, no: 0, status: "lost" };
          if (b.side === "yes") entry.yes += b.amount;
          else entry.no += b.amount;
          if (b.status === "pending") entry.status = "pending";
          else if (b.status === "won" && entry.status === "lost") entry.status = "won";
          grouped.set(b.market_id, entry);
        }
        const map = new Map<string, UserMarketPosition>();
        for (const [marketId, entry] of grouped) {
          map.set(marketId, {
            side:   entry.yes >= entry.no ? "yes" : "no",
            status: entry.status as UserMarketPosition["status"],
          });
        }
        setPositions(map);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  return positions;
}
