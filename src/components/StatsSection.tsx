import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

// ── Sparkline SVG ────────────────────────────────────────────────────────────
function Sparkline({ data, up }: { data: number[]; up: boolean }) {
  if (data.length < 2) {
    return <div style={{ width: 88, height: 40 }} />;
  }
  const W = 88, H = 40, PAD = 3;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const x = (i: number) => (i / (data.length - 1)) * W;
  const y = (v: number) => H - PAD - ((v - min) / range) * (H - PAD * 2);
  const pts = data.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const color = up ? "#10B981" : "#EF4444";
  const id = `g${up ? "u" : "d"}${data.length}`;

  return (
    <svg width={W} height={H} style={{ overflow: "visible", display: "block" }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity={0.18} />
          <stop offset="100%" stopColor={color} stopOpacity={0}    />
        </linearGradient>
      </defs>
      <path
        d={`M ${data.map((v, i) => `${x(i)},${y(v)}`).join(" L ")} L ${W},${H} L 0,${H} Z`}
        fill={`url(#${id})`}
      />
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Dot final */}
      <circle
        cx={x(data.length - 1)}
        cy={y(data[data.length - 1])}
        r={3}
        fill={color}
      />
    </svg>
  );
}

// ── Tipos ────────────────────────────────────────────────────────────────────
interface StockCard {
  label:   string;
  full:    string;
  price:   number;
  change:  number;
  closes:  number[];
}

interface CryptoCard {
  label:   string;
  symbol:  string;
  img:     string;
  mxn:     number;
  change:  number;
  closes:  number[];
}

function fmtPrice(n: number, label: string) {
  if (label === "IPC") {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    return n.toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Card ─────────────────────────────────────────────────────────────────────
function StatCard({
  label, sublabel, value, change, closes, icon,
}: {
  label: string; sublabel: string; value: string;
  change: number; closes: number[]; icon?: React.ReactNode;
}) {
  const up = change >= 0;
  return (
    <div style={{
      background: "#fff",
      border: "1px solid #EEF0F3",
      borderRadius: 14,
      padding: "14px 16px",
      boxShadow: "0 1px 4px rgba(15,23,42,.05)",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        {/* Left */}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            {icon && <span style={{ fontSize: 14 }}>{icon}</span>}
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: ".05em" }}>
              {label}
            </p>
          </div>
          <p style={{ margin: 0, fontSize: 9, color: "#9CA3AF", marginBottom: 10 }}>{sublabel}</p>
          <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111827", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {value}
          </p>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 3, marginTop: 6,
            background: up ? "#ECFDF5" : "#FEF2F2",
            color: up ? "#059669" : "#DC2626",
            borderRadius: 20, padding: "2px 8px", fontSize: 10, fontWeight: 700,
          }}>
            <span>{up ? "▲" : "▼"}</span>
            <span>{up ? "+" : ""}{change.toFixed(2)}% hoy</span>
          </div>
        </div>
        {/* Right: sparkline */}
        <div style={{ flexShrink: 0, paddingTop: 2 }}>
          <div style={{ fontSize: 8, color: "#D1D5DB", textAlign: "right", marginBottom: 2 }}>
            {change > 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`}
          </div>
          <Sparkline data={closes.length >= 2 ? closes : [0, 1]} up={up} />
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────
export function StatsSection() {
  const [stocks,  setStocks]  = useState<StockCard[]>([]);
  const [cryptos, setCryptos] = useState<CryptoCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [spin,    setSpin]    = useState(false);

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const ANON_KEY     = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const load = async () => {
    setSpin(true);
    try {
      // Stocks históricos via Edge Function
      const stocksPromise = fetch(
        `${SUPABASE_URL}/functions/v1/fetch-market-data?type=ipc_history`,
        { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } }
      ).then(r => r.json()).catch(() => ({ cards: [] }));

      // BTC + ETH histórico via Kraken OHLC (sin CORS)
      const since = Math.floor(Date.now() / 1000) - 8 * 86400;
      const krakenPromise = fetch(
        `https://api.kraken.com/0/public/OHLC?pair=XBTUSD,ETHUSD&interval=1440&since=${since}`,
        { signal: AbortSignal.timeout(10_000) }
      ).then(r => r.json()).catch(() => null);

      // USD/MXN rate
      const fxPromise = fetch("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(8_000) })
        .then(r => r.json()).then(j => j.rates?.MXN ?? 17.5).catch(() => 17.5);

      const [stocksData, krakenData, rate] = await Promise.all([stocksPromise, krakenPromise, fxPromise]);

      // Procesar stocks
      setStocks((stocksData.cards ?? []).slice(0, 3));

      // Procesar crypto
      const cryptoCards: CryptoCard[] = [];
      const btcRaw = krakenData?.result?.XXBTZUSD;
      const ethRaw = krakenData?.result?.XETHZUSD;

      const parseKraken = (raw: any[][], sym: string, img: string, label: string): CryptoCard | null => {
        if (!Array.isArray(raw) || raw.length < 2) return null;
        const closes = raw.slice(-7).map((c: any[]) => parseFloat(c[4]) * rate);
        const current = closes[closes.length - 1];
        const prev    = closes[closes.length - 2];
        const change  = prev ? ((current - prev) / prev) * 100 : 0;
        return { label, symbol: sym, img, mxn: current, change, closes };
      };

      const btc = parseKraken(btcRaw, "BTC", "https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/btc.svg", "Bitcoin");
      const eth = parseKraken(ethRaw, "ETH", "https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/eth.svg", "Ethereum");
      if (btc) cryptoCards.push(btc);
      if (eth) cryptoCards.push(eth);
      setCryptos(cryptoCards);

    } catch { /* silencioso */ }
    finally { setLoading(false); setSpin(false); }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 3 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const SkeletonCard = () => (
    <div style={{ background: "#fff", border: "1px solid #EEF0F3", borderRadius: 14, padding: "14px 16px", boxShadow: "0 1px 4px rgba(15,23,42,.05)" }}>
      <div style={{ height: 9,  width: 80,  background: "#F3F4F6", borderRadius: 4, marginBottom: 8 }} />
      <div style={{ height: 24, width: 100, background: "#F3F4F6", borderRadius: 6, marginBottom: 8 }} />
      <div style={{ height: 16, width: 70,  background: "#F3F4F6", borderRadius: 20 }} />
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 2px" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: ".07em" }}>
          📈 Mercados en vivo
        </span>
        <button onClick={load} style={{ padding: 3, border: 0, background: "transparent", cursor: "pointer", color: "#9CA3AF", display: "flex" }}>
          <RefreshCw size={11} style={{ animation: spin ? "spin 0.8s linear infinite" : "none" }} />
        </button>
      </div>

      {loading ? (
        <>
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
          <SkeletonCard /><SkeletonCard />
        </>
      ) : (
        <>
          {/* Bolsa Mexicana */}
          {stocks.map((s) => (
            <StatCard
              key={s.label}
              label={s.label}
              sublabel={s.full + " · BMV"}
              value={fmtPrice(s.price, s.label)}
              change={s.change}
              closes={s.closes}
              icon={s.label === "IPC" ? "🇲🇽" : s.label === "AMXL" ? "📱" : "🍺"}
            />
          ))}

          {/* Crypto */}
          {cryptos.map((c) => (
            <StatCard
              key={c.label}
              label={c.label + " / MXN"}
              sublabel={c.symbol + " · Kraken · 7 días"}
              value={fmtPrice(c.mxn, c.label)}
              change={c.change}
              closes={c.closes}
              icon={<img src={c.img} alt={c.symbol} style={{ width: 14, height: 14, objectFit: "contain", verticalAlign: "middle" }} />}
            />
          ))}
        </>
      )}
    </div>
  );
}
