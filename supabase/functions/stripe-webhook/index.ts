import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@12.0.0'

serve(async (req) => {
  // Stripe envía eventos como POST con el header stripe-signature.
  // Verificamos la firma ANTES de leer el cuerpo como JSON para que
  // nadie pueda fabricar depósitos falsos enviando payloads arbitrarios.
  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 })
  }

  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET no está configurado')
    return new Response('Webhook secret not configured', { status: 500 })
  }

  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
    apiVersion: '2023-10-16',
  })

  const body = await req.text()

  // constructEventAsync lanza si la firma no coincide o el timestamp es
  // demasiado viejo (tolerancia de 5 minutos por defecto → replay attacks).
  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
  } catch (err) {
    console.error('Firma de Stripe inválida:', err.message)
    return new Response(`Webhook signature verification failed: ${err.message}`, {
      status: 400,
    })
  }

  // Solo nos interesan los pagos completados
  if (event.type !== 'payment_intent.succeeded') {
    return new Response(JSON.stringify({ received: true, skipped: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const paymentIntent = event.data.object as Stripe.PaymentIntent
  const userId = paymentIntent.metadata?.user_id
  const amount = paymentIntent.amount / 100   // de centavos a pesos

  if (!userId) {
    console.error('payment_intent sin user_id en metadata:', paymentIntent.id)
    return new Response('Missing user_id in metadata', { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // ── Idempotencia ────────────────────────────────────────────────────────────
  // Si ya existe una transacción con este stripe_payment_intent_id significa
  // que el webhook llegó duplicado (Stripe puede reintentar). Devolvemos 200
  // para que Stripe deje de reintentar, pero NO volvemos a acreditar el saldo.
  const { data: existing } = await supabase
    .from('transactions')
    .select('id')
    .eq('stripe_payment_intent_id', paymentIntent.id)
    .maybeSingle()

  if (existing) {
    console.log('Evento duplicado ignorado:', paymentIntent.id)
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ── Acreditar saldo ─────────────────────────────────────────────────────────
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('balance_mxn')
    .eq('id', userId)
    .single()

  if (profileErr || !profile) {
    console.error('Perfil no encontrado para user_id:', userId)
    return new Response('Profile not found', { status: 400 })
  }

  const balanceAfter = profile.balance_mxn + amount

  const { error: updateErr } = await supabase
    .from('profiles')
    .update({ balance_mxn: balanceAfter })
    .eq('id', userId)

  if (updateErr) {
    console.error('Error actualizando saldo:', updateErr)
    return new Response('Error updating balance', { status: 500 })
  }

  // ── Registrar transacción (el UNIQUE INDEX en stripe_payment_intent_id
  //    es la última línea de defensa contra duplicados concurrentes) ──────────
  const { error: txErr } = await supabase
    .from('transactions')
    .insert({
      user_id:                   userId,
      type:                      'deposit',
      amount:                    amount,
      balance_after:             balanceAfter,
      stripe_payment_intent_id:  paymentIntent.id,
      description:               'Depósito con tarjeta',
    })

  if (txErr) {
    // Código 23505 = unique_violation → duplicado concurrente, ya acreditado
    if (txErr.code === '23505') {
      console.log('Inserción duplicada bloqueada por constraint:', paymentIntent.id)
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }
    console.error('Error insertando transacción:', txErr)
    return new Response('Error recording transaction', { status: 500 })
  }

  console.log(`Depósito acreditado: user=${userId} amount=${amount} pi=${paymentIntent.id}`)
  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
