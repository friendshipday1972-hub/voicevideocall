# Baatein: mobile app

Paid 1-on-1 voice and video calling app. It runs on the live Supabase backend: real logins, real people, coins and earnings kept in the database, calls rung and billed in real time. Callers get welcome coins, and buying coins comes with the payments stage.

> `Baatein` is a placeholder brand. Change it in `src/config/appConfig.ts` (`APP_NAME`) and `app.json`.

## Run it

```bash
npm install
npx expo start          # scan the QR code with Expo Go, or open the installed test app
```

The app talks to the Supabase project in `src/config/backend.ts`. Voice and video need the installed app (EAS build), because the Agora SDK is native code. Expo Go runs everything else (login, ringing, billing, gifts, ratings) and shows the call screen without audio.

| Command | What it does |
|---|---|
| `npm test` | Billing, Spotlight and translation unit tests |
| `npm run typecheck` | TypeScript strict check |
| `npx expo lint` | ESLint + React Compiler rules |
| `npx expo-doctor` | Dependency / config health |

## Testing with two phones

Phone login uses Supabase test numbers until an SMS provider is connected. Each test number logs in with a fixed code and no SMS is sent. The numbers are set by `supabase/scripts/configure-auth.mjs`; by default they are +91 9000000001 to 9000000006, code `123456`.

The gender chosen at profile setup decides which app you get:

| | Male / Other → **Caller** | Female → **Host** |
|---|---|---|
| Profile setup | About you → Avatar → Languages | About you → Languages |
| Before using the app | none | **KYC**: host profile → PAN + Aadhaar last 4 + selfie → payout + Host Agreement → under review until an admin approves |
| Tabs | Home · Calls · Wallet · Profile | Dashboard · Calls · Earnings · Profile |

1. **Phone A** (host): log in with a test number, choose **Female**, and complete verification.
2. **Admin dashboard:** approve her under **KYC approvals**. Her app opens the dashboard on its own.
3. **Phone A:** turn **Online** on. She appears on callers' Home screens at once.
4. **Phone B** (caller): log in with another number and choose **Male**. He starts with 6 welcome coins (one voice minute). The admin can add more from the caller's page.
5. **Phone B:** call her. **Phone A** rings full-screen and accepts.
6. **The call:** coins are charged every minute by the server, gifts reach her phone live, and calls under 10 seconds are refunded.
7. **After the call:** he rates it. The rating, her earnings (7-day hold) and the call show up in both apps and on the dashboard right away.

## App languages

The whole interface is available in English, हिन्दी, తెలుగు, தமிழ், ಕನ್ನಡ, മലയാളം, বাংলা and मराठी.

- **First launch** follows the phone's language if it's one of these, otherwise English.
- **Change it** on the welcome screen or from **Profile → App language** (callers and hosts). It applies instantly, with no restart.
- **App language and calling languages are separate.** App language controls menus and buttons; calling languages are the languages you talk in, set in Edit profile.
- **People's own words stay as written:** names, host bios and reviews are user content. Digits stay Latin (₹, 05:32), as usual in Indian apps.
- **Adding or changing text:** strings live in `src/i18n/locales/*.ts`. Add the key to `en.ts` first; TypeScript then requires it in every language, and `npm test` checks that `{placeholders}` match.
- **Before launch:** the translations were machine-drafted with care. Have a native speaker review each language.

## Releasing to testers

- **Installable app:** `eas build --profile preview --platform android` produces an APK with an install link. It only needs rebuilding when native code or `version` in `app.json` changes.
- **Over-the-air updates:** every push to `main` runs [.eas/workflows/publish-preview-update.yml](.eas/workflows/publish-preview-update.yml), which publishes the new JavaScript to the `preview` channel. Testers get it the next time they reopen the app (close it fully and open it twice if it doesn't appear).
- **Manual update:** `eas update --channel preview --message "what changed"`.

## Admin dashboard

The web admin lives in [`../admin`](../admin/README.md) (Next.js). It runs on its own demo dataset with the same 12 hosts and Spotlight scores; the two connect through Supabase in the backend stage.

## Structure

```
src/
  app/                 Expo Router screens
    (auth)/            welcome, phone, otp
    onboarding.tsx     profile setup (18+ gate, avatar, languages, consent)
    (tabs)/            home, calls, wallet, profile (custom animated tab bar)
    host/[id].tsx      host profile (modal)
    call/[hostId].tsx  in-call screen + post-call rating
    quick-match.tsx
    host-kyc.tsx       host verification (pending / rejected states)
    (host)/            host tabs: dashboard, calls, earnings, profile
    host-mode/         incoming call, host in-call screen, feedback
    settings/          edit-profile, blocked, help, delete-account
  components/          design-system components (Button, Sheet, Toast, HostCard, …)
  config/appConfig.ts  rates, shares, limits, loaded from the server `app_config` table
  config/backend.ts    Supabase project URL and publishable key
  data/catalog.ts      fixed lists: languages, avatars, gifts, coin packs, report reasons
  lib/supabase.ts      Supabase client; lib/calls.ts call helpers
  lib/billing.ts       mirror of the server billing rules (unit-tested)
  stores/              Zustand stores backed by Supabase (session, hosts, wallet, social, host)
  theme/               design tokens (colors light/dark, type, spacing, motion)
tests/                billing, Spotlight and translation tests
```

## Design system

From the ui-ux-pro-max skill ("Vibrant & Block-based"): rose `#E11D48` primary, violet accent, Space Grotesk headings, Inter body. Light and dark themes come from `src/theme/tokens.ts`. Components never use raw hex. Motion uses eased timing at 150–300 ms (no springs), press feedback is scale + haptics, and touch targets are at least 44 pt. Layouts are capped at 640 px and centred, and the host grid goes to 3 columns on tablets.

## Backend

- **Login and profile:** Supabase Auth (phone OTP). The profile, role and welcome coins are created by the `complete_profile` database function. Only the app language and notification choices are stored on the phone.
- **Live data:** the stores in `src/stores/` read Supabase and subscribe to Realtime:
  - `hosts.ts`: who is online
  - `wallet.ts`: balance
  - `host.ts`: approval, earnings, payouts, reviews
- **Calls:** `src/lib/calls.ts` plus the call screens.
  1. The server rings her.
  2. She accepts.
  3. Both phones send a heartbeat every 15 s, and the server charges each minute and ends the call when coins run out.
  4. If an update is missed, the app re-checks every few seconds.
- **Voice and video:** `src/components/CallMedia.tsx` joins the Agora channel with a token from the `agora-token` Edge Function. It falls back to the visual-only call screen where the SDK isn't available (Expo Go).
- **Push notifications:** `src/lib/push.ts` registers the phone's Firebase token after login and sets up two Android channels:
  - `calls`: rings at full volume
  - `updates`: approvals, payouts and missed calls

  The server sends them (see `supabase/README.md`). Tapping a call alert opens the app on the incoming-call screen. Expo Go can't receive push; use the installed app.
- **Server rules:** live in `supabase/migrations`. `src/lib/billing.ts` mirrors them for tests and the low-balance countdown.
- **Still to come:**
  - coin purchases (Play Billing / App Store + server verification)
  - KYC provider checks (DigiLocker, PAN, bank/UPI)
