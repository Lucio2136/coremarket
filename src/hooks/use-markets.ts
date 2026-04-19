import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Market, supabase } from "@/lib/supabase";

export const useMarkets = () => {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  // Evita el flash de skeleton cuando ya hay datos en pantalla (ej. al hacer refetch manual)
  const hasDataRef = useRef(false);

  const fetchMarkets = useCallback(() => {
    if (!hasDataRef.current) setLoading(true);
    const headers = {
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    };
    const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/markets?status=eq.open&order=created_at.desc`;

    const optionsUrl = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/market_options?order=sort_order.asc`;

    Promise.all([
      fetch(`${baseUrl}&select=*`, { headers }).then((r) => r.json()),
      fetch(optionsUrl, { headers }).then((r) => r.json()),
    ])
      .then(([marketsData, optionsData]) => {
        if (!Array.isArray(marketsData)) { setError("Error cargando mercados"); return; }
        const opts: Record<string, any[]> = {};
        if (Array.isArray(optionsData)) {
          optionsData.forEach((o: any) => {
            if (!opts[o.market_id]) opts[o.market_id] = [];
            opts[o.market_id].push(o);
          });
        }
        setMarkets(marketsData.map((m: any) => ({ ...m, market_options: opts[m.id] ?? [] })));
        hasDataRef.current = true;
        setError(null);
      })
      .catch(() => setError("Error de conexion"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchMarkets();

    // Realtime: patch cuotas en vivo sin refrescar toda la lista
    channelRef.current = supabase
      .channel("markets-realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "markets" },
        (payload) => {
          const updated = payload.new as Market;
          setMarkets((prev) => {
            // Si el mercado fue cerrado, quitarlo de la lista
            if (updated.status !== "open") {
              return prev.filter((m) => m.id !== updated.id);
            }
            // Si ya estaba en lista, parcharlo; si no, ignorarlo
            const exists = prev.some((m) => m.id === updated.id);
            if (!exists) return prev;
            return prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m));
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "markets" },
        (payload) => {
          const inserted = payload.new as Market;
          if (inserted.status === "open") {
            setMarkets((prev) => [inserted, ...prev]);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "markets" },
        (payload) => {
          setMarkets((prev) => prev.filter((m) => m.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      channelRef.current?.unsubscribe();
    };
  }, [fetchMarkets]);

  const trendingMarkets = useMemo(
    () => markets.filter((m) => m.is_trending).slice(0, 3),
    [markets]
  );

  const closingMarkets = useMemo(
    () => [...markets]
      .sort((a, b) => new Date(a.closes_at).getTime() - new Date(b.closes_at).getTime())
      .slice(0, 3),
    [markets]
  );

  return { markets, trendingMarkets, closingMarkets, loading, error, refetch: fetchMarkets };
};