# Baatein Admin

Web dashboard for running the Baatein calling app: analytics, callers, hosts, KYC approvals, calls, payments and payouts, reviews, reports and moderation, Spotlight rankings, an audit log, and app settings.

## Run it

```bash
npm install
npm run dev            # http://localhost:3000
```

Sign in with the credentials in `.env.local`. The dev demo login is **admin@baatein.app** / **Baatein@2026**.

To set your own login:

```bash
npm run hash-password -- "a strong password"   # paste the output into ADMIN_PASSWORD_HASH
```

`.env.example` lists every variable. `SESSION_SECRET` must be 32+ random characters and stay private. `.env.local` is git-ignored.

| Command | What it does |
|---|---|
| `npm run build && npm start` | Production build and server |
| `npm test` | Spotlight Score engine and translation tests |
| `npm run typecheck` / `npm run lint` | Type and lint checks |

## Deploy on Vercel

1. In Vercel, import the GitHub repo and set **Root Directory** to `admin`. The framework is detected as Next.js; keep the default build settings.
2. Under **Environment Variables**, add the three values from `.env.example`:
   - `ADMIN_EMAIL`: the login email.
   - `ADMIN_PASSWORD_HASH`: the output of `npm run hash-password -- "the password"`.
   - `SESSION_SECRET`: 32+ random characters, from `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
3. Deploy. The demo-login hint on the sign-in page only shows in development, never on Vercel.

The demo data lives in each browser, so every admin who opens the site sees their own copy.

## Languages

The dashboard is in English and Telugu. Use the **EN / తెలుగు** switch on the sign-in page, in the top bar, or in the phone menu; the choice is remembered in that browser.

- Strings live in `src/i18n/en.ts` (the source) and `src/i18n/te.ts`. TypeScript fails the build if Telugu is missing a key, and `npm test` checks placeholders and untranslated text.
- Pages call `useT()`; helpers that build text (activity feed, time-ago) take `t` as an argument.
- The audit log stores an action key plus values (`kycApproved`, `coinsAdded {n}`), so each entry shows in whichever language the admin picks. Names, reasons and review text stay as typed.
- Have a native Telugu speaker review `te.ts` before launch.

## Phones

Every page works at phone width. Tables become stacked cards (the first column is the title, the rest are labelled values, row actions at the bottom), dialogs open as bottom sheets, and the theme toggle moves into the menu.

## Security

- **Proxy gate:** `src/proxy.ts` redirects every page except `/login` when there is no valid session.
- **Server check:** the server re-verifies the session (`getCurrentAdmin`, the Data Access Layer) behind a Suspense boundary.
- **Session cookie:** a signed JWT (HS256, 8 hours), `httpOnly`, `sameSite=lax`, and `secure` in production.
- **Passwords:** stored as scrypt hashes and compared in constant time. Error messages don't reveal whether the email exists.
- **Brute-force guard:** 5 failed attempts locks that email for 15 minutes. This is in-memory, so it resets on restart; use Redis/Upstash in production.
- **Audit log:** every action asks for a reason and writes an entry to the Activity log.
- **Still to add:** 2FA and multiple admin roles (moderator vs super admin) come with the backend stage.

## Data (prototype stage)

The dashboard runs on a realistic, deterministic 30-day dataset:
- 184 callers, the same 12 hosts as the mobile app, ~1,000 calls
- purchases, payouts, reports and KYC applications

It's stored in this browser (localStorage). Every action works and persists: approve or reject KYC, suspend or ban, refunds, payouts, strikes, featuring hosts, hiding reviews, and config changes. **App settings → Reset demo data** starts over.

When the Supabase backend is connected:
- `src/lib/data/store.ts` actions become server routes using the service role.
- Reads come from Postgres.
- Admin actions then reach the phones directly. For example, approving KYC moves a woman from "Under review" to her host dashboard.

## Spotlight Score

`src/lib/quality.ts` is an exact copy of `mobile/src/lib/quality.ts`; keep the two identical (both are tested). It scores each host from 0 to 100 on these signals:

| Signal | Points |
|---|---|
| Rating (Bayesian) | 35 |
| Callers who return | 20 |
| Call length | 15 |
| Answer rate | 15 |
| Safety | 10 |
| Consistency | 5 |

Strikes cut the score. The result drives these tiers:

| Tier | Rule |
|---|---|
| Spotlight | 85+ |
| Top rated | 72+ |
| Rising star | new host scoring 68+ |
| At risk | flagged by low score, reports or strikes |

It also drives the "In the spotlight" order callers see, where every 4th slot goes to a rising star.
