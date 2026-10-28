// Connects push notifications: gives the `push` Edge Function the Firebase key, tells the database
// where that function is (Vault), and deploys it. Safe to re-run.
// Needs in the repo root: .env (SUPABASE_ACCESS_TOKEN, POSTGRES_URL_NON_POOLING) and
// firebase-service-account.json (Firebase → Project settings → Service accounts → Generate new private key).
// Run from supabase/: npm run setup-push
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { appendFileSync, readFileSync } from 'node:fs';
import pg from 'pg';

const root = new URL('../..', import.meta.url);
const token = process.env.SUPABASE_ACCESS_TOKEN;
const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!token) throw new Error('Add SUPABASE_ACCESS_TOKEN to .env');
const ref = new URL(url).hostname.split('.')[0];

const account = readFileSync(new URL('firebase-service-account.json', root), 'utf8');
if (!JSON.parse(account).private_key) throw new Error('firebase-service-account.json is not a service account key');

// A shared secret between the database and the function. Generated once and kept in .env.
let secret = process.env.PUSH_SECRET;
if (!secret) {
  secret = randomBytes(32).toString('hex');
  appendFileSync(new URL('.env', root), `\nPUSH_SECRET=${secret}\n`);
}

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/secrets`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify([
    { name: 'FCM_SERVICE_ACCOUNT', value: Buffer.from(account).toString('base64') },
    { name: 'PUSH_SECRET', value: secret },
  ]),
});
if (!res.ok) throw new Error(`Supabase answered ${res.status}: ${await res.text()}`);

const db = new pg.Client({ connectionString: process.env.POSTGRES_URL_NON_POOLING.replace(/\?.*$/, ''), ssl: { rejectUnauthorized: false } });
await db.connect();
for (const [name, value] of [['push_url', `${url}/functions/v1/push`], ['push_secret', secret]]) {
  const { rows } = await db.query('select id from vault.secrets where name = $1', [name]);
  if (rows.length) await db.query('select vault.update_secret($1, $2)', [rows[0].id, value]);
  else await db.query('select vault.create_secret($1, $2)', [value, name]);
}
await db.end();

execFileSync('npx', ['supabase', 'functions', 'deploy', 'push', '--project-ref', ref, '--no-verify-jwt', '--use-api'], { cwd: root, stdio: 'inherit', shell: true });
console.log('Push notifications are connected.');
