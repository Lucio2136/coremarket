import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * notify-new-market — disparado por Database Webhook en INSERT de markets.
 * Notifica a todos los usuarios registrados sobre el nuevo mercado.
 * Payload: { type: "INSERT", record: { id, title, subject_name, closes_at, ... } }
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const payload = await req.json()

    // Soporta llamada directa ({ market_id }) y webhook ({ record: { id, title, ... } })
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    let market: { id: string; title: string; subject_name: string; closes_at: string | null }

    if (payload.record?.id) {
      market = payload.record
    } else if (payload.market_id) {
      const { data, error } = await supabase
        .from('markets')
        .select('id, title, subject_name, closes_at')
        .eq('id', payload.market_id)
        .single()
      if (error) throw error
      market = data
    } else {
      throw new Error('Falta market_id o record')
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) {
      console.log('[new-market] Sin RESEND_API_KEY — no se enviaron notificaciones')
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Obtener todos los usuarios (paginado, máx 1000 por llamada)
    const { data: { users }, error: usersErr } = await supabase.auth.admin.listUsers({ perPage: 1000 })
    if (usersErr) throw usersErr

    const emails = users
      .filter((u) => !!u.email)
      .map((u) => u.email as string)

    if (emails.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const closesDate = market.closes_at
      ? new Date(market.closes_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
      : null

    // Resend soporta hasta 50 destinatarios por llamada — enviamos en lotes
    let sent = 0
    const BATCH = 50
    for (let i = 0; i < emails.length; i += BATCH) {
      const batch = emails.slice(i, i + BATCH)
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({
          from: 'LUCEBASE <noreply@lucebase.com>',
          to: batch,
          subject: `Nuevo mercado: ${market.title}`,
          html: `
            <h2>Nuevo mercado en LUCEBASE</h2>
            <h3 style="color:#2563eb">${market.title}</h3>
            ${market.subject_name ? `<p><strong>Sobre:</strong> ${market.subject_name}</p>` : ''}
            ${closesDate ? `<p><strong>Cierra el:</strong> ${closesDate}</p>` : ''}
            <p>¿Qué crees que pasará? Apuesta ahora antes de que cierre el mercado.</p>
            <p>
              <a href="https://lucebase.com"
                 style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">
                Apostar ahora
              </a>
            </p>
            <p style="color:#888;font-size:12px;margin-top:24px">
              Recibes este correo porque tienes una cuenta en LUCEBASE.
            </p>
          `,
        }),
      })
      if (res.ok) {
        sent += batch.length
      } else {
        console.error(`[new-market] Resend error lote ${i}: ${res.status} ${await res.text()}`)
      }
    }

    console.log(`[new-market] "${market.title}" — ${sent}/${emails.length} emails enviados`)
    return new Response(JSON.stringify({ sent, total: emails.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[new-market] Error:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
