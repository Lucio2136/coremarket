import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = [
  "https://lucebase.mx",
  "https://www.lucebase.mx",
  "https://lucebase.vercel.app",
]

function corsHeaders(reqOrigin: string | null) {
  const origin = reqOrigin && ALLOWED_ORIGINS.includes(reqOrigin)
    ? reqOrigin
    : "https://lucebase.mx"
  return {
    "Access-Control-Allow-Origin":  origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  }
}

/**
 * Edge Function place-bet
 *
 * Delega toda la lógica de negocio a la RPC `place_bet` de PostgreSQL,
 * que es atómica, valida saldo, aplica AMM, cobra fee y actualiza pools.
 *
 * Esta función solo existe como punto de entrada HTTP; NO reimplementa
 * ninguna lógica financiera para evitar divergencias con la RPC.
 */
serve(async (req) => {
  const headers = corsHeaders(req.headers.get("origin"))

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  try {
    // Usamos anon key + JWT del usuario para que RLS y auth.uid() funcionen
    // correctamente dentro de la RPC (SECURITY DEFINER con auth.uid()).
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const body   = await req.json()
    const { marketId, side, amount, odds } = body

    // Validación estricta de tipos y rangos
    if (!marketId || typeof marketId !== "string" || marketId.length > 100)
      throw new Error("marketId inválido")
    if (!["yes", "no"].includes(side))
      throw new Error("side debe ser 'yes' o 'no'")
    if (!Number.isFinite(Number(amount)) || Number(amount) < 10 || Number(amount) > 100_000)
      throw new Error("amount inválido: debe estar entre $10 y $100,000 MXN")
    if (!Number.isFinite(Number(odds)) || Number(odds) < 1 || Number(odds) > 1000)
      throw new Error("odds inválido")

    // Toda la lógica (freeze check, saldo, AMM, fee, transacción) vive en la RPC
    const { data, error } = await supabaseClient.rpc('place_bet', {
      p_market_id: marketId,
      p_side:      side,
      p_amount:    amount,
      p_odds:      odds,
    })

    if (error) throw error

    return new Response(
      JSON.stringify({ bet: data }),
      { headers: { ...headers, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return new Response(
      JSON.stringify({ error: msg }),
      {
        status: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
      }
    )
  }
})
