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
    const authHeader = req.headers.get("Authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "No autenticado" }), {
        status: 401, headers: { ...CORS, "Content-Type": "application/json" },
      })
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: isAdmin } = await supabase.rpc("check_is_admin")
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Acceso denegado" }), {
        status: 403, headers: { ...CORS, "Content-Type": "application/json" },
      })
    }

    const body = await req.json()
    const { date, league_id } = body
    const matchDate = date ?? new Date().toISOString().split("T")[0]

    const rapidApiKey = Deno.env.get("RAPIDAPI_KEY")
    if (!rapidApiKey) throw new Error("RAPIDAPI_KEY no configurado — agrégalo en Supabase Dashboard → Settings → Edge Functions → Secrets")

    const params = new URLSearchParams({ matchDate })
    if (league_id) params.set("leagueId", String(league_id))

    const res = await fetch(`https://allsportsapi2.p.rapidapi.com/api/football/matches?${params}`, {
      headers: {
        "X-RapidAPI-Key": rapidApiKey,
        "X-RapidAPI-Host": "allsportsapi2.p.rapidapi.com",
      },
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`AllSportsApi ${res.status}: ${text.slice(0, 200)}`)
    }

    const data = await res.json()

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
      result:         m.event_final_result !== "-" ? m.event_final_result : null,
    }))

    return new Response(JSON.stringify({ fixtures, total: fixtures.length }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: message }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    })
  }
})
