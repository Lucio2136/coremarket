import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY no configurada en Supabase secrets");

    const today = new Date().toISOString().split("T")[0];

    const prompt = `Eres un experto en plataformas de predicción al estilo Polymarket pero adaptada al público mexicano.
Genera exactamente 10 predicciones de mercado con morbo mexicano auténtico.

Personajes y temas a cubrir (varía entre ellos):
- Música: Peso Pluma, Nodal, Ángela Aguilar, Cazzu, Natanael Cano, Junior H
- Influencers: Domelipa, Wendy Guevara, Lizbeth Rodríguez, Gomita, Kunno
- Política: Claudia Sheinbaum, AMLO, Xóchitl Gálvez, narco en noticias
- Deportes: Canelo Álvarez, Chivas, Club América, Liga MX, Selección Mexicana
- Economía: dólar vs peso MXN, Pemex, inflación, nearshoring

Reglas:
- Las preguntas empiezan con ¿ y terminan con ?
- Deben tener morbo, controversia o debate genuino
- yes_percent entre 20 y 75 (distribución realista, no siempre 50)
- yes_odds y no_odds coherentes: si yes_percent=30 entonces yes_odds≈3.0, no_odds≈1.4
- closes_at entre 1 y 5 meses desde hoy (${today}), formato ISO 8601
- description: 1 oración corta con contexto jugoso (máx 120 chars)
- Categorías solo de esta lista: Entretenimiento, Política, Deportes, Economía, Famosos

Devuelve ÚNICAMENTE un JSON array válido, sin markdown, sin texto extra:
[
  {
    "title": "¿Peso Pluma lanzará colaboración con Bad Bunny antes de diciembre 2025?",
    "subject_name": "Peso Pluma",
    "category": "Entretenimiento",
    "yes_odds": 2.1,
    "no_odds": 1.9,
    "yes_percent": 48,
    "no_percent": 52,
    "closes_at": "2025-12-01T00:00:00Z",
    "is_trending": false,
    "description": "El corrido tumbado vs el trap caribeño: la colaboración más esperada del año",
    "market_type": "binary",
    "total_pool": 0,
    "bettor_count": 0,
    "status": "draft"
  }
]`;

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Anthropic error ${resp.status}: ${errText}`);
    }

    const aiData = await resp.json();
    const rawText: string = aiData.content[0].text.trim();

    // Strip markdown fences if Claude wrapped the JSON
    const jsonText = rawText.startsWith("```")
      ? rawText.replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "")
      : rawText;

    const markets = JSON.parse(jsonText);

    if (!Array.isArray(markets) || markets.length === 0) {
      throw new Error("La IA no devolvió un array válido");
    }

    const { data: inserted, error } = await supabase
      .from("markets")
      .insert(markets)
      .select("id, title");

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, count: inserted.length, markets: inserted }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
