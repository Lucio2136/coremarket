import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RESEND_API_KEY = () => Deno.env.get('RESEND_API_KEY')
const FROM = 'LUCEBASE <noreply@lucebase.com>'

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const key = RESEND_API_KEY()
  if (!key) {
    console.log(`[email] Sin RESEND_API_KEY — no enviado a ${to}`)
    return false
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  })
  if (!res.ok) {
    console.error(`[email] Resend error ${res.status} para ${to}: ${await res.text()}`)
    return false
  }
  console.log(`[email] Enviado a ${to}: ${subject}`)
  return true
}

/**
 * notify-winners — llamar después de resolver un mercado.
 * Notifica ganadores (¡ganaste!) y perdedores (mejor suerte).
 * Body: { market_id: string }
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { market_id } = await req.json()
    if (!market_id) throw new Error('Falta market_id')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: market, error: mErr } = await supabase
      .from('markets')
      .select('id, title, result')
      .eq('id', market_id)
      .single()
    if (mErr) throw mErr

    const { data: bets, error: bErr } = await supabase
      .from('bets')
      .select('id, amount, potential_payout, status, profiles(id, username)')
      .eq('market_id', market_id)
      .in('status', ['won', 'lost'])
    if (bErr) throw bErr

    if (!bets || bets.length === 0) {
      return new Response(
        JSON.stringify({ notified: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    let notified = 0
    for (const bet of bets) {
      const profile = bet.profiles as { id: string; username: string } | null
      if (!profile?.id) continue

      const { data: authUser } = await supabase.auth.admin.getUserById(profile.id)
      const email = authUser?.user?.email
      if (!email) continue

      const username = profile.username ?? email
      const won = bet.status === 'won'

      const subject = won ? '¡Ganaste en LUCEBASE!' : 'Resultado de tu apuesta en LUCEBASE'
      const html = won
        ? `
          <h2>¡Felicidades, ${username}!</h2>
          <p>Ganaste <strong>$${Number(bet.potential_payout).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN</strong> en el mercado:</p>
          <blockquote style="border-left:4px solid #22c55e;padding:8px 16px;color:#555">${market.title}</blockquote>
          <p>El monto ya fue acreditado a tu cuenta. <a href="https://lucebase.com/my-bets">Ver mis apuestas</a></p>
          <p style="color:#888;font-size:13px">— El equipo de LUCEBASE</p>
        `
        : `
          <h2>Resultado de tu apuesta, ${username}</h2>
          <p>El mercado <strong>"${market.title}"</strong> se resolvió y esta vez no ganaste.</p>
          <p>¡No te rindas! Hay nuevos mercados esperándote. <a href="https://lucebase.com">Ver mercados</a></p>
          <p style="color:#888;font-size:13px">— El equipo de LUCEBASE</p>
        `

      const sent = await sendEmail(email, subject, html)
      if (sent) notified++
    }

    return new Response(
      JSON.stringify({ notified, total_bets: bets.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[notify-winners] Error:', msg)
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
