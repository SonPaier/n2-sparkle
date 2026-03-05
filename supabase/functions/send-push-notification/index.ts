import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function base64UrlToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function uint8ArrayToBase64Url(uint8Array: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generateVapidJwt(
  audience: string,
  subject: string,
  privateKeyBase64: string,
  publicKeyBase64: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 12 * 60 * 60;

  const formattedSubject = subject.startsWith('mailto:') ? subject : `mailto:${subject}`;

  const header = { alg: 'ES256', typ: 'JWT' };
  const payload = { aud: audience, exp: expiry, iat: now, sub: formattedSubject };

  const headerB64 = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const privateKeyBytes = base64UrlToUint8Array(privateKeyBase64);
  const publicKeyBytes = base64UrlToUint8Array(publicKeyBase64);

  let cryptoKey: CryptoKey;

  if (privateKeyBytes.length === 32 && publicKeyBytes.length === 65 && publicKeyBytes[0] === 0x04) {
    const x = publicKeyBytes.slice(1, 33);
    const y = publicKeyBytes.slice(33, 65);

    const jwk = {
      kty: 'EC',
      crv: 'P-256',
      x: uint8ArrayToBase64Url(x),
      y: uint8ArrayToBase64Url(y),
      d: uint8ArrayToBase64Url(privateKeyBytes),
    };

    cryptoKey = await crypto.subtle.importKey(
      'jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']
    );
  } else {
    throw new Error(`Unexpected key format: private=${privateKeyBytes.length}, public=${publicKeyBytes.length}`);
  }

  const signatureBuffer = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, cryptoKey, new TextEncoder().encode(unsignedToken)
  );

  const signatureB64 = uint8ArrayToBase64Url(new Uint8Array(signatureBuffer));
  return `vapid t=${unsignedToken}.${signatureB64},k=${publicKeyBase64}`;
}

async function encryptPayload(
  payload: string,
  p256dhKey: string,
  authSecret: string
): Promise<Uint8Array> {
  const payloadBytes = new TextEncoder().encode(payload);

  const localKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']
  );

  const localPublicKeyRaw = await crypto.subtle.exportKey('raw', localKeyPair.publicKey);
  const localPublicKey = new Uint8Array(localPublicKeyRaw);

  const subscriberKeyBytes = base64UrlToUint8Array(p256dhKey);
  const subscriberKeyBuffer = new ArrayBuffer(subscriberKeyBytes.length);
  new Uint8Array(subscriberKeyBuffer).set(subscriberKeyBytes);

  const subscriberPublicKey = await crypto.subtle.importKey(
    'raw', subscriberKeyBuffer, { name: 'ECDH', namedCurve: 'P-256' }, false, []
  );

  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: subscriberPublicKey }, localKeyPair.privateKey, 256
  );
  const sharedSecret = new Uint8Array(sharedSecretBits);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const authBytes = base64UrlToUint8Array(authSecret);

  const ikmInfoParts = [
    ...new TextEncoder().encode('WebPush: info'), 0x00,
    ...subscriberKeyBytes, ...localPublicKey
  ];
  const ikmInfo = new Uint8Array(ikmInfoParts);

  const sharedSecretBuffer = new ArrayBuffer(sharedSecret.length);
  new Uint8Array(sharedSecretBuffer).set(sharedSecret);
  const authBuffer = new ArrayBuffer(authBytes.length);
  new Uint8Array(authBuffer).set(authBytes);
  const ikmInfoBuffer = new ArrayBuffer(ikmInfo.length);
  new Uint8Array(ikmInfoBuffer).set(ikmInfo);

  const sharedSecretKey = await crypto.subtle.importKey(
    'raw', sharedSecretBuffer, { name: 'HKDF' }, false, ['deriveBits']
  );

  const ikmBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: authBuffer, info: ikmInfoBuffer },
    sharedSecretKey, 256
  );
  const ikm = new Uint8Array(ikmBits);

  const ikmBuffer = new ArrayBuffer(ikm.length);
  new Uint8Array(ikmBuffer).set(ikm);

  const ikmKey = await crypto.subtle.importKey(
    'raw', ikmBuffer, { name: 'HKDF' }, false, ['deriveBits']
  );

  const saltBuffer = new ArrayBuffer(salt.length);
  new Uint8Array(saltBuffer).set(salt);

  const cekInfo = new TextEncoder().encode('Content-Encoding: aes128gcm\x00');
  const cekInfoBuffer = new ArrayBuffer(cekInfo.length);
  new Uint8Array(cekInfoBuffer).set(cekInfo);

  const cekBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: saltBuffer, info: cekInfoBuffer },
    ikmKey, 128
  );
  const cek = new Uint8Array(cekBits);

  const nonceInfo = new TextEncoder().encode('Content-Encoding: nonce\x00');
  const nonceInfoBuffer = new ArrayBuffer(nonceInfo.length);
  new Uint8Array(nonceInfoBuffer).set(nonceInfo);

  const nonceBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: saltBuffer, info: nonceInfoBuffer },
    ikmKey, 96
  );
  const nonce = new Uint8Array(nonceBits);

  const paddedPayload = new Uint8Array(payloadBytes.length + 1);
  paddedPayload.set(payloadBytes);
  paddedPayload[payloadBytes.length] = 0x02;

  const cekBuffer = new ArrayBuffer(cek.length);
  new Uint8Array(cekBuffer).set(cek);

  const aesKey = await crypto.subtle.importKey(
    'raw', cekBuffer, { name: 'AES-GCM' }, false, ['encrypt']
  );

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce }, aesKey, paddedPayload
  );
  const encrypted = new Uint8Array(ciphertext);

  const recordSize = 4096;
  const body = new Uint8Array(16 + 4 + 1 + localPublicKey.length + encrypted.length);
  body.set(salt, 0);
  body[16] = (recordSize >> 24) & 0xff;
  body[17] = (recordSize >> 16) & 0xff;
  body[18] = (recordSize >> 8) & 0xff;
  body[19] = recordSize & 0xff;
  body[20] = localPublicKey.length;
  body.set(localPublicKey, 21);
  body.set(encrypted, 21 + localPublicKey.length);

  return body;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { instanceId, userId, title, body, url, tag } = await req.json();

    if (!instanceId) {
      return new Response(
        JSON.stringify({ error: 'instanceId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidEmail = Deno.env.get('VAPID_EMAIL') || 'mailto:admin@example.com';

    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(
        JSON.stringify({ error: 'VAPID keys not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get push subscriptions - optionally filter by userId
    let query = supabase.from('push_subscriptions').select('*').eq('instance_id', instanceId);
    if (userId) {
      query = query.eq('user_id', userId);
    }
    const { data: subscriptions, error: subError } = await query;

    if (subError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch subscriptions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No subscriptions found', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pushPayload = JSON.stringify({
      title: title || 'Powiadomienie',
      body: body || 'Nowa aktywność',
      icon: '/pwa-192x192.png',
      url: url || '/',
      tag: tag || `notification-${Date.now()}`,
    });

    let sent = 0;
    let failed = 0;
    let stale = 0;

    for (const sub of subscriptions) {
      try {
        const endpointUrl = new URL(sub.endpoint);
        const audience = endpointUrl.origin;

        const vapidAuth = await generateVapidJwt(audience, vapidEmail, vapidPrivateKey, vapidPublicKey);

        const bodyBytes = await encryptPayload(pushPayload, sub.p256dh, sub.auth);
        const bodyBuffer = new ArrayBuffer(bodyBytes.length);
        new Uint8Array(bodyBuffer).set(bodyBytes);

        const response = await fetch(sub.endpoint, {
          method: 'POST',
          headers: {
            'Authorization': vapidAuth,
            'TTL': '86400',
            'Urgency': 'high',
            'Content-Type': 'application/octet-stream',
            'Content-Encoding': 'aes128gcm',
          },
          body: bodyBuffer,
        });

        if (response.ok || response.status === 201) {
          sent++;
        } else if (response.status === 410 || response.status === 404) {
          stale++;
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        } else {
          failed++;
        }
      } catch (_pushError) {
        failed++;
      }
    }

    return new Response(
      JSON.stringify({ sent, total: subscriptions.length, stale }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
