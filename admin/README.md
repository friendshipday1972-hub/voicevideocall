# Baatein Admin

Web dashboard for running the Baatein calling app: analytics, callers, hosts, KYC approvals, calls, payments and payouts, reviews, reports and moderation, Spotlight rankings, an audit log, and app settings.

## Run it

```bash
npm install
npm run dev            # http://localhost:3000
```

Copy `.env.example` to `.env.local` and fill in the Supabase URL and publishable key. Sign in with the admin login created by `npm run create-admin` in `supabase/`. Only accounts whose profile has `role = 'admin'` get in.

| Command | What it does |
|---|---|
| `npm run build && npm start` | Production build and server |
| `npm test` | Spotlight Score engine and translation tests |
| `npm run typecheck` / `npm run lint` | Type and lint checks |

## Deploy on Vercel

1. In Vercel, import the GitHub repo and set **Root Directory** to `admin`. The framework is detected as Next.js; keep the default build settings.
2. Under **Environment Variables**, add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Both are public values from Supabase → Settings → API.
3. Deploy.

## Languages

The dashboard is in English and Telugu. Use the **EN / తెలుగు** switch on the sign-in page, in the top bar, or in the phone menu; the choice is remembered in that browser.

- Strings live in `src/i18n/en.ts` (the source) and `src/i18n/te.ts`. TypeScript fails the build if Telugu is missing a key, and `npm test` checks placeholders and untranslated text.
- Pages call `useT()`; helpers that build text (activity feed, time-ago) take `t` as an argument.
- The audit log stores an action key plus values (`kycApproved`, `coinsAdded {n}`), so each entry shows in whichever language the admin picks. Names, reasons and review text stay as typed.
- Have a native Telugu speaker review `te.ts` before launch.

## Phones

Every page works at phone width. Tables become stacked cards (the first column is the title, the rest are labelled values, row actions at the bottom), dialogs open as bottom sheets, and the theme toggle moves into the menu.

## Security

- **Sign-in:** Supabase Auth with email and password. The dashboard checks that the profile is an admin and sends everyone else back to `/login`.
- **Data:** read straight from the database under row level security. An admin profile can read everything; nobody else can read other people's data, whatever page they open.
- **Changes:** every action calls an `admin_*` database function. It refuses non-admins, makes the change in one transaction and writes the audit log under the admin's email. No service key is ever sent to the browser.
- **Live:** the dashboard subscribes to Supabase Realtime and refreshes on its own when calls, payments, reports or applications change.
- **Still to add:** 2FA and separate moderator and super-admin roles.

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
