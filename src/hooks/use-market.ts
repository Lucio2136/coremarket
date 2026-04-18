import { useEffect, useState, useRef } from "react";
import { Market, supabase } from "@/lib/supabase";

export function useMarket(id: string | undefined) {
  const [market, setMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    const headers = {
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    };
    const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/markets?id=eq.${id}&limit=1`;
    const optionsUrl = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/market_options?market_id=eq.${id}&order=sort_order.asc`;

    // Carga mercado + opciones en paralelo
    Promise.all([
      fetch(`${baseUrl}&select=*`, { headers }).then((r) => r.json()),
      fetch(optionsUrl, { headers }).then((r) => r.json()),
    ])
      .then(([marketData, optionsData]) => {
        const m = Array.isArray(marketData) ? marketData[0] : null;
        if (!m) { setError("Mercado no encontrado"); return; }
        const opts = Array.isArray(optionsData) ? optionsData : [];
        setMarket({ ...m, market_options: opts });
        setError(null);
      })
      .catch(() => setError("Error de conexión"))
      .finally(() => setLoading(false));

    // Realtime: parchar cuotas en vivo
    channelRef.current = supabase
      .channel(`market-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "markets", filter: `id=eq.${id}` },
        (payload) => {
          setMarket((prev) => prev ? { ...prev, ...(payload.new as Market) } : prev);
        }
      )
      .subscribe();

    return () => {
      channelRef.current?.unsubscribe();
    };
  }, [id]);

  return { market, setMarket, loading, error };
}
