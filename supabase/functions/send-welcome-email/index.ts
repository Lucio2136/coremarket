import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * send-welcome-email — disparado por Database Webhook en INSERT de profiles.
 * Payload del webhook: { type: "INSERT", record: { id, username, ... } }
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const payload = await req.json()

    // Soporta llamada directa ({ user_id }) y webhook de Supabase ({ record: { id } })
    const userId: string = payload.user_id ?? payload.record?.id
    if (!userId) throw new Error('Falta user_id')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: authUser, error: authErr } = await supabase.auth.admin.getUserById(userId)
    if (authErr || !authUser.user?.email) throw new Error('Usuario no encontrado')

    const email = authUser.user.email
    const username: string = payload.record?.username ?? email.split('@')[0]

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) {
      console.log(`[welcome] Sin RESEND_API_KEY — bienvenida no enviada a ${email}`)
      return new Response(JSON.stringify({ sent: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: 'LUCEBASE <noreply@lucebase.com>',
        to: [email],
        subject: '¡Bienvenido a LUCEBASE!',
        html: `
          <h2>¡Hola, ${username}!</h2>
          <p>Bienvenido a <strong>LUCEBASE</strong>, la plataforma de predicciones en español.</p>
          <p>Ahora puedes:</p>
          <ul>
            <li>Apostar sobre lo que harán o dirán personajes públicos</li>
            <li>Ganar pesos mexicanos con tus predicciones</li>
            <li>Seguir los mercados más populares en tiempo real</li>
          </ul>
          <p>
            <a href="https://lucebase.com"
               style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">
              Explorar mercados
            </a>
          </p>
          <p style="color:#888;font-size:13px;margin-top:24px">— El equipo de LUCEBASE</p>
        `,
      }),
    })

    const sent = res.ok
    if (!sent) console.error(`[welcome] Resend error ${res.status}: ${await res.text()}`)
    else console.log(`[welcome] Email de bienvenida enviado a ${email}`)

    return new Response(JSON.stringify({ sent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[welcome] Error:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
