import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const q = new URL(req.url).searchParams.get("q") ?? "México noticias";

  const rssUrl =
    `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=es-MX&gl=MX&ceid=MX:es`;

  try {
    const res = await fetch(rssUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Lucebase/1.0)" },
    });
    const xml = await res.text();

    return new Response(xml, {
      headers: {
        ...CORS,
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=900",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
