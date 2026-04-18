import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("No autenticado")

    const { amount_mxn, origin } = await req.json()
    if (!amount_mxn || amount_mxn < 100) throw new Error("Monto mínimo $100 MXN")

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

    const baseUrl = origin || "https://coremarket.mx"
    const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/mp-webhook`

    const preference = {
      items: [{
        title: "Depósito Coremarket",
        quantity: 1,
        unit_price: amount_mxn,
        currency_id: "MXN",
      }],
      payer: { email: user.email },
      back_urls: {
        success: `${baseUrl}/?deposito=exitoso`,
        failure: `${baseUrl}/?deposito=fallido`,
        pending: `${baseUrl}/?deposito=pendiente`,
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
    if (!res.ok) throw new Error(data?.message ?? "Error creando preferencia MP")

    return new Response(
      JSON.stringify({
        init_point: data.init_point,           // producción
        sandbox_init_point: data.sandbox_init_point, // pruebas
        preference_id: data.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
