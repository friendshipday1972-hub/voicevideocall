# Baatein — mobile app (prototype stage)

Paid 1-on-1 voice/video calling app. This folder is the **Day-15 prototype**: every screen works end to end with sample data, so the client can try the full flow. No backend, no real calls or payments yet.

> `Baatein` is a placeholder brand. Change it in `src/config/appConfig.ts` (`APP_NAME`) and `app.json`.

## Run it

```bash
npm install
npx expo start          # scan the QR code with Expo Go (Android / iOS)
```

The prototype uses only modules bundled in Expo Go, so no development build is needed yet. Agora, CallKeep and IAP (backend stage) will require `eas build --profile development`.

| Command | What it does |
|---|---|
| `npm test` | Billing engine unit tests (Node test runner) |
| `npm run typecheck` | TypeScript strict check |
| `npx expo lint` | ESLint + React Compiler rules |
| `npx expo-doctor` | Dependency / config health |

## Demo script (for the client)

The gender chosen at profile setup decides which app you get:

| | Male / Other → **Caller** | Female → **Host** |
|---|---|---|
| Profile setup | About you → Avatar → Languages | About you → Languages |
| Before using the app | — | **Mandatory KYC**: host profile → PAN + Aadhaar + selfie → payout + Host Agreement → Under review |
| Tabs | Home · Calls · Wallet · Profile | Dashboard · Calls · Earnings · Profile |

Log out from Profile to demo the other flow. In the prototype, logout clears all local data so the next login starts fresh.

### Caller flow

1. **Welcome** → pick app language → **Continue**.
2. Enter any valid mobile number (e.g. `9876543210`) → OTP is **`123456`**. A wrong code shows the error state.
3. **Profile setup**: choose **Male**. Try a date of birth under 18 to see the age block. Then pick an avatar and languages, and accept the terms.
4. **Home**: new callers get **6 welcome coins** (one free voice minute). **In the spotlight** shows hosts with the best impression first (tier badges; every 4th slot is a rising star). Language tabs, live presence, pull to refresh. Favourite a host and you get a toast when she comes online.
5. Tap a call button with 0 coins → the **Add coins** sheet opens. Buy any pack (simulated).
6. **Call** a host: ringing → connected. The timer, coins used and balance update live. Coins are charged per minute. Tap **Gift** to send a rose, coffee, star… (she gets 60%).
   - End within 10 s → automatic refund on the summary screen.
   - With a small balance, the **low-balance banner** appears at 60 s and 20 s; tap **Add** to top up without dropping the call.
   - **Report** mid-call (with block) ends the call.
7. Rate the call with stars, tags and an optional comment. It appears in **Calls**, and on her profile under **What callers say**. **Wallet → History** shows every charge and refund.
8. **Quick Match** on Home: radar search → best online host for the language → call or find someone else.
9. **Profile**: edit profile, notification toggles, blocked users, help / grievance officer, logout, **Delete account**.

### Host flow (women)

1. Log in with a number → profile setup → choose **Female**. The page explains she'll join as a verified host. Then add languages and accept.
2. **Host verification** (cannot be skipped; back offers to log out): host name + bio → PAN + Aadhaar via DigiLocker + live selfie (simulated) → UPI/bank + Host Agreement → **Under review**.
3. Tap **Simulate approval (demo)** → the host app opens on **Dashboard**.
4. Go **online** → **Simulate incoming call** (full-screen ring, accept/decline, auto-miss after 30 s; declines and misses lower her answer rate) → live earnings, a gift arrives ~20 s in → end. A few seconds later the caller's rating arrives.
5. **Dashboard → Your impression**: her **Spotlight score**, tier and latest review. **All feedback** shows the score breakdown, coaching tips, rating distribution, “callers say you’re…” tags and every review.
6. **Calls** tab lists calls with what each earned. **Earnings** shows pending (7-day hold) vs withdrawable, and **Withdraw** (min ₹500).
7. **Profile** shows what callers see, KYC status, payout method, call rates, rules, logout and delete account.

All data is stored on the device (AsyncStorage). Deleting the account or clearing app data resets it.

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
    host-mode/         apply, dashboard, incoming, call, earnings
    settings/          edit-profile, blocked, help, delete-account
  components/          design-system components (Button, Sheet, Toast, HostCard, …)
  config/appConfig.ts  rates, shares, limits — mirrors the server `app_config` table
  data/mock.ts         sample hosts, languages, coin packs (replaced by Supabase)
  lib/billing.ts       billing engine (pure, unit-tested, ported to server RPC later)
  stores/              Zustand stores (session, wallet, social, host, presence)
  theme/               design tokens (colors light/dark, type, spacing, motion)
tests/billing.test.ts
```

## Design system

From the ui-ux-pro-max skill ("Vibrant & Block-based"): rose `#E11D48` primary, violet accent, Space Grotesk headings, Inter body. Light and dark themes come from `src/theme/tokens.ts`. Components never use raw hex. Motion uses Reanimated springs at 150–300 ms, press feedback is scale + haptics, and touch targets are at least 44 pt. Layouts are capped at 640 px and centred, and the host grid goes to 3 columns on tablets.

## Moving to the real backend (next stage)

- Replace `data/mock.ts` + `stores/presence.ts` with Supabase queries and a Realtime channel.
- Move `lib/billing.ts` logic into Postgres RPC / Edge Functions (`call-start`, `call-tick`, `call-end`). The client then only displays balances.
- `stores/wallet.ts` `purchase()` → `react-native-iap` + `verify-purchase`.
- Call screen placeholders (`RemoteVideo`, `SelfView`) → Agora views. Incoming call → CallKeep + FCM.
