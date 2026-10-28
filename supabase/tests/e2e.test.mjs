// End-to-end check of the live backend exactly as the apps use it: real Auth sessions,
// database functions under row level security, and Supabase Realtime delivery.
// Creates throwaway email/password accounts and deletes them (and their data) at the end.
// Run from the repo root: node --env-file=.env supabase/tests/e2e.test.mjs
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
if (!url || !publishable || !service) throw new Error('Supabase URL, publishable and service keys are required');

const root = createClient(url, service, { auth: { persistSession: false } });
const tag = randomUUID().slice(0, 8);
const password = `E2e-${randomUUID()}`;
const people = { caller: `e2e-caller-${tag}@example.com`, host: `e2e-host-${tag}@example.com`, admin: `e2e-admin-${tag}@example.com` };
const ids = {};
let passed = 0;
const step = (name) => console.log(`ok ${++passed} - ${name}`);

async function signedIn(email) {
  const client = createClient(url, publishable, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}
async function call(client, fn, args) {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data;
}
function waitFor(label, register, ms = 10_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for ${label}`)), ms);
    register((value) => {
      clearTimeout(timer);
      resolve(value);
    });
  });
}

try {
  for (const [role, email] of Object.entries(people)) {
    const { data, error } = await root.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    ids[role] = data.user.id;
  }
  const { error: adminErr } = await root.from('profiles').insert({ id: ids.admin, role: 'admin', display_name: 'E2E Admin', email: people.admin });
  if (adminErr) throw adminErr;
  const caller = await signedIn(people.caller);
  const host = await signedIn(people.host);
  const admin = await signedIn(people.admin);
  step('three accounts sign in through Supabase Auth');

  await call(caller, 'complete_profile', { p_display_name: `Ravi ${tag}`, p_gender: 'male', p_dob: '1997-04-02', p_avatar_key: 'moon', p_languages: ['te', 'en'], p_ui_language: 'te', p_consent_version: 'e2e' });
  const { data: wallet } = await caller.from('wallets').select('coin_balance').single();
  assert.equal(Number(wallet.coin_balance), 6);
  await call(host, 'complete_profile', { p_display_name: `Sita ${tag}`, p_gender: 'female', p_dob: '1999-08-15', p_avatar_key: 'flower', p_languages: ['te', 'hi'], p_ui_language: 'te', p_consent_version: 'e2e' });
  await call(host, 'submit_host_application', { p_display_name: `Sita ${tag}`, p_bio: 'I enjoy long conversations about films and food.', p_city: 'Guntur', p_languages: ['te', 'hi'], p_pan: 'ABCDE1234F', p_aadhaar_last4: '4321', p_payout_kind: 'upi', p_upi_id: 'sita@okaxis', p_bank_account: null, p_bank_ifsc: null, p_selfie_done: true });
  step('caller signs up (6 welcome coins); woman applies as host');

  const { data: hidden } = await caller.from('public_hosts').select('id').eq('id', ids.host);
  assert.equal(hidden.length, 0);
  const { data: pending } = await admin.from('hosts').select('approval_status').eq('id', ids.host).single();
  assert.equal(pending.approval_status, 'pending');
  const { data: kycSeenByCaller } = await caller.from('host_private').select('*');
  assert.equal(kycSeenByCaller.length, 0);
  await call(admin, 'admin_decide_application', { p_host: ids.host, p_approve: true, p_note: 'e2e' });
  step('admin sees the application (callers never see KYC) and approves it');

  await call(host, 'set_presence', { p_presence: 'online' });
  const { data: listed } = await caller.from('public_hosts').select('name, presence').eq('id', ids.host).single();
  assert.equal(listed.presence, 'online');
  await call(admin, 'admin_adjust_coins', { p_user: ids.caller, p_delta: 60, p_reason: 'e2e top-up' });
  step('she goes online and appears to callers; admin adds 60 coins');

  // Realtime: the host app listens for rings; the caller app follows its call.
  let onRing;
  let ringChannel;
  await waitFor('ring channel', (done) => {
    ringChannel = host
      .channel(`e2e-ring-${tag}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'call_sessions', filter: `host_id=eq.${ids.host}` }, (p) => onRing?.(p.new))
      .subscribe((status) => status === 'SUBSCRIBED' && done());
  });
  await new Promise((r) => setTimeout(r, 1500)); // the table binding settles just after SUBSCRIBED
  const ring = waitFor('the ring to reach the host', (done) => (onRing = done));
  const sessionId = await call(caller, 'start_call', { p_host: ids.host, p_type: 'audio' });
  const rung = await ring;
  assert.equal(rung.id, sessionId);
  assert.equal(rung.state, 'ringing');
  step('caller rings: the host receives it over Realtime');

  let onUpdate;
  let callChannel;
  await waitFor('call channel', (done) => {
    callChannel = caller
      .channel(`e2e-call-${tag}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'call_sessions', filter: `id=eq.${sessionId}` }, (p) => onUpdate?.(p.new))
      .subscribe((status) => status === 'SUBSCRIBED' && done());
  });
  await new Promise((r) => setTimeout(r, 1500));
  const accepted = waitFor('the caller to see the accept', (done) => (onUpdate = (row) => row.state === 'active' && row.coins_charged > 0 && done(row)));
  await call(host, 'accept_call', { p_session: sessionId });
  const live = await accepted;
  assert.equal(live.coins_charged, 6);
  step('she accepts: the caller sees the call go live in real time; minute 1 charged');

  const media = await Promise.all([caller, host].map((c) => c.functions.invoke('agora-token', { body: { sessionId } })));
  for (const { data, error } of media) assert.ok(!error && data.token && data.appId, `agora-token: ${error?.message ?? JSON.stringify(data)}`);
  assert.deepEqual(media.map((m) => m.data.uid), [1, 2]);
  const outsider = await admin.functions.invoke('agora-token', { body: { sessionId } });
  assert.ok(outsider.error, 'a third person must not get a token');
  step('both people in the call get an Agora token; nobody else does');

  await root.from('call_sessions').update({ started_at: new Date(Date.now() - 75_000).toISOString() }).eq('id', sessionId);
  const tick = await call(caller, 'call_tick', { p_session: sessionId });
  assert.equal(tick.billed_minutes, 2);
  assert.equal(tick.balance, 54);
  await call(caller, 'send_gift', { p_session: sessionId, p_gift: 'rose', p_nonce: 'e2e-1' });
  const summary = await call(caller, 'end_call', { p_session: sessionId });
  assert.equal(summary.coins_charged, 12);
  assert.equal(summary.gift_coins, 10);
  await call(caller, 'rate_call', { p_session: sessionId, p_stars: 5, p_tags: ['Friendly'], p_comment: 'Great chat (e2e)' });
  step('heartbeat bills minute 2, gift sent, call ends (12 coins + 10 gift), rated 5★');

  const { data: balances } = await host.rpc('my_host_balances');
  assert.equal(balances.pending, 157 * 2 + 450);
  const { data: myCalls } = await host.from('my_calls').select('caller_name, rating').eq('id', sessionId).single();
  assert.equal(myCalls.caller_name, `Ravi ${tag}`);
  assert.equal(myCalls.rating, 5);
  step('her earnings (₹7.64 pending) and the rated call show in her app');

  const { data: audit } = await admin.from('audit_log').select('action, actor_email').in('target_id', [ids.host, ids.caller]);
  assert.ok(audit.some((a) => a.action === 'kycApproved' && a.actor_email === people.admin));
  assert.ok(audit.some((a) => a.action === 'coinsAdded'));
  const { data: callerAudit } = await caller.from('audit_log').select('id');
  assert.equal(callerAudit.length, 0);
  step('admin actions are in the audit log under the admin email; callers cannot read it');

  await Promise.all([host.removeChannel(ringChannel), caller.removeChannel(callChannel)]);
} finally {
  // Remove every trace: profiles, calls, ledgers and ratings cascade from the auth users.
  const targets = Object.values(ids);
  if (targets.length) await root.from('audit_log').delete().in('target_id', targets);
  if (ids.admin) await root.from('audit_log').delete().eq('actor', ids.admin);
  for (const id of targets) await root.auth.admin.deleteUser(id);
  console.log(`cleaned up ${targets.length} test accounts`);
}
console.log(`\n${passed} end-to-end checks passed`);
process.exit(0);
