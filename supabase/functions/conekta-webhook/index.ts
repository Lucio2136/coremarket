import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { hmac } from "https://deno.land/x/hmac@v2.0.1/mod.ts"

serve(async (req) => {
  if (req.method === "GET") {
    return new Response("ok", { status: 200 })
  }

  const body = await req.text()
  let event: any

  try {
    event = JSON.parse(body)
  } catch {
    return new Response("Invalid JSON", { status: 400 })
  }

  // ── Verificar firma del webhook ──────────────────────────────────────────────
  const webhookSecret = Deno.env.get("CONEKTA_WEBHOOK_SECRET")
  if (!webhookSecret) {
    console.error("CONEKTA_WEBHOOK_SECRET no configurado — rechazando por seguridad")
    return new Response("Webhook secret not configured", { status: 500 })
  }
  const signature = req.headers.get("signature") ?? req.headers.get("x-signature") ?? ""
  const digest    = hmac("sha256", webhookSecret, body, "utf8", "hex")
  if (signature !== digest) {
    console.error("Firma de webhook inválida — posible request no autorizado")
    return new Response("Invalid signature", { status: 401 })
  }

  // Solo nos interesa order.paid
  if (event.type !== "order.paid") {
    return new Response(JSON.stringify({ received: true, skipped: true }), { status: 200 })
  }

  const order     = event.data?.object
  const orderId   = order?.id
  const userId    = order?.metadata?.user_id
  const amountMxn = (order?.amount ?? 0) / 100 // de centavos a pesos

  if (!userId || !orderId || amountMxn <= 0) {
    console.error("Webhook sin datos suficientes:", { userId, orderId, amountMxn })
    return new Response("Missing data", { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  )

  // ── Idempotencia ─────────────────────────────────────────────────────────────
  const { data: existing } = await supabase
    .from("transactions")
    .select("id")
    .eq("stripe_payment_intent_id", `conekta_${orderId}`)
    .maybeSingle()

  if (existing) {
    console.log("Orden duplicada ignorada:", orderId)
    return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 })
  }

  // ── Acreditar saldo ──────────────────────────────────────────────────────────
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("balance_mxn")
    .eq("id", userId)
    .single()

  if (profileErr || !profile) {
    console.error("Perfil no encontrado:", userId)
    return new Response("Profile not found", { status: 400 })
  }

  const balanceAfter = profile.balance_mxn + amountMxn

  const { error: updateErr } = await supabase
    .from("profiles")
    .update({ balance_mxn: balanceAfter })
    .eq("id", userId)

  if (updateErr) {
    console.error("Error actualizando balance:", updateErr)
    return new Response("Error updating balance", { status: 500 })
  }

  // ── Registrar transacción ────────────────────────────────────────────────────
  const { error: txErr } = await supabase
    .from("transactions")
    .insert({
      user_id:                  userId,
      type:                     "deposit",
      amount:                   amountMxn,
      balance_after:            balanceAfter,
      stripe_payment_intent_id: `conekta_${orderId}`,
      description:              "Depósito vía Conekta",
    })

  if (txErr?.code === "23505") {
    return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 })
  }
  if (txErr) {
    console.error("Error insertando transacción:", txErr)
    return new Response("Error recording transaction", { status: 500 })
  }

  console.log(`Depósito acreditado: user=${userId} amount=${amountMxn} order=${orderId}`)
  return new Response(JSON.stringify({ received: true }), { status: 200 })
})
