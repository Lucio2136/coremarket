import { useEffect, useState, useRef } from "react";
import { Market, supabase } from "@/lib/supabase";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function useMarket(idOrSlug: string | undefined) {
  const [market, setMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!idOrSlug) return;

    setLoading(true);
    const headers = {
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    };

    const isUUID = UUID_RE.test(idOrSlug);
    const filter = isUUID ? `id=eq.${idOrSlug}` : `slug=eq.${idOrSlug}`;
    const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/markets?${filter}&limit=1`;

    const fetchMarket = () =>
      fetch(`${baseUrl}&select=*`, { headers })
        .then((r) => r.json())
        .then((data) => {
          const m = Array.isArray(data) ? data[0] : null;
          if (!m) { setError("Mercado no encontrado"); return null; }
          return m;
        });

    const fetchOptions = (marketId: string) =>
      fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/market_options?market_id=eq.${marketId}&order=sort_order.asc`,
        { headers }
      ).then((r) => r.json());

    fetchMarket()
      .then(async (m) => {
        if (!m) return;
        const opts = await fetchOptions(m.id);
        setMarket({ ...m, market_options: Array.isArray(opts) ? opts : [] });
        setError(null);

        // Realtime por UUID (siempre disponible)
        channelRef.current = supabase
          .channel(`market-${m.id}`)
          .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "markets", filter: `id=eq.${m.id}` },
            (payload) => {
              setMarket((prev) => prev ? { ...prev, ...(payload.new as Market) } : prev);
            }
          )
          .subscribe();
      })
      .catch(() => setError("Error de conexión"))
      .finally(() => setLoading(false));

    return () => {
      channelRef.current?.unsubscribe();
    };
  }, [idOrSlug]);

  return { market, setMarket, loading, error };
}
