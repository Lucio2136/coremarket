import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface PricePoint {
  yes_percent: number;
  recorded_at: string;
}

export function usePriceHistory(marketId: string | undefined) {
  const [history, setHistory] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!marketId) return;
    setLoading(true);

    supabase
      .from("market_price_history")
      .select("yes_percent, recorded_at")
      .eq("market_id", marketId)
      .order("recorded_at", { ascending: true })
      .limit(300)
      .then(({ data }) => {
        setHistory(data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    const channel = supabase
      .channel(`price-history-${marketId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "market_price_history",
        filter: `market_id=eq.${marketId}`,
      }, (payload) => {
        setHistory((prev) => [...prev, payload.new as PricePoint]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [marketId]);

  return { history, loading };
}
