import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@12.0.0'

const ALLOWED_ORIGINS = [
  "https://lucebase.mx",
  "https://www.lucebase.mx",
  "https://lucebase.com",
  "https://www.lucebase.com",
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

serve(async (req) => {
  const reqOrigin = req.headers.get("origin")
  const headers   = corsHeaders(reqOrigin)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "No autenticado" }), {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error('No autenticado')

    const body = await req.json()
    const amount_mxn = Number(body?.amount_mxn)

    if (!Number.isFinite(amount_mxn) || amount_mxn < 100)
      throw new Error('Monto mínimo $100 MXN')
    if (amount_mxn > 50_000)
      throw new Error('Monto máximo por depósito: $50,000 MXN')

    // Rate limit: 5 depósitos por hora por usuario
    const { error: rlErr } = await supabaseClient.rpc("check_rate_limit", {
      p_user_id:     user.id,
      p_action:      "deposit",
      p_window_secs: 3600,
      p_max_count:   5,
    })
    if (rlErr) throw new Error(rlErr.message)

    // Verificar sistema congelado
    const { data: settings } = await supabaseClient
      .from('system_settings')
      .select('is_frozen')
      .single()
    if (settings?.is_frozen) {
      throw new Error('Depósitos suspendidos temporalmente por el administrador.')
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2023-10-16',
    })

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount_mxn * 100),
      currency: 'mxn',
      metadata: {
        user_id: user.id,
        amount_mxn: String(amount_mxn),
      },
    })

    return new Response(
      JSON.stringify({ client_secret: paymentIntent.client_secret }),
      { headers: { ...headers, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
  }
})
