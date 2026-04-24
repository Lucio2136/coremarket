import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * send-deposit-reminder — ejecutar vía pg_cron o llamada manual.
 * Envía recordatorio a usuarios con balance_mxn < 100 que no han apostado
 * en los últimos 14 días (pero sí tienen al menos un depósito previo).
 *
 * Para programar con pg_cron (cada lunes 10am UTC):
 *   select cron.schedule('deposit-reminder', '0 10 * * 1',
 *     $$select net.http_post(
 *       url := '<SUPABASE_URL>/functions/v1/send-deposit-reminder',
 *       headers := '{"Authorization":"Bearer <ANON_KEY>"}'::jsonb
 *     )$$
 *   );
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) {
      console.log('[reminder] Sin RESEND_API_KEY')
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Usuarios con balance bajo que tienen al menos un depósito
    const { data: profiles, error: pErr } = await supabase
      .from('profiles')
      .select('id, username, balance_mxn')
      .lt('balance_mxn', 100)

    if (pErr) throw pErr
    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'sin candidatos' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Filtrar: solo los que tienen al menos 1 depósito (han sido clientes)
    const { data: depositors, error: dErr } = await supabase
      .from('transactions')
      .select('user_id')
      .eq('type', 'deposit')
      .in('user_id', profiles.map((p) => p.id))

    if (dErr) throw dErr
    const depositorIds = new Set((depositors ?? []).map((d) => d.user_id))

    // Filtrar: solo los que NO han apostado en los últimos 14 días
    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
    const { data: recentBettors, error: bErr } = await supabase
      .from('bets')
      .select('user_id')
      .gte('created_at', cutoff)
      .in('user_id', profiles.map((p) => p.id))

    if (bErr) throw bErr
    const recentBettorIds = new Set((recentBettors ?? []).map((b) => b.user_id))

    const candidates = profiles.filter(
      (p) => depositorIds.has(p.id) && !recentBettorIds.has(p.id),
    )

    if (candidates.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'sin candidatos tras filtros' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let sent = 0
    for (const profile of candidates) {
      const { data: authUser } = await supabase.auth.admin.getUserById(profile.id)
      const email = authUser?.user?.email
      if (!email) continue

      const username = profile.username ?? email.split('@')[0]
      const balance = Number(profile.balance_mxn).toLocaleString('es-MX', { minimumFractionDigits: 2 })

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({
          from: 'LUCEBASE <noreply@lucebase.com>',
          to: [email],
          subject: 'Te quedan $' + balance + ' MXN en LUCEBASE — ¡úsalos!',
          html: `
            <h2>¡Hola, ${username}!</h2>
            <p>Tienes <strong>$${balance} MXN</strong> en tu cuenta de LUCEBASE.</p>
            <p>Hay mercados nuevos esperándote. ¿Quieres recargar y seguir apostando?</p>
            <p>
              <a href="https://lucebase.com"
                 style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;margin-right:8px">
                Ver mercados
              </a>
              <a href="https://lucebase.com"
                 style="background:#16a34a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">
                Depositar
              </a>
            </p>
            <p style="color:#888;font-size:12px;margin-top:24px">
              Recibes este correo porque tienes saldo disponible en LUCEBASE.
            </p>
          `,
        }),
      })

      if (res.ok) {
        sent++
        console.log(`[reminder] Enviado a ${email} (balance: ${balance})`)
      } else {
        console.error(`[reminder] Error ${res.status} para ${email}: ${await res.text()}`)
      }
    }

    console.log(`[reminder] ${sent}/${candidates.length} recordatorios enviados`)
    return new Response(JSON.stringify({ sent, candidates: candidates.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[reminder] Error:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
