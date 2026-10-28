// Sends push notifications through Firebase Cloud Messaging (HTTP v1).
// Called only by database triggers (pg_net, see migration 000006) with the shared secret; apps never call it.
// Secrets: FCM_SERVICE_ACCOUNT (base64 of the Firebase service account JSON) and PUSH_SECRET,
// both set by scripts/setup-push.mjs.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { SignJWT, importPKCS8 } from 'npm:jose@5.9.6';

import { fill, textsFor } from './texts.ts';

type Payload =
  | { kind: 'call' | 'missed'; session: string; wentOffline?: boolean }
  | { kind: 'kyc'; user: string; status: 'approved' | 'rejected' }
  | { kind: 'payout'; user: string; status: 'paid' | 'rejected'; amountPaise: number };

type Message = {
  to: string;
  title: string;
  body: string;
  data: Record<string, string>;
  // `calls` rings at full volume; `updates` is a normal notification. Both are created by the app.
  channel: 'calls' | 'updates';
  // A later notification with the same tag replaces the earlier one (a missed call replaces the ring).
  tag: string;
  ttlSeconds: number;
};

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const account = JSON.parse(atob(Deno.env.get('FCM_SERVICE_ACCOUNT') ?? 'e30=')) as { project_id?: string; client_email?: string; private_key?: string };

Deno.serve(async (req) => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const secret = Deno.env.get('PUSH_SECRET');
  if (!secret || req.headers.get('x-push-secret') !== secret) return json({ error: 'not_allowed' }, 401);
  if (!account.private_key) return json({ error: 'fcm_not_configured' }, 500);

  const message = await build(await req.json());
  if (!message) return json({ sent: 0 });

  const { data: devices } = await db.from('device_tokens').select('token').eq('user_id', message.to);
  let sent = 0;
  for (const { token } of devices ?? []) {
    const res = await send(token, message);
    if (res.ok) sent++;
    // The app was uninstalled or the token rotated: forget it.
    else if (res.status === 404 || (res.status === 400 && (await res.text()).includes('registration token'))) {
      await db.from('device_tokens').delete().eq('token', token);
    }
  }
  return json({ sent });
});

async function build(p: Payload): Promise<Message | null> {
  if (p.kind === 'call' || p.kind === 'missed') {
    const { data: call } = await db.from('call_sessions').select('id, caller_id, host_id, type, state').eq('id', p.session).maybeSingle();
    if (!call) return null;
    // Answered or declined before the push went out: nothing to show.
    if (p.kind === 'call' && call.state !== 'ringing') return null;
    const [{ data: host }, { data: caller }] = await Promise.all([
      db.from('profiles').select('ui_language, notify_calls').eq('id', call.host_id).single(),
      db.from('profiles').select('display_name').eq('id', call.caller_id).single(),
    ]);
    if (!host?.notify_calls) return null;
    const t = textsFor(host.ui_language);
    const name = caller?.display_name ?? '';
    if (p.kind === 'call') {
      return {
        to: call.host_id,
        title: fill(t.callTitle, { name }),
        body: call.type === 'video' ? t.videoBody : t.voiceBody,
        data: { kind: 'call', session: call.id },
        channel: 'calls',
        tag: `call-${call.id}`,
        // Past the ring timeout the call is over; don't deliver a stale ring.
        ttlSeconds: 30,
      };
    }
    return {
      to: call.host_id,
      title: fill(t.missedTitle, { name }),
      body: p.wentOffline ? t.missedOfflineBody : t.missedBody,
      data: { kind: 'missed', session: call.id },
      channel: 'updates',
      tag: `call-${call.id}`,
      ttlSeconds: 86_400,
    };
  }

  const { data: person } = await db.from('profiles').select('ui_language').eq('id', p.user).single();
  const t = textsFor(person?.ui_language);
  if (p.kind === 'kyc') {
    const ok = p.status === 'approved';
    return { to: p.user, title: ok ? t.approvedTitle : t.rejectedTitle, body: ok ? t.approvedBody : t.rejectedBody, data: { kind: 'kyc' }, channel: 'updates', tag: 'kyc', ttlSeconds: 7 * 86_400 };
  }
  const paid = p.status === 'paid';
  const amount = (p.amountPaise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  return {
    to: p.user,
    title: paid ? t.paidTitle : t.payoutRejectedTitle,
    body: paid ? fill(t.paidBody, { amount }) : t.payoutRejectedBody,
    data: { kind: 'payout' },
    channel: 'updates',
    tag: `payout-${Date.now()}`,
    ttlSeconds: 7 * 86_400,
  };
}

function send(token: string, m: Message) {
  return accessToken().then((auth) =>
    fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          token,
          data: m.data,
          android: {
            priority: 'HIGH',
            ttl: `${m.ttlSeconds}s`,
            notification: {
              title: m.title,
              body: m.body,
              channel_id: m.channel,
              tag: m.tag,
              notification_priority: m.channel === 'calls' ? 'PRIORITY_MAX' : 'PRIORITY_DEFAULT',
              visibility: 'PUBLIC',
              default_sound: true,
            },
          },
        },
      }),
    }),
  );
}

// Google OAuth token for FCM, signed with the service account key. Reused until shortly before it expires.
let cached: { token: string; expires: number } | null = null;
async function accessToken(): Promise<string> {
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/firebase.messaging' })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(account.client_email!)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(await importPKCS8(account.private_key!, 'RS256'));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!res.ok) throw new Error(`google_auth_${res.status}`);
  const body = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: body.access_token, expires: Date.now() + body.expires_in * 1000 };
  return cached.token;
}
