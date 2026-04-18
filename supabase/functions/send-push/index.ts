import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Minimal VAPID-signed Web Push implementation for Deno
// Uses WebCrypto API to sign the JWT without external deps

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

async function importVapidPrivateKey(pem: string): Promise<CryptoKey> {
  const pemBody = pem.replace(/-----.*-----/g, "").replace(/\s/g, "")
  const der = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0))
  return crypto.subtle.importKey("pkcs8", der, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"])
}

function base64UrlEncode(data: Uint8Array | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data
  let str = ""
  bytes.forEach((b) => (str += String.fromCharCode(b)))
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}

async function buildVapidJwt(audience: string, privateKey: CryptoKey, subject: string): Promise<string> {
  const header  = base64UrlEncode(JSON.stringify({ typ: "JWT", alg: "ES256" }))
  const payload = base64UrlEncode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: subject,
  }))
  const data   = `${header}.${payload}`
  const sig    = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, new TextEncoder().encode(data))
  return `${data}.${base64UrlEncode(new Uint8Array(sig))}`
}

async function sendPush(subscription: any, payload: object, vapidPublic: string, vapidPrivate: string, vapidSubject: string) {
  const endpoint = subscription.endpoint
  const origin   = new URL(endpoint).origin
  const privKey  = await importVapidPrivateKey(vapidPrivate)
  const jwt      = await buildVapidJwt(origin, privKey, vapidSubject)

  const body = new TextEncoder().encode(JSON.stringify(payload))

  // Content encryption (aes128gcm) for Web Push is complex — use unencrypted for simplicity
  // Most production setups use a library. Here we send a simple auth-only push (notification only, no encrypted body).
  // To send body, you'd need full RFC8291 encryption. We omit that and rely on the SW's push handler.

  // For full encrypted push, switch to a proper web-push library in production.
  // This simpler approach sends a signed push without body encryption, triggering the "push" SW event.
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `vapid t=${jwt},k=${vapidPublic}`,
      "TTL":           "86400",
      "Content-Type":  "application/octet-stream",
      "Content-Encoding": "aes128gcm",
    },
    body,
  })
  return res
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    )

    const { user_id, title, body, url } = await req.json()
    if (!user_id || !title) throw new Error("user_id y title son requeridos")

    const vapidPublic  = Deno.env.get("VAPID_PUBLIC_KEY") ?? ""
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY") ?? ""
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@coremarket.mx"

    if (!vapidPublic || !vapidPrivate) throw new Error("VAPID keys no configuradas")

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("subscription")
      .eq("user_id", user_id)

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    let sent = 0
    for (const { subscription } of subs) {
      try {
        await sendPush(subscription, { title, body, url }, vapidPublic, vapidPrivate, vapidSubject)
        sent++
      } catch (e) {
        console.error("Error enviando push:", e)
      }
    }

    return new Response(JSON.stringify({ sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
