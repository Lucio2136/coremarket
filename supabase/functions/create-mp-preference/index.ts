import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const ALLOWED_ORIGINS = [
  "https://lucebase.com",
  "https://www.lucebase.com",
  "https://lucebase.vercel.app",
]

function corsHeaders(reqOrigin: string | null) {
  const origin = reqOrigin && ALLOWED_ORIGINS.includes(reqOrigin)
    ? reqOrigin
    : "https://lucebase.com"
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  }
}

serve(async (req) => {
  const reqOrigin = req.headers.get("origin")
  const headers   = corsHeaders(reqOrigin)

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers })
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("No autenticado")

    const body = await req.json()
    const amount_mxn = Number(body?.amount_mxn)

    if (!Number.isFinite(amount_mxn) || amount_mxn < 100)
      throw new Error("Monto mínimo $100 MXN")
    if (amount_mxn > 50_000)
      throw new Error("Monto máximo por depósito: $50,000 MXN")

    const rawOrigin = String(body?.origin ?? "")
    const safeOrigin = ALLOWED_ORIGINS.includes(rawOrigin)
      ? rawOrigin
      : "https://lucebase.com"

    // Rate limit: 5 depósitos por hora
    const { error: rlErr } = await supabase.rpc("check_rate_limit", {
      p_user_id:     user.id,
      p_action:      "deposit",
      p_window_secs: 3600,
      p_max_count:   5,
    })
    if (rlErr) throw new Error(rlErr.message)

    const { data: settings } = await supabase
      .from("system_settings")
      .select("is_frozen")
      .single()
    if (settings?.is_frozen) throw new Error("Depósitos suspendidos temporalmente.")

    const accessToken = Deno.env.get("MP_ACCESS_TOKEN")
    if (!accessToken) throw new Error("MP_ACCESS_TOKEN no configurado")

    const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/mp-webhook`

    const preference = {
      items: [{
        id:          "deposito-lucebase",
        title:       "Depósito Lucebase",
        quantity:    1,
        unit_price:  amount_mxn,
        currency_id: "MXN",
      }],
      payer: {
        email: user.email,
      },
      back_urls: {
        success: `${safeOrigin}/?deposito=exitoso`,
        failure: `${safeOrigin}/?deposito=fallido`,
        pending: `${safeOrigin}/?deposito=pendiente`,
      },
      auto_return:        "approved",
      notification_url:   webhookUrl,
      external_reference: user.id,
      metadata: {
        user_id:    user.id,
        amount_mxn: String(amount_mxn),
      },
      statement_descriptor: "LUCEBASE",
    }

    const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify(preference),
    })

    const data = await res.json()
    if (!res.ok) {
      console.error("MP error:", JSON.stringify(data))
      throw new Error(data?.message ?? "Error creando preferencia de pago")
    }

    return new Response(
      JSON.stringify({
        preference_id: data.id,
        checkout_url:  data.init_point,
      }),
      { headers: { ...headers, "Content-Type": "application/json" } }
    )
  } catch (err) {
    console.error("Error:", err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...headers, "Content-Type": "application/json" },
    })
  }
})
