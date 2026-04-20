import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  // MP hace GET para verificar la URL — responder 200
  if (req.method === "GET") {
    return new Response("ok", { status: 200 })
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 })
  }

  // ── Verificar firma de MP ────────────────────────────────────────────────
  // MP envía x-signature: ts=TIMESTAMP,v1=HMAC-SHA256(id:{data.id};request-id:{x-request-id};ts:{ts})
  const webhookSecret = Deno.env.get("MP_WEBHOOK_SECRET")
  if (!webhookSecret) {
    console.error("MP_WEBHOOK_SECRET no configurado — rechazando por seguridad")
    return new Response("Webhook secret not configured", { status: 500 })
  }

  const xSignature = req.headers.get("x-signature") ?? ""
  const xRequestId = req.headers.get("x-request-id") ?? ""
  const url        = new URL(req.url)
  const dataId     = url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? ""

  const sigParts = Object.fromEntries(
    xSignature.split(",").flatMap(p => {
      const [k, v] = p.split("=")
      return k && v ? [[k.trim(), v.trim()]] : []
    })
  )
  const ts   = sigParts["ts"]  ?? ""
  const hash = sigParts["v1"]  ?? ""

  if (!ts || !hash) {
    console.error("x-signature ausente o malformado")
    return new Response("Invalid signature", { status: 401 })
  }

  const message    = `id:${dataId};request-id:${xRequestId};ts:${ts}`
  const keyBytes   = new TextEncoder().encode(webhookSecret)
  const msgBytes   = new TextEncoder().encode(message)
  const cryptoKey  = await crypto.subtle.importKey(
    "raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  )
  const sigBytes   = await crypto.subtle.sign("HMAC", cryptoKey, msgBytes)
  const expected   = Array.from(new Uint8Array(sigBytes))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("")

  if (hash !== expected) {
    console.error("Firma MP inválida — posible request no autorizado")
    return new Response("Invalid signature", { status: 401 })
  }

  // ── Filtrar tipo de notificación ─────────────────────────────────────────
  const topic = url.searchParams.get("topic") ?? url.searchParams.get("type") ?? ""
  if (topic && topic !== "payment" && topic !== "payment_id") {
    return new Response(JSON.stringify({ received: true, skipped: true }), { status: 200 })
  }

  if (!dataId) {
    console.error("Webhook MP sin data.id en query params")
    return new Response("Missing data.id", { status: 400 })
  }

  return await processPayment(dataId)
})

async function processPayment(paymentId: string) {
  const mpAccessToken = Deno.env.get("MP_ACCESS_TOKEN")
  if (!mpAccessToken) {
    console.error("MP_ACCESS_TOKEN no configurado")
    return new Response("Config error", { status: 500 })
  }

  // Verificar el pago directamente con la API de MP (fuente de verdad)
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${mpAccessToken}` },
  })

  if (!res.ok) {
    console.error("Error fetching payment from MP:", await res.text())
    return new Response("MP API error", { status: 400 })
  }

  const payment = await res.json()

  if (payment.status !== "approved") {
    console.log(`Pago ${paymentId} ignorado — status: ${payment.status}`)
    return new Response(JSON.stringify({ received: true, skipped: true }), { status: 200 })
  }

  // user_id viene del metadata que nuestro servidor guardó en MP al crear la preferencia,
  // NO del cuerpo del webhook. La verificación de firma garantiza que el payment ID
  // no fue inyectado; la API de MP garantiza que el metadata es el que nosotros pusimos.
  const userId    = payment.metadata?.user_id
  const amountMxn = payment.transaction_amount

  if (!userId) {
    console.error("Pago sin user_id en metadata:", paymentId)
    return new Response("Missing user_id", { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  )

  // ── Idempotencia ─────────────────────────────────────────────────────────
  const { data: existing } = await supabase
    .from("transactions")
    .select("id")
    .eq("stripe_payment_intent_id", `mp_${paymentId}`)
    .maybeSingle()

  if (existing) {
    console.log("Pago duplicado ignorado:", paymentId)
    return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 })
  }

  // ── Verificar que el usuario existe ──────────────────────────────────────
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

  // ── Acreditar saldo ───────────────────────────────────────────────────────
  const { error: updateErr } = await supabase
    .from("profiles")
    .update({ balance_mxn: balanceAfter })
    .eq("id", userId)

  if (updateErr) {
    console.error("Error actualizando balance:", updateErr)
    return new Response("Error updating balance", { status: 500 })
  }

  // ── Registrar transacción ─────────────────────────────────────────────────
  const { error: txErr } = await supabase
    .from("transactions")
    .insert({
      user_id:                  userId,
      type:                     "deposit",
      amount:                   amountMxn,
      balance_after:            balanceAfter,
      stripe_payment_intent_id: `mp_${paymentId}`,
      description:              "Depósito vía Mercado Pago",
    })

  if (txErr?.code === "23505") {
    return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 })
  }
  if (txErr) {
    console.error("Error insertando transacción:", txErr)
    return new Response("Error recording transaction", { status: 500 })
  }

  console.log(`Depósito MP acreditado: user=${userId} amount=${amountMxn} payment=${paymentId}`)
  return new Response(JSON.stringify({ received: true }), { status: 200 })
}
