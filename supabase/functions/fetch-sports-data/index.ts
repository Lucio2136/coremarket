import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })

  try {
    // Verificar que hay un usuario autenticado
    const authHeader = req.headers.get("Authorization") ?? ""
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "No autenticado" }), {
        status: 401, headers: { ...CORS, "Content-Type": "application/json" },
      })
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Sesión inválida" }), {
        status: 401, headers: { ...CORS, "Content-Type": "application/json" },
      })
    }

    const rapidApiKey = Deno.env.get("RAPIDAPI_KEY")
    if (!rapidApiKey) {
      throw new Error("RAPIDAPI_KEY no configurado en Supabase Secrets")
    }

    const body = await req.json()
    const matchDate: string = body?.date ?? new Date().toISOString().split("T")[0]

    const url = `https://allsportsapi2.p.rapidapi.com/api/football/matches?matchDate=${matchDate}`

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "x-rapidapi-key":  rapidApiKey,
        "x-rapidapi-host": "allsportsapi2.p.rapidapi.com",
        "Content-Type":    "application/json",
      },
    })

    const raw = await res.text()

    if (!res.ok) {
      throw new Error(`AllSportsApi ${res.status}: ${raw.slice(0, 300)}`)
    }

    let data: any
    try {
      data = JSON.parse(raw)
    } catch {
      throw new Error(`Respuesta inválida de AllSportsApi: ${raw.slice(0, 200)}`)
    }

    if (data.success !== 1) {
      throw new Error(`AllSportsApi error: ${JSON.stringify(data).slice(0, 200)}`)
    }

    const fixtures = (data.result ?? []).map((m: any) => ({
      id:             m.event_key,
      date:           m.event_date,
      time:           m.event_time,
      home_team:      m.event_home_team,
      away_team:      m.event_away_team,
      home_logo:      m.home_team_logo   ?? null,
      away_logo:      m.away_team_logo   ?? null,
      league_id:      m.league_id,
      league_name:    m.league_name,
      league_country: m.league_country,
      league_logo:    m.league_logo      ?? null,
      status:         m.event_status,
      result:         (m.event_final_result && m.event_final_result !== "-")
                        ? m.event_final_result
                        : null,
    }))

    return new Response(JSON.stringify({ fixtures, total: fixtures.length }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[fetch-sports-data]", message)
    return new Response(JSON.stringify({ error: message }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    })
  }
})
