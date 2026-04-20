import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const ALLOWED_ORIGINS = [
  "https://lucebase.mx",
  "https://www.lucebase.mx",
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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("No autenticado")

    const body = await req.json()
    const amount_mxn = Number(body?.amount_mxn)

    // Validar monto: mínimo $100, máximo $50,000 por depósito
    if (!Number.isFinite(amount_mxn) || amount_mxn < 100)
      throw new Error("Monto mínimo $100 MXN")
    if (amount_mxn > 50_000)
      throw new Error("Monto máximo por depósito: $50,000 MXN")

    // Validar origin — nunca confiar en el cliente para construir redirect URLs
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

    // Verificar sistema congelado
    const { data: settings } = await supabase
      .from("system_settings")
      .select("is_frozen")
      .single()
    if (settings?.is_frozen) throw new Error("Depósitos suspendidos temporalmente.")

    const conektaKey = Deno.env.get("CONEKTA_PRIVATE_KEY")
    if (!conektaKey) throw new Error("CONEKTA_PRIVATE_KEY no configurado")

    const baseUrl  = safeOrigin
    const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 2 // 2 horas

    const order = {
      currency: "MXN",
      customer_info: {
        name:  user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Usuario",
        email: user.email,
        phone: "5519562339", // requerido por Conekta; se puede actualizar con perfil
      },
      line_items: [{
        name:       "Depósito Lucebase",
        quantity:   1,
        unit_price: amount_mxn * 100, // centavos
      }],
      checkout: {
        type:                         "Integration",
        allowed_payment_methods:      ["cash", "card", "bank_transfer"],
        success_url:                  `${baseUrl}/?deposito=exitoso`,
        failure_url:                  `${baseUrl}/?deposito=fallido`,
        on_demand_enabled:            false,
        monthly_installments_enabled: false,
        needs_shipping_contact:       false,
        expires_at:                   expiresAt,
      },
      metadata: {
        user_id:    user.id,
        amount_mxn: String(amount_mxn),
      },
    }

    const res = await fetch("https://api.conekta.io/orders", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Accept":        "application/vnd.conekta-v2.1.0+json",
        "Authorization": `Bearer ${conektaKey}`,
      },
      body: JSON.stringify(order),
    })

    const data = await res.json()
    if (!res.ok) {
      console.error("Conekta error:", JSON.stringify(data))
      throw new Error(data?.details?.[0]?.message ?? data?.message ?? "Error creando orden")
    }

    return new Response(
      JSON.stringify({
        order_id:     data.id,
        checkout_url: data.checkout?.url,
      }),
      { headers: { ...headers, "Content-Type": "application/json" } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...headers, "Content-Type": "application/json" },
    })
  }
})
