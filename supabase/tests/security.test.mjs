// Attack test against the live project: what a stranger, an email-only sign-up and a real caller
// can try with the public app key. Every attempt must fail. Test accounts are deleted at the end.
// Run from supabase/: npm run test:security
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
const root = createClient(url, service, { auth: { persistSession: false } });
const password = `Sec-${randomUUID()}`;
const ids = [];
let passed = 0;
const step = (name) => console.log(`ok ${++passed} - ${name}`);

const tables = ['profiles', 'hosts', 'host_private', 'wallets', 'coin_ledger', 'earnings_ledger', 'payout_requests', 'call_sessions', 'gift_events',
  'ratings', 'reports', 'blocks', 'favorites', 'device_tokens', 'audit_log', 'host_active_days', 'purchases', 'app_config', 'coin_packs', 'gifts'];
const views = ['public_hosts', 'public_reviews', 'host_stats', 'my_calls', 'my_earnings', 'my_blocks', 'my_host'];

async function account(login) {
  const { data, error } = await root.auth.admin.createUser({ ...login, password, email_confirm: !!login.email, phone_confirm: !!login.phone });
  if (error) throw error;
  ids.push(data.user.id);
  const client = createClient(url, publishable, { auth: { persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ ...login, password });
  if (signInError) throw signInError;
  return { client, id: data.user.id };
}
const rows = async (client, name) => {
  const { data, error } = await client.from(name).select('*').limit(5);
  return error ? [] : data;
};
const denied = async (promise) => {
  const { error } = await promise;
  assert.ok(error, 'expected the request to be refused');
  return error.message;
};

try {
  // A real host and caller to attack.
  const phone = () => `9156${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
  const host = await account({ phone: phone() });
  await host.client.rpc('complete_profile', { p_display_name: 'Target Host', p_gender: 'female', p_dob: '1995-01-01', p_avatar_key: 'flower', p_languages: ['te'], p_ui_language: 'te', p_consent_version: 'sec' });
  await host.client.rpc('submit_host_application', { p_display_name: 'Target Host', p_bio: 'I like talking about books and travel.', p_city: 'Vizag', p_languages: ['te'], p_pan: 'ABCDE1234F', p_aadhaar_last4: '1234', p_payout_kind: 'upi', p_upi_id: 'target@okaxis', p_bank_account: null, p_bank_ifsc: null, p_selfie_done: true });
  await root.from('hosts').update({ approval_status: 'approved' }).eq('id', host.id);
  const caller = await account({ phone: phone() });
  const { error: profileError } = await caller.client.rpc('complete_profile', { p_display_name: 'Attacker', p_gender: 'male', p_dob: '1995-01-01', p_avatar_key: 'moon', p_languages: ['te'], p_ui_language: 'te', p_consent_version: 'sec' });
  assert.ifError(profileError);

  // 1. Not signed in: nothing readable, nothing callable.
  const anon = createClient(url, publishable, { auth: { persistSession: false } });
  for (const name of [...tables, ...views]) assert.equal((await rows(anon, name)).length, 0, `anon read ${name}`);
  for (const fn of ['start_call', 'admin_adjust_coins', 'complete_profile', 'is_admin', 'register_device']) await denied(anon.rpc(fn, {}));
  step('signed out: no table or view is readable and no function is callable');

  // 2. Email-only sign-up (no phone): no membership, no welcome coins, no host list.
  const emailUser = await account({ email: `sec-${randomUUID().slice(0, 8)}@example.com` });
  assert.match(await denied(emailUser.client.rpc('complete_profile', { p_display_name: 'Farm', p_gender: 'male', p_dob: '1995-01-01', p_avatar_key: 'moon', p_languages: ['te'], p_ui_language: 'te', p_consent_version: 'x' })), /phone_required/);
  for (const name of ['public_hosts', 'public_reviews', 'host_stats', 'hosts']) assert.equal((await rows(emailUser.client, name)).length, 0, `email user read ${name}`);
  step('email-only sign-ups cannot become members, collect coins or browse hosts');

  // 3. A real caller trying to reach other people's data.
  assert.ok((await rows(caller.client, 'public_hosts')).some((h) => h.id === host.id), 'members do see approved hosts');
  for (const name of ['host_private', 'audit_log', 'device_tokens', 'earnings_ledger', 'payout_requests']) assert.equal((await rows(caller.client, name)).length, 0, `caller read ${name}`);
  const profiles = await rows(caller.client, 'profiles');
  assert.ok(profiles.every((p) => p.id === caller.id), 'caller sees only their own profile');
  const hostRow = (await rows(caller.client, 'hosts')).find((h) => h.id === host.id);
  assert.ok(hostRow && !('pan' in hostRow), 'host rows carry no KYC');
  step('a caller sees only their own private data; host KYC is never exposed');

  // 4. A real caller trying to change money, roles or moderation directly.
  await denied(caller.client.from('profiles').update({ role: 'admin' }).eq('id', caller.id).select().single());
  await denied(caller.client.from('wallets').update({ coin_balance: 999999 }).eq('user_id', caller.id).select().single());
  await denied(caller.client.from('coin_ledger').insert({ user_id: caller.id, delta: 1000, reason: 'adjust', idempotency_key: randomUUID(), balance_after: 1000 }));
  await denied(caller.client.from('hosts').update({ approval_status: 'approved' }).eq('id', caller.id).select().single());
  await denied(caller.client.from('device_tokens').insert({ user_id: host.id, token: 'stolen-token-0123456789' }));
  const { data: wallet } = await caller.client.from('wallets').select('coin_balance').single();
  assert.equal(Number(wallet.coin_balance), 6);
  const { data: me } = await caller.client.from('profiles').select('role').single();
  assert.equal(me.role, 'user');
  step('direct writes to profiles, wallets, ledgers, hosts and push tokens are refused');

  for (const [fn, args] of [
    ['admin_adjust_coins', { p_user: caller.id, p_delta: 1000, p_reason: 'x' }],
    ['admin_decide_application', { p_host: caller.id, p_approve: true, p_note: '' }],
    ['admin_update_config', { p_patch: { trialCoins: 9999 } }],
  ]) assert.match(await denied(caller.client.rpc(fn, args)), /not_admin/);
  for (const fn of ['_apply_coins', '_earn', '_end_call', '_push', 'reap']) await denied(caller.client.rpc(fn, {}));
  step('admin and internal functions refuse a caller');

  // 5. Abuse of the public functions.
  assert.match(await denied(caller.client.rpc('report_user', { p_target: host.id, p_session: randomUUID(), p_category: 'harassment', p_details: '', p_block: false })), /not_allowed/);
  assert.match(await denied(caller.client.rpc('update_my_profile', { p_display_name: 'x'.repeat(500) })), /invalid_name/);
  assert.match(await denied(caller.client.rpc('update_my_profile', { p_languages: ['te', '<script>'] })), /bad_request/);
  assert.match(await denied(caller.client.rpc('submit_host_application', { p_display_name: 'x', p_bio: 'b'.repeat(30), p_city: '', p_languages: ['te'], p_pan: 'ABCDE1234F', p_aadhaar_last4: '1234', p_payout_kind: 'upi', p_upi_id: 'a@b', p_bank_account: null, p_bank_ifsc: null, p_selfie_done: true })), /not_allowed/);
  step('reports must point at your own call; oversized or junk input is rejected; callers cannot apply as hosts');

  // 6. Edge functions.
  const push = await fetch(`${url}/functions/v1/push`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-push-secret': 'guess' }, body: '{"kind":"kyc","user":"x","status":"approved"}' });
  assert.equal(push.status, 401);
  const token = await fetch(`${url}/functions/v1/agora-token`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"sessionId":"x"}' });
  assert.equal(token.status, 401);
  const notMine = await caller.client.functions.invoke('agora-token', { body: { sessionId: randomUUID() } });
  assert.ok(notMine.error);
  step('push cannot be triggered without the server secret; call tokens need a login and your own call');
} finally {
  for (const id of ids) await root.auth.admin.deleteUser(id);
  console.log(`cleaned up ${ids.length} test accounts`);
}
console.log(`\n${passed} security checks passed`);
