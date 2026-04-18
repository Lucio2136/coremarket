import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  // MP envía GET con query params para verificación, y POST con la notificación
  const url = new URL(req.url)
  const topic = url.searchParams.get("topic") || url.searchParams.get("type")
  const id    = url.searchParams.get("id") || url.searchParams.get("data.id")

  // MP hace una verificación GET al registrar la URL — responder 200
  if (req.method === "GET") {
    return new Response("ok", { status: 200 })
  }

  // Solo nos interesan notificaciones de pagos
  if (topic !== "payment" && topic !== "payment_id") {
    // Intentar leer el body para obtener el payment id
    try {
      const body = await req.json()
      const paymentId = body?.data?.id
      if (!paymentId) return new Response("ok", { status: 200 })
      return await processPayment(String(paymentId))
    } catch {
      return new Response("ok", { status: 200 })
    }
  }

  if (!id) return new Response("Missing id", { status: 400 })
  return await processPayment(id)
})

async function processPayment(paymentId: string) {
  const mpAccessToken = Deno.env.get("MP_ACCESS_TOKEN")
  if (!mpAccessToken) {
    console.error("MP_ACCESS_TOKEN no configurado")
    return new Response("Config error", { status: 500 })
  }

  // Obtener detalles del pago desde MP
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${mpAccessToken}` },
  })

  if (!res.ok) {
    console.error("Error fetching payment from MP:", await res.text())
    return new Response("MP API error", { status: 400 })
  }

  const payment = await res.json()

  // Solo procesar pagos aprobados
  if (payment.status !== "approved") {
    console.log(`Pago ${paymentId} ignorado — status: ${payment.status}`)
    return new Response(JSON.stringify({ received: true, skipped: true }), { status: 200 })
  }

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

  // ── Idempotencia: evitar acreditar el mismo pago dos veces ──────────────────
  const { data: existing } = await supabase
    .from("transactions")
    .select("id")
    .eq("stripe_payment_intent_id", `mp_${paymentId}`)
    .maybeSingle()

  if (existing) {
    console.log("Pago duplicado ignorado:", paymentId)
    return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 })
  }

  // ── Acreditar saldo ─────────────────────────────────────────────────────────
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

  // ── Registrar transacción ───────────────────────────────────────────────────
  const { error: txErr } = await supabase
    .from("transactions")
    .insert({
      user_id:                  userId,
      type:                     "deposit",
      amount:                   amountMxn,
      balance_after:            balanceAfter,
      stripe_payment_intent_id: `mp_${paymentId}`,  // reutilizamos columna para idempotencia
      description:              `Depósito vía Mercado Pago`,
    })

  if (txErr?.code === "23505") {
    // Unique constraint — duplicado concurrente, ya acreditado
    return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 })
  }

  console.log(`Depósito MP acreditado: user=${userId} amount=${amountMxn} payment=${paymentId}`)
  return new Response(JSON.stringify({ received: true }), { status: 200 })
}
