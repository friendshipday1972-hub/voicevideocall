# Baatein backend (Supabase)

Postgres, Auth, Realtime and one Edge Function. Both apps talk to it directly. Row level security decides what each signed-in person can read, and every change that involves money, calls or moderation goes through a database function.

## Layout

| Path | What it is |
|---|---|
| `migrations/` | Tables, security rules, server logic, realtime and scheduled jobs. Applied with the CLI, never edited in the dashboard. |
| `functions/agora-token/` | Issues a short-lived Agora token to the two people in an active call. |
| `functions/push/` | Sends push notifications through Firebase. Only the database calls it. |
| `scripts/` | One-off setup: turn on phone login, create the admin login, apply migrations. |
| `tests/` | `billing.test.mjs` runs inside a rolled-back transaction. `e2e.test.mjs` uses real logins and Realtime, then deletes its test accounts. |

Install once: `cd supabase && npm install`. Every script reads the root `.env`.

| Command | What it does |
|---|---|
| `npm run migrate` | Applies new migrations (`supabase db push`) |
| `npm run test:db` | Billing, calls, payouts and moderation rules (19 checks, nothing saved) |
| `npm run test:e2e` | Two apps and an admin end to end over the live project (11 checks, cleans up) |
| `npm run configure-auth` | Turns on phone login with test numbers (needs `SUPABASE_ACCESS_TOKEN`) |
| `npm run create-admin` | Creates or resets the dashboard login from `ADMIN_EMAIL` / `ADMIN_PASSWORD` |
| `npm run setup-push` | Connects push notifications: Firebase key to the `push` function, its address to Vault, deploys it |

## How the important parts work

- **Money.** Coins and host earnings are append-only ledgers with a unique key per entry, so a retried request can never charge twice. Balances can't go below zero.
- **Calls.**
  1. `start_call` rings the host (she receives it over Realtime).
  2. `accept_call` charges minute 1.
  3. `call_tick` is called every 15 seconds by both phones and charges each new minute.
  4. `end_call` refunds calls under 10 seconds.
- **Scheduled clean-up.** A job runs every minute to:
  - mark unanswered calls as missed
  - end calls whose phones stopped responding for 45 seconds
  - set hosts whose app went quiet to offline
- **Host levels.** These are recomputed every night.
- **Admin.** An admin is a `profiles` row with `role = 'admin'`. Admins can read everything. Every `admin_*` function checks the role, makes the change and writes `audit_log`.
- **Push notifications.**
  - Phones save their Firebase token with `register_device`.
  - Database triggers queue a request to the `push` function (via `pg_net`) when:
    - a call rings
    - a ringing call is missed or cancelled (this notification replaces the ring)
    - a host is approved or rejected
    - a payout is paid or rejected
  - The function writes the text in the person's app language and sends it through Firebase.
  - Its address and shared secret are kept in Vault. Until `setup-push` has run, the triggers do nothing.
- **Host presence.** A host stays online in the background as long as her phone can receive call alerts, for up to 8 hours since she last opened the app. If she misses a call while away, she's switched offline. Without alerts, she goes offline 3 minutes after the app goes quiet.
- **Sensitive data.** PAN and payout details live in `host_private`, which only the host herself and admins can read. Only the last 4 digits of Aadhaar are stored.

## Deploying the Edge Function

```bash
npx supabase secrets set AGORA_APP_ID=... AGORA_APP_CERTIFICATE=... --project-ref <ref>
npx supabase functions deploy agora-token --project-ref <ref>
```

Both need `SUPABASE_ACCESS_TOKEN` in the environment.
