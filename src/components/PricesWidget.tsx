import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, RefreshCw, WifiOff } from "lucide-react";

interface PriceData {
  mxn:            number;
  usd_24h_change: number;
}

interface Prices {
  bitcoin:  PriceData | null;
  ethereum: PriceData | null;
  usdmxn:   number    | null;
}

async function fetchUsdMxn(): Promise<number | null> {
  const apis = [
    async () => {
      const r = await fetch("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(10_000) });
      const j = await r.json();
      return j.rates?.MXN ?? null;
    },
    async () => {
      const r = await fetch("https://api.frankfurter.app/latest?from=USD&to=MXN", { signal: AbortSignal.timeout(10_000) });
      const j = await r.json();
      return j.rates?.MXN ?? null;
    },
  ];
  for (const fn of apis) {
    try {
      const v = await fn();
      if (v) return v;
    } catch { /* siguiente */ }
  }
  return null;
}

async function loadPrices(): Promise<Prices> {
  const [krakenRes, usdmxn] = await Promise.all([
    fetch("https://api.kraken.com/0/public/Ticker?pair=XBTUSD,ETHUSD", {
      signal: AbortSignal.timeout(12_000),
    }).then(r => r.json()).catch(() => null),
    fetchUsdMxn(),
  ]);

  let bitcoin:  PriceData | null = null;
  let ethereum: PriceData | null = null;
  const rate = usdmxn ?? 17.5;

  if (krakenRes?.result) {
    const btc = krakenRes.result.XXBTZUSD;
    const eth = krakenRes.result.XETHZUSD;
    if (btc) {
      const price = parseFloat(btc.c[0]);
      const open  = parseFloat(btc.o);
      bitcoin = { mxn: price * rate, usd_24h_change: ((price - open) / open) * 100 };
    }
    if (eth) {
      const price = parseFloat(eth.c[0]);
      const open  = parseFloat(eth.o);
      ethereum = { mxn: price * rate, usd_24h_change: ((price - open) / open) * 100 };
    }
  }

  if (!bitcoin && !ethereum && !usdmxn) throw new Error("no data");

  return { bitcoin, ethereum, usdmxn };
}

function fmtMXN(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const COINS = [
  { key: "bitcoin"  as const, label: "Bitcoin",  symbol: "BTC", img: "https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/btc.svg", bg: "#FFF7ED" },
  { key: "ethereum" as const, label: "Ethereum", symbol: "ETH", img: "https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/eth.svg", bg: "#EFF6FF" },
];

export function PricesWidget() {
  const [prices,  setPrices]  = useState<Prices>({ bitcoin: null, ethereum: null, usdmxn: null });
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);
  const [refresh, setRefresh] = useState(false);

  const load = async () => {
    setRefresh(true);
    setError(false);
    try {
      const p = await loadPrices();
      setPrices(p);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefresh(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{
      background: "#fff", border: "1px solid #EEF0F3", borderRadius: 16,
      overflow: "hidden", boxShadow: "0 1px 3px rgba(15,23,42,.05)",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px 8px", borderBottom: "1px solid #F3F4F6" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: ".07em" }}>
          Mercados · MXN
        </span>
        <button
          onClick={load}
          title="Actualizar"
          style={{ padding: 3, border: 0, background: "transparent", cursor: "pointer", color: "#9CA3AF", display: "flex" }}
        >
          <RefreshCw size={11} style={{ animation: refresh ? "spin 0.8s linear infinite" : "none" }} />
        </button>
      </div>

      {error ? (
        <div style={{ padding: "18px 14px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
          <WifiOff size={18} color="#D1D5DB" />
          <p style={{ margin: 0, fontSize: 11, color: "#9CA3AF" }}>No se pudo cargar</p>
          <button onClick={load} style={{ fontSize: 11, color: "#2563EB", background: "none", border: 0, cursor: "pointer", fontWeight: 600 }}>
            Reintentar
          </button>
        </div>
      ) : (
        <>
          {/* BTC + ETH en MXN */}
          {COINS.map((c) => {
            const data = prices[c.key];
            const up   = (data?.usd_24h_change ?? 0) >= 0;
            return (
              <div key={c.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 14px", borderBottom: "1px solid #F3F4F6" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: c.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                    <img src={c.img} alt={c.symbol} style={{ width: 20, height: 20, objectFit: "contain" }} />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#111827" }}>{c.label}</p>
                    <p style={{ margin: 0, fontSize: 10, color: "#9CA3AF" }}>{c.symbol} · MXN</p>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  {loading || !data ? (
                    <>
                      <div style={{ height: 11, width: 60, background: "#F3F4F6", borderRadius: 4, marginBottom: 4 }} />
                      <div style={{ height: 9,  width: 36, background: "#F3F4F6", borderRadius: 4 }} />
                    </>
                  ) : (
                    <>
                      <p style={{ margin: 0, fontSize: 12.5, fontWeight: 800, color: "#111827", fontVariantNumeric: "tabular-nums" }}>
                        {fmtMXN(data.mxn)}
                      </p>
                      <p style={{ margin: 0, fontSize: 10.5, fontWeight: 700, color: up ? "#059669" : "#DC2626", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 2 }}>
                        {up ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                        {up ? "+" : ""}{data.usd_24h_change.toFixed(2)}%
                      </p>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {/* USD / MXN */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: "#F0FDF4", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                <img src="https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/usd.svg" alt="USD" style={{ width: 20, height: 20, objectFit: "contain" }} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#111827" }}>Dólar</p>
                <p style={{ margin: 0, fontSize: 10, color: "#9CA3AF" }}>USD / MXN</p>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              {loading || !prices.usdmxn ? (
                <div style={{ height: 11, width: 70, background: "#F3F4F6", borderRadius: 4 }} />
              ) : (
                <p style={{ margin: 0, fontSize: 12.5, fontWeight: 800, color: "#111827", fontVariantNumeric: "tabular-nums" }}>
                  ${prices.usdmxn.toFixed(2)} MXN
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
