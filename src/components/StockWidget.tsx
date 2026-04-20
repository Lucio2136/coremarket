import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, RefreshCw, WifiOff } from "lucide-react";

interface Stock {
  label:    string;
  full:     string;
  price:    number;
  change:   number;
  currency: string;
}

function fmtPrice(n: number, label: string) {
  if (label === "IPC") {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    return n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const LOGOS: Record<string, string> = {
  IPC:    "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/Bandera_de_Mexico.svg/40px-Bandera_de_Mexico.svg.png",
  AMXL:   "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/America_Movil_logo.svg/40px-America_Movil_logo.svg.png",
  FEMSA:  "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/FEMSA_logo.svg/40px-FEMSA_logo.svg.png",
  WALMEX: "https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/usd.svg",
};

const ICON_FALLBACK: Record<string, { bg: string; color: string; label: string }> = {
  IPC:    { bg: "#F0FDF4", color: "#16A34A", label: "📈" },
  AMXL:   { bg: "#EFF6FF", color: "#2563EB", label: "AM" },
  FEMSA:  { bg: "#FFF7ED", color: "#EA580C", label: "FM" },
  WALMEX: { bg: "#F0F9FF", color: "#0284C7", label: "WM" },
};

export function StockWidget() {
  const [stocks,   setStocks]   = useState<Stock[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(false);
  const [spinning, setSpinning] = useState(false);

  const load = async () => {
    setSpinning(true);
    setError(false);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-market-data?type=stocks`;
      const res  = await fetch(url, {
        headers: {
          apikey:        import.meta.env.VITE_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? "error");
      setStocks(json.stocks ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setSpinning(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 2 * 60 * 1000); // cada 2 min
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{
      background: "#fff",
      border: "1px solid #EEF0F3",
      borderRadius: 16,
      overflow: "hidden",
      boxShadow: "0 1px 3px rgba(15,23,42,.05)",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px 8px",
        borderBottom: "1px solid #F3F4F6",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13 }}>📊</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: ".07em" }}>
            Bolsa Mexicana
          </span>
        </div>
        <button
          onClick={load}
          title="Actualizar"
          style={{ padding: 3, border: 0, background: "transparent", cursor: "pointer", color: "#9CA3AF", display: "flex" }}
        >
          <RefreshCw size={11} style={{ animation: spinning ? "spin 0.8s linear infinite" : "none" }} />
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
          {(loading ? [null, null, null, null] : stocks).map((s, i) => {
            const up   = (s?.change ?? 0) >= 0;
            const icon = ICON_FALLBACK[s?.label ?? "IPC"];
            const isIPC = s?.label === "IPC";

            return (
              <div
                key={i}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: isIPC ? "10px 14px 8px" : "8px 14px",
                  borderBottom: i < (stocks.length || 4) - 1 ? "1px solid #F3F4F6" : "none",
                  background: isIPC ? "#FAFAFA" : "transparent",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{
                    width: isIPC ? 34 : 30, height: isIPC ? 34 : 30,
                    borderRadius: 9,
                    background: loading ? "#F3F4F6" : (icon?.bg ?? "#F3F4F6"),
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: isIPC ? 16 : 11, fontWeight: 800,
                    color: icon?.color ?? "#374151",
                    flexShrink: 0,
                  }}>
                    {!loading && (icon?.label ?? "?")}
                  </div>
                  <div>
                    {loading ? (
                      <>
                        <div style={{ height: 10, width: 60, background: "#F3F4F6", borderRadius: 4, marginBottom: 4 }} />
                        <div style={{ height: 8,  width: 80, background: "#F3F4F6", borderRadius: 4 }} />
                      </>
                    ) : (
                      <>
                        <p style={{ margin: 0, fontSize: isIPC ? 12.5 : 11.5, fontWeight: isIPC ? 800 : 700, color: "#111827" }}>
                          {s!.label}
                        </p>
                        <p style={{ margin: 0, fontSize: 10, color: "#9CA3AF" }}>{s!.full}</p>
                      </>
                    )}
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  {loading ? (
                    <>
                      <div style={{ height: 11, width: 65, background: "#F3F4F6", borderRadius: 4, marginBottom: 4 }} />
                      <div style={{ height: 9,  width: 42, background: "#F3F4F6", borderRadius: 4, marginLeft: "auto" }} />
                    </>
                  ) : (
                    <>
                      <p style={{
                        margin: 0,
                        fontSize: isIPC ? 13 : 12,
                        fontWeight: isIPC ? 800 : 700,
                        color: "#111827",
                        fontVariantNumeric: "tabular-nums",
                      }}>
                        {fmtPrice(s!.price, s!.label)}
                      </p>
                      <p style={{
                        margin: 0, fontSize: 10.5, fontWeight: 700,
                        color: up ? "#059669" : "#DC2626",
                        display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 2,
                      }}>
                        {up ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                        {up ? "+" : ""}{s!.change.toFixed(2)}%
                      </p>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {/* Nota de mercado */}
          {!loading && stocks.length > 0 && (
            <div style={{ padding: "6px 14px", borderTop: "1px solid #F3F4F6" }}>
              <p style={{ margin: 0, fontSize: 9, color: "#D1D5DB", textAlign: "right" }}>
                Datos BMV · Yahoo Finance · diferido 15 min
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
