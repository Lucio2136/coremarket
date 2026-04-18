import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Edge Function notify-winners
 *
 * Llama a esta función DESPUÉS de resolver un mercado.
 * Busca todas las apuestas ganadas del mercado y envía
 * una notificación a cada ganador.
 *
 * Por ahora: console.log (estructura lista para Resend).
 * Para activar Resend: descomentar el bloque RESEND y agregar
 * RESEND_API_KEY como secret en Supabase.
 *
 * Body esperado: { market_id: string }
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { market_id } = await req.json()
    if (!market_id) throw new Error('Falta market_id')

    // Usamos service_role para poder leer emails de profiles sin restricción de RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Obtener el mercado para incluir el título en el correo
    const { data: market, error: mErr } = await supabaseAdmin
      .from('markets')
      .select('id, title, result')
      .eq('id', market_id)
      .single()

    if (mErr) throw mErr

    // Obtener todas las apuestas ganadas con datos del perfil
    const { data: winners, error: wErr } = await supabaseAdmin
      .from('bets')
      .select('id, amount, potential_payout, profiles(id, username)')
      .eq('market_id', market_id)
      .eq('status', 'won')

    if (wErr) throw wErr

    if (!winners || winners.length === 0) {
      console.log(`[notify-winners] Mercado ${market_id}: sin ganadores.`)
      return new Response(
        JSON.stringify({ notified: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[notify-winners] Mercado "${market.title}" resuelto con "${market.result}". Ganadores: ${winners.length}`)

    const results: { userId: string; email: string; sent: boolean }[] = []

    for (const bet of winners) {
      const profile = bet.profiles as { id: string; username: string } | null
      if (!profile?.id) continue

      // Los emails viven en auth.users, no en profiles
      const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.getUserById(profile.id)
      if (authErr || !authUser.user?.email) {
        console.warn(`[notify-winners] Sin email para userId ${profile.id}`)
        continue
      }

      const email = authUser.user.email
      const payout = bet.potential_payout
      const username = profile.username ?? email

      // ── RESEND ────────────────────────────────────────────────────────────
      const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
      let sent = false
      if (RESEND_API_KEY) {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: 'QUOTR <noreply@quotr.mx>',
            to: [email],
            subject: '¡Ganaste en QUOTR!',
            html: `
              <h2>¡Felicidades, ${username}!</h2>
              <p>Ganaste <strong>$${payout.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN</strong>
                 en el mercado:</p>
              <blockquote>${market.title}</blockquote>
              <p>El monto ya fue acreditado a tu cuenta.</p>
              <p>— El equipo de QUOTR</p>
            `,
          }),
        })
        if (res.ok) {
          sent = true
          console.log(`[notify-winners] Email enviado a ${email}`)
        } else {
          const body = await res.text()
          console.error(`[notify-winners] Resend error para ${email}: ${res.status} ${body}`)
        }
      } else {
        console.log(
          `[notify-winners] ✓ ${username} (${email}) — ganó $${payout} MXN en "${market.title}" (sin RESEND_API_KEY)`
        )
      }
      // ─────────────────────────────────────────────────────────────────────

      results.push({ userId: profile.id, email, sent })
    }

    return new Response(
      JSON.stringify({ notified: results.length, winners: results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[notify-winners] Error:', msg)
    return new Response(
      JSON.stringify({ error: msg }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
