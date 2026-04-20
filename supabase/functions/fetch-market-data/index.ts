import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function parseTrendsXml(xml: string): { title: string; traffic: string | null }[] {
  const trends: { title: string; traffic: string | null }[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(xml)) !== null && trends.length < 15) {
    const item = match[1];
    const titleMatch   = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ??
                         item.match(/<title>(.*?)<\/title>/);
    const trafficMatch = item.match(/<ht:approx_traffic>(.*?)<\/ht:approx_traffic>/);
    if (titleMatch) {
      trends.push({
        title:   titleMatch[1].trim(),
        traffic: trafficMatch ? trafficMatch[1].trim() : null,
      });
    }
  }
  return trends;
}

// ── Google Trends MX ────────────────────────────────────────────────────────
async function handleTrends(): Promise<Response> {
  const ENDPOINTS = [
    "https://trends.google.com/trending/rss?geo=MX",
    "https://trends.google.com/trends/trendingsearches/daily/rss?geo=MX",
  ];

  const HEADERS = {
    "User-Agent": UA,
    "Accept": "application/rss+xml, application/xml, text/xml, */*",
    "Accept-Language": "es-MX,es;q=0.9",
    "Cache-Control": "no-cache",
  };

  let trends: { title: string; traffic: string | null }[] = [];

  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10_000) });
      const xml = await res.text();
      trends = parseTrendsXml(xml);
      if (trends.length > 0) break;
    } catch { /* siguiente */ }
  }

  return new Response(JSON.stringify({ trends }), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// ── Yahoo Finance — IPC + acciones MX ───────────────────────────────────────
async function handleStocks(): Promise<Response> {
  const SYMBOLS = [
    { sym: "%5EMXX",       label: "IPC",    full: "S&P/BMV IPC"   },
    { sym: "AMXL.MX",      label: "AMXL",   full: "América Móvil" },
    { sym: "FEMSAUBD.MX",  label: "FEMSA",  full: "FEMSA"         },
    { sym: "WALMEX.MX",    label: "WALMEX", full: "Walmart MX"    },
  ];

  const results = await Promise.allSettled(
    SYMBOLS.map(({ sym }) =>
      fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=1d`,
        { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8_000) }
      ).then((r) => r.json())
    )
  );

  const stocks = SYMBOLS.map(({ label, full }, i) => {
    const r = results[i];
    if (r.status === "rejected") return null;
    const meta = r.value?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const price = meta.regularMarketPrice as number;
    const prev  = (meta.chartPreviousClose ?? meta.previousClose ?? meta.regularMarketPreviousClose) as number;
    const change = prev ? ((price - prev) / prev) * 100 : 0;
    return { label, full, price, change, currency: meta.currency ?? "MXN" };
  }).filter(Boolean);

  return new Response(JSON.stringify({ stocks }), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// ── Router ───────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const type = new URL(req.url).searchParams.get("type");
    if (type === "trends") return await handleTrends();
    if (type === "stocks") return await handleStocks();
    return new Response(JSON.stringify({ error: "type must be trends or stocks" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
