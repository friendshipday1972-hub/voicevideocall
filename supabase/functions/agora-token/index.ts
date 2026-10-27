// Issues a short-lived Agora RTC token for one active call.
// Only the two people in the call get a token, and only while the call is active.
// Secrets: AGORA_APP_ID, AGORA_APP_CERTIFICATE (set with `supabase secrets set`).
import { createClient } from 'npm:@supabase/supabase-js@2';
import agora from 'npm:agora-token@2.0.5';

const { RtcRole, RtcTokenBuilder } = agora;
const TOKEN_SECONDS = 2 * 60 * 60; // a call can't outlive this; billing ends it long before

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  const appId = Deno.env.get('AGORA_APP_ID');
  const certificate = Deno.env.get('AGORA_APP_CERTIFICATE');
  if (!appId || !certificate) return json({ error: 'agora_not_configured' }, 500);

  const { sessionId } = await req.json().catch(() => ({ sessionId: null }));
  if (typeof sessionId !== 'string') return json({ error: 'bad_request' }, 400);

  // Act as the signed-in caller/host, so row level security decides what they can see.
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return json({ error: 'not_signed_in' }, 401);

  const { data: call } = await supabase.from('call_sessions').select('id, caller_id, host_id, state, agora_channel').eq('id', sessionId).maybeSingle();
  if (!call || (call.caller_id !== user.user.id && call.host_id !== user.user.id)) return json({ error: 'not_allowed' }, 403);
  if (call.state !== 'active') return json({ error: 'call_over' }, 409);

  // Fixed ids per side keep the two streams apart: caller 1, host 2.
  const uid = call.caller_id === user.user.id ? 1 : 2;
  const token = RtcTokenBuilder.buildTokenWithUid(appId, certificate, call.agora_channel, uid, RtcRole.PUBLISHER, TOKEN_SECONDS, TOKEN_SECONDS);
  return json({ appId, token, uid });
});
