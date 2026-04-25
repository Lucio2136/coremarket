import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

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

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers })
  }

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "No autenticado" }), {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("No autenticado")

    const body = await req.json()
    const amount_mxn = Number(body?.amount_mxn)

    if (!Number.isFinite(amount_mxn) || amount_mxn < 100)
      throw new Error("Monto mínimo $100 MXN")
    if (amount_mxn > 50_000)
      throw new Error("Monto máximo por depósito: $50,000 MXN")

    // origin del body validado — nunca confiar en el cliente para construir redirect URLs
    const rawOrigin = String(body?.origin ?? "")
    const safeOrigin = ALLOWED_ORIGINS.includes(rawOrigin)
      ? rawOrigin
      : "https://lucebase.mx"

    // Rate limit: 5 depósitos por hora por usuario
    const { error: rlErr } = await supabase.rpc("check_rate_limit", {
      p_user_id:     user.id,
      p_action:      "deposit",
      p_window_secs: 3600,
      p_max_count:   5,
    })
    if (rlErr) throw new Error(rlErr.message)

    // Verificar si el sistema está congelado
    const { data: settings } = await supabase
      .from("system_settings")
      .select("is_frozen")
      .single()
    if (settings?.is_frozen) {
      throw new Error("Depósitos suspendidos temporalmente por el administrador.")
    }

    const mpAccessToken = Deno.env.get("MP_ACCESS_TOKEN")
    if (!mpAccessToken) throw new Error("MP_ACCESS_TOKEN no configurado")

    const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/mp-webhook`

    const preference = {
      items: [{
        title: "Depósito Lucebase",
        quantity: 1,
        unit_price: amount_mxn,
        currency_id: "MXN",
      }],
      payer: { email: user.email },
      back_urls: {
        success: `${safeOrigin}/?deposito=exitoso`,
        failure: `${safeOrigin}/?deposito=fallido`,
        pending: `${safeOrigin}/?deposito=pendiente`,
      },
      auto_return: "approved",
      notification_url: webhookUrl,
      metadata: { user_id: user.id, amount_mxn },
      statement_descriptor: "COREMARKET",
    }

    const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${mpAccessToken}`,
      },
      body: JSON.stringify(preference),
    })

    const data = await res.json()
    if (!res.ok) {
      console.error("MercadoPago error:", JSON.stringify(data))
      throw new Error(data?.message ?? "Error creando preferencia MP")
    }

    return new Response(
      JSON.stringify({
        checkout_url: data.init_point,
        sandbox_init_point: data.sandbox_init_point,
        preference_id: data.id,
      }),
      { headers: { ...headers, "Content-Type": "application/json" } }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...headers, "Content-Type": "application/json" },
    })
  }
})
