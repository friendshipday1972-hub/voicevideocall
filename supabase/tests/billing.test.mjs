// End-to-end test of the money and call logic against the real database.
// Everything runs in one transaction that is rolled back, so no data is left behind.
// Run: node --env-file=.env supabase/tests/billing.test.mjs   (needs POSTGRES_URL_NON_POOLING and `npm i pg`)
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import pg from 'pg';

const url = process.env.POSTGRES_URL_NON_POOLING;
if (!url) throw new Error('POSTGRES_URL_NON_POOLING is not set');
const db = new pg.Client({ connectionString: url.replace(/[?&]sslmode=[^&]*/, ''), ssl: { rejectUnauthorized: false } });
await db.connect();

const caller = randomUUID();
const host = randomUUID();
const admin = randomUUID();
let passed = 0;

async function as(uid, sql, params = []) {
  await db.query('reset role');
  await db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: uid, role: 'authenticated', email: uid === admin ? 'test-admin@example.com' : undefined })]);
  await db.query('set local role authenticated');
  return (await db.query(sql, params)).rows;
}
async function asSystem(sql, params = []) {
  await db.query('reset role');
  return (await db.query(sql, params)).rows;
}
async function expectError(promise, code) {
  await db.query('savepoint t');
  try {
    await promise;
    assert.fail(`expected error ${code}`);
  } catch (e) {
    assert.match(e.message, new RegExp(code));
    await db.query('rollback to savepoint t');
  }
}
const step = (name) => {
  passed++;
  console.log(`ok ${passed} - ${name}`);
};
const balance = async () => Number((await asSystem('select coin_balance from wallets where user_id = $1', [caller]))[0].coin_balance);

await db.query('begin');
try {
  await asSystem(`insert into auth.users (id, phone, aud, role) values ($1, '919000000101', 'authenticated', 'authenticated'), ($2, '919000000102', 'authenticated', 'authenticated'), ($3, null, 'authenticated', 'authenticated')`, [caller, host, admin]);
  await asSystem(`insert into profiles (id, role, display_name, email) values ($1, 'admin', 'Admin', 'test-admin@example.com')`, [admin]);

  await as(caller, `select complete_profile('Ravi', 'male', '1998-01-01', 'moon', '{te,en}', 'te', 'v1')`);
  assert.equal(await balance(), 6);
  step('caller signs up and gets 6 welcome coins');

  await expectError(as(randomUUID(), `select complete_profile('Kid', 'male', current_date - 3000, 'moon', '{en}', 'en', 'v1')`), 'under_18|violates foreign key');
  step('under-18 sign-up is refused');

  await as(host, `select complete_profile('Lakshmi', 'female', '1999-05-05', 'flower', '{te,hi}', 'te', 'v1')`);
  const [hostProfile] = await asSystem('select role from profiles where id = $1', [host]);
  assert.equal(hostProfile.role, 'host');
  await expectError(as(host, `select submit_host_application('Lakshmi', 'short', 'Vizag', '{te}', 'ABCDE1234F', '1234', 'upi', 'lak@okaxis', null, null, true)`), 'bio_too_short');
  await expectError(as(host, `select submit_host_application('Lakshmi', 'I love talking about films and music.', 'Vizag', '{te}', 'BAD', '1234', 'upi', 'lak@okaxis', null, null, true)`), 'invalid_pan');
  await as(host, `select submit_host_application('Lakshmi', 'I love talking about films and music.', 'Vizag', '{te,hi}', 'abcde1234f', '1234', 'upi', 'lak@okaxis', null, null, true)`);
  await expectError(as(host, `select set_presence('online')`), 'not_allowed');
  step('woman applies as host; bad PAN/bio refused; cannot go online before approval');

  await expectError(as(caller, `select admin_decide_application($1, true, '')`, [host]), 'not_admin');
  await as(admin, `select admin_decide_application($1, true, 'Looks good')`, [host]);
  await as(host, `select set_presence('online')`);
  const visible = await as(caller, 'select name, presence from public_hosts where id = $1', [host]);
  assert.deepEqual(visible, [{ name: 'Lakshmi', presence: 'online' }]);
  const leaked = await as(caller, 'select * from host_private');
  assert.equal(leaked.length, 0);
  step('admin approves; she goes online; callers see her but never her KYC data');

  await as(admin, `select admin_adjust_coins($1, 100, 'test top-up')`, [caller]);
  assert.equal(await balance(), 106);
  step('admin adds coins (audited)');

  const [{ start_call: sid }] = await as(caller, `select start_call($1, 'audio')`, [host]);
  await expectError(as(caller, `select start_call($1, 'audio')`, [host]), 'already_in_call');
  assert.equal((await asSystem('select presence from hosts where id = $1', [host]))[0].presence, 'busy');
  step('caller rings her; second call refused; she shows busy');

  await expectError(as(caller, 'select accept_call($1)', [sid]), 'not_allowed');
  await as(host, 'select accept_call($1)', [sid]);
  assert.equal(await balance(), 100);
  step('only the host can accept; minute 1 is charged on connect');

  await asSystem(`update call_sessions set started_at = now() - interval '130 seconds' where id = $1`, [sid]);
  const [{ call_tick: t1 }] = await as(caller, 'select call_tick($1)', [sid]);
  assert.equal(t1.billed_minutes, 3);
  assert.equal(t1.balance, 88);
  await as(host, 'select call_tick($1)', [sid]);
  assert.equal(await balance(), 88);
  step('ticks bill minutes 2 and 3; a second tick from the other side does not double-charge');

  await as(caller, `select send_gift($1, 'rose', 'n1')`, [sid]);
  await as(caller, `select send_gift($1, 'rose', 'n1')`, [sid]);
  assert.equal(await balance(), 78);
  step('gift charged once even when sent twice with the same nonce');

  const [{ end_call: summary }] = await as(caller, 'select end_call($1)', [sid]);
  assert.equal(summary.state, 'ended');
  assert.equal(summary.coins_charged, 18);
  assert.equal(summary.refunded_coins, 0);
  assert.equal((await asSystem('select presence from hosts where id = $1', [host]))[0].presence, 'online');
  const [earn] = await asSystem(`select sum(delta_paise)::int as paise from earnings_ledger where host_id = $1`, [host]);
  // 3 minutes × 6 coins × 75 paise × 35% = 472 (floored per minute: 157 × 3 = 471) + rose 10 × 75 × 60% = 450
  assert.equal(earn.paise, 157 * 3 + 450);
  step('call ends: 18 coins used, she earned ₹9.21, back online');

  await as(caller, `select rate_call($1, 5, '{Friendly}', 'Lovely chat')`, [sid]);
  const [stats] = await as(caller, 'select rating_avg, rating_count, calls30d from public_hosts where id = $1', [host]);
  assert.deepEqual(stats, { rating_avg: 5, rating_count: 1, calls30d: 1 });
  const reviews = await as(host, 'select author, comment from public_reviews where host_id = $1', [host]);
  assert.deepEqual(reviews, [{ author: 'Ravi', comment: 'Lovely chat' }]);
  step('rating updates her public stats; she sees the review');

  const [{ start_call: sid2 }] = await as(caller, `select start_call($1, 'video')`, [host]);
  await as(host, 'select accept_call($1)', [sid2]);
  const [{ end_call: short }] = await as(host, 'select end_call($1)', [sid2]);
  assert.equal(short.refunded_coins, 10);
  assert.equal(await balance(), 78);
  step('call under 10 seconds is refunded in full');

  const [{ start_call: sid3 }] = await as(caller, `select start_call($1, 'audio')`, [host]);
  await as(host, 'select decline_call($1)', [sid3]);
  assert.equal((await asSystem('select state from call_sessions where id = $1', [sid3]))[0].state, 'declined');
  const [{ start_call: sid4 }] = await as(caller, `select start_call($1, 'audio')`, [host]);
  await asSystem(`update call_sessions set created_at = now() - interval '2 minutes' where id = $1`, [sid4]);
  await asSystem('select reap()');
  assert.equal((await asSystem('select state from call_sessions where id = $1', [sid4]))[0].state, 'missed');
  step('declined and unanswered (reaper) calls are recorded; nothing charged');

  const presence = async () => (await asSystem('select presence from hosts where id = $1', [host]))[0].presence;
  assert.equal(await presence(), 'online');
  await as(host, `select register_device('fcm-test-token-0123456789', 'android')`);
  await asSystem(`update hosts set last_seen = now() - interval '1 hour' where id = $1`, [host]);
  await asSystem('select reap()');
  assert.equal(await presence(), 'online');
  const [{ start_call: sid6 }] = await as(caller, `select start_call($1, 'audio')`, [host]);
  await as(caller, 'select cancel_call($1, true)', [sid6]);
  assert.equal(await presence(), 'offline');
  await as(host, `select set_presence('online')`);
  await as(host, `select unregister_device('fcm-test-token-0123456789')`);
  await asSystem(`update hosts set last_seen = now() - interval '5 minutes' where id = $1`, [host]);
  await asSystem('select reap()');
  assert.equal(await presence(), 'offline');
  await as(host, `select set_presence('online')`);
  step('with push alerts she stays online in the background; a missed call while away (or no alerts) takes her offline');

  await as(admin, `select admin_adjust_coins($1, -72, 'test')`, [caller]);
  const [{ start_call: sid5 }] = await as(caller, `select start_call($1, 'audio')`, [host]);
  await as(host, 'select accept_call($1)', [sid5]);
  await asSystem(`update call_sessions set started_at = now() - interval '61 seconds' where id = $1`, [sid5]);
  const [{ call_tick: low }] = await as(caller, 'select call_tick($1)', [sid5]);
  assert.equal(low.state, 'ended');
  assert.equal(low.end_reason, 'low_balance');
  assert.equal(await balance(), 0);
  step('call ends with low_balance when the next minute cannot be paid; balance never negative');

  await expectError(as(caller, `select start_call($1, 'audio')`, [host]), 'insufficient_coins');
  await expectError(as(host, 'select request_payout(100)'), 'below_min');
  await expectError(as(host, 'select request_payout(50000)'), 'above_available');
  step('no coins → cannot call; payouts below minimum or above available are refused');

  await as(caller, `select report_user($1, $2, 'harassment', 'rude', true)`, [host, sid]);
  await expectError(as(caller, `select start_call($1, 'audio')`, [host]), 'blocked|insufficient_coins');
  const [rep] = await as(admin, 'select id, severity from reports where reporter_id = $1', [caller]);
  assert.equal(rep.severity, 2);
  await as(admin, `select admin_resolve_report($1, 'strike', 'Checked call', false)`, [rep.id]);
  assert.equal((await asSystem('select strikes from hosts where id = $1', [host]))[0].strikes, 1);
  const audit = await as(admin, `select action from audit_log where target_id in ($1, $2, $3) order by id`, [host, caller, rep.id]);
  assert.ok(audit.map((a) => a.action).includes('strikeAdded'));
  step('report with block; admin strike is applied and audited');

  const [{ count }] = await as(caller, 'select count(*)::int from audit_log');
  assert.equal(count, 0);
  step('non-admins cannot read the audit log');

  const [ledger] = await asSystem(`select (select coin_balance from wallets where user_id = $1) as wallet, (select sum(delta) from coin_ledger where user_id = $1)::bigint as ledger`, [caller]);
  assert.equal(Number(ledger.wallet), Number(ledger.ledger));
  step('ledger sum equals wallet balance');
} finally {
  await db.query('rollback');
  await db.end();
}
console.log(`\n${passed} checks passed (all test data rolled back)`);
