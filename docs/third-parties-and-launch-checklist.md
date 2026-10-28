# Baatein: third parties, costs and launch checklist

Every outside service the app will use, what it costs, and which one to pick. After that: the legal, business, tax and Play Store work to finish before launch, as checklists.

> **Prices are estimates from general knowledge, not quotes.** Vendors change prices often. Check each one on the vendor's pricing page or with their sales team before signing up. ₹ figures assume roughly ₹88 = $1.

---

## Part 1: Third-party services

### Summary: what to pick

| Need | Pick | Why | Cost model | Status |
|---|---|---|---|---|
| Backend (database, login, realtime) | **Supabase** | Already built on it | Free now, **$25/month (~₹2,200)** Pro at launch | ✅ In use |
| Admin website hosting | **Vercel** | Easiest for Next.js | Free for testing, **$20/month** Pro for commercial use | ✅ Ready to deploy |
| App builds and over-the-air updates | **Expo EAS** | Already set up | Free tier now, **$19/month** Starter later | ✅ In use |
| Voice and video calls | **Agora** | Already integrated, reliable in India | **10,000 free minutes/month**, then pay per minute | 🟡 Needs App ID |
| OTP SMS | **MSG91** | Cheapest reliable India SMS, built for DLT | **~₹0.20–0.30 per SMS** | ⏳ Later (test numbers now) |
| Coin purchases (in the app) | **Google Play Billing** (+ Apple IAP for iPhone) | Required by Play / Apple for digital coins | **15% of each sale** | ⏳ Next stage |
| Coin purchases (website, optional) | **Razorpay** or **Cashfree** | Web top-ups outside the store | **~2% per payment** | ⏳ Optional |
| Paying hosts | **Cashfree Payouts** (or RazorpayX) | Instant UPI/bank transfers through an API | **~₹2–6 per payout** | ⏳ Manual now, API later |
| KYC: Aadhaar, PAN, bank, UPI, selfie | **Cashfree Secure ID** (or Surepass for lowest price) | Pay per check, no minimum; same company as payouts | **~₹1–10 per check** | ⏳ Next stage |
| Push notifications | **Firebase Cloud Messaging** | Free; needed for ringing when the app is closed | **Free** | ⏳ Next stage |
| Video safety scanning | **Google Cloud Vision (SafeSearch)** | Cheap nudity detection on snapshots | **~$1.50 per 1,000 images**, first 1,000/month free | ⏳ Later |
| Crash reports | **Sentry** | Free tier is enough at start | **Free** | ⏳ Later |
| Product analytics | **PostHog** | 1M events/month free | **Free** | ⏳ Later |
| Domain, support and grievance email | Any registrar + **Zoho Mail** | Needed for legal pages and the grievance officer | **~₹1,000/year** domain; Zoho free tier | ⏳ Before launch |
| Store accounts | **Google Play Console**, Apple Developer | Publishing | **$25 one-time** (Play), **$99/year** (Apple) | 🟡 Play needed soon |

### 1. Backend: Supabase
- **What it does:** database, phone login, live updates, file storage, server functions. Already in use.
- **Plans:**
  - **Free:** fine for testing. The project pauses after a week without activity, and storage is small.
  - **Pro, $25/month:** daily backups, no pausing, more database space and bandwidth. **Move to Pro before real users.**
- **Alternatives:** Firebase or AWS. Not worth switching; everything is built on Supabase.

### 2. Admin website: Vercel
- **What it does:** hosts the admin dashboard.
- **Plans:**
  - **Hobby (free):** testing only; the terms forbid commercial use.
  - **Pro, $20/month per member:** for commercial use.
- **Cheaper alternative:** Cloudflare Pages (free, commercial use allowed). The dashboard can move there later if you want to save the $20.

### 3. App builds and updates: Expo EAS
- **What it does:** builds the APK, sends over-the-air updates, and will submit to Play.
- **Plans:**
  - **Free:** a limited number of builds per month, updates for up to 1,000 monthly users.
  - **Starter (~$19/month):** more builds and more update users. Move up when users grow.

### 4. Voice and video calls: Agora ✅ recommended
- **Pricing:**
  - **Free:** 10,000 minutes per month.
  - **Audio:** about **$0.99 per 1,000 minutes** (~₹0.09/min).
  - **HD video:** about **$3.99 per 1,000 minutes** (~₹0.35/min).
- **Cost against revenue:** with callers paying ~₹4.50/min for voice and ~₹7.50/min for video, calling costs about 2–5% of revenue.

| Option | Notes |
|---|---|
| **Agora** | Already integrated. Strong India network. Pay as you go. |
| 100ms | Indian company, similar prices, good support. Would need re-integration. |
| ZEGOCLOUD | Similar prices; popular with calling apps. |
| LiveKit Cloud | Open source; self-hosting can be cheapest at large scale, but needs servers and DevOps. |

**Decision:** stay on Agora. Revisit only past roughly 5–10 lakh minutes a month.

### 5. OTP SMS: MSG91 ✅ recommended
- **Rule:** every business SMS in India must go through **DLT registration**:
  1. Register your company as a sender ("entity").
  2. Register a 6-letter sender ID (for example `BAATEN`).
  3. Get the OTP message template approved.

  This takes about 3–7 days. Some operators charge a one-time fee of a few thousand rupees.
- **How it connects:** Supabase sends the SMS through MSG91 via an "auth hook", without code changes in the app.

| Option | Approx. cost per OTP | Notes |
|---|---|---|
| **MSG91** | ₹0.20–0.30 | India-first, DLT help, OTP widget, cheapest at volume |
| 2Factor.in | ₹0.20–0.25 | Cheap, simple; smaller company |
| Twilio | ₹3–6 | Already supported by Supabase, but 10–20× more expensive and less reliable in India |
| Firebase Phone Auth | ~₹1+ per SMS | Would mean moving login away from Supabase |

- **Free alternative to consider:** WhatsApp OTP through MSG91 or Gupshup. Often cheaper than SMS and more reliable. You could offer both.

### 6. Selling coins (payment)
**The rule:** coins are digital goods used inside the app.
- **Play Store:** you **must** offer **Google Play Billing**.
- **iPhone:** you must use **Apple In-App Purchase**.
- **Not allowed:** Razorpay or Cashfree as the only way to pay inside the app. The app would be removed.

| Option | Fee | Notes |
|---|---|---|
| **Google Play Billing** | **15%** of each sale on the first $1M/year (enroll in the 15% tier) | Mandatory on Android. Google handles cards, UPI and refunds. |
| **Apple In-App Purchase** | **15%** (Small Business Program) | For the iPhone app later |
| Google "User Choice Billing" (India) | Play fee drops by **4 points** when the user picks your gateway | You may show Razorpay **next to** Play Billing; you still pay Google ~11% plus the gateway's ~2% |
| **Razorpay / Cashfree** (website top-ups) | ~2% per payment | Coins bought on your website can be used in the app. Don't link to it from inside the app; Play restricts that. |

- **Recommendation:** launch with **Google Play Billing only**. Add User Choice Billing with Razorpay later if the 4-point saving matters.
- **Built-in safety:** the server checks every purchase with Google before adding coins; the database is already built for this.

### 7. Paying hosts
- **Now (no cost):** the admin approves a withdrawal in the dashboard, pays by UPI or bank transfer from the company account, then clicks **Mark paid** with the UTR number. Already built.
- **Later (automatic):** the payout API sends the money the moment the admin approves.

| Option | Approx. cost per payout | Notes |
|---|---|---|
| **Cashfree Payouts** | ₹2–6 (UPI cheapest) | Same company as Cashfree KYC: one account and one agreement |
| RazorpayX Payouts | ₹2–6 | Pick this if you use Razorpay for web payments |
| Manual bank transfer | Free (bank charges, if any) | Fine for a few dozen payouts a week |

- **Requirements for either API:** a company **current account** and the provider's own business KYC.
- **Recommendation:** manual until ~50 payouts a week, then Cashfree Payouts. Keep the 7-day hold and admin approval either way.

### 8. KYC and verification for hosts
**What the app needs to verify and how:**

| Check | How it's done | Approx. cost per check |
|---|---|---|
| **Aadhaar** (name, gender, age, photo) | **DigiLocker** consent flow through the provider. You never see or store the full Aadhaar number. | ₹3–10 |
| **PAN** | Matched against the Income Tax / NSDL record, with a name match | ₹1–3 |
| **Bank account** | "Penny drop": ₹1 sent to the account and the account-holder name returned | ₹1–3 |
| **UPI ID** | UPI lookup returns the account-holder name | ₹1–2 |
| **Selfie liveness + face match** | Checks it's a live person and the same face as the Aadhaar/DigiLocker photo | ₹2–8 |

About **₹10–25 per host** in total, paid once at sign-up.

| Provider | Notes |
|---|---|
| **Cashfree Secure ID** ✅ | Pay as you go, no minimum, all checks above. Same account as Cashfree Payouts. |
| **Surepass** | Often the cheapest per check; good docs; smaller company |
| Setu | Clean APIs (DigiLocker, PAN, bank); part of Pine Labs |
| Digio | Strong DigiLocker and e-sign; better for larger contracts |
| IDfy / HyperVerge / Signzy | Enterprise-grade, best face match; usually minimum commitments |

- **Rule:** as a private company you can't run Aadhaar OTP e-KYC yourself (that needs UIDAI licensing). **DigiLocker through a provider is the allowed route.**
- **Recommendation:** Cashfree Secure ID, or Surepass if price matters most.

### 9. Push notifications: Firebase Cloud Messaging (free)
- **What it does:** rings the host when her app is closed, plus "your favourite is online" and payout updates.
- **Cost:** free. Apple's push service (for iPhone) is included in the $99/year developer account.

### 10. Safety: video snapshot scanning
- **What it does:** every 30–60 seconds of a video call, one frame from the host's camera is checked for nudity. A high score ends the call and refunds the caller.

| Option | Approx. cost |
|---|---|
| **Google Cloud Vision SafeSearch** ✅ | ~$1.50 per 1,000 images; first 1,000/month free |
| AWS Rekognition | ~$1 per 1,000 images |
| Sightengine | Plans from ~$29/month; tuned for dating and chat apps |

### 11. Smaller tools
| Tool | Use | Cost |
|---|---|---|
| Sentry | App and website crash reports | Free tier |
| PostHog | Funnels, retention, feature flags | Free up to 1M events/month |
| Domain (e.g. `baatein.app`) | Website, legal pages, email | ~₹1,000–1,500/year |
| Zoho Mail / Google Workspace | support@ and grievance@ email | Zoho free tier; Workspace ~₹136/user/month |
| Resend | Emails (payout statements, admin alerts) | Free up to 3,000/month |

### Monthly cost estimate

Rough monthly running cost at launch (a few hundred active users, ~20,000 call minutes a month):

| Item | Approx. per month |
|---|---|
| Supabase Pro | ₹2,200 |
| Vercel Pro (or Cloudflare free) | ₹1,800 (or ₹0) |
| Expo EAS (free tier at start) | ₹0 → ₹1,700 |
| Agora (~20k min; first 10k free) | ₹100–1,000 |
| OTP SMS (~2,000 logins) | ₹500 |
| KYC (~30 new hosts) | ₹500 |
| Payouts (manual at start) | ₹0 |
| Domain + email | ₹100 |
| **Total** | **~₹5,000–8,000/month** |

**Not counted above:**
- Google's 15% on coin sales (taken from revenue, not billed separately).
- One-time costs: Play account $25, DLT registration, company registration, legal drafting.

---

## Part 2: Launch checklists

> General guidance, not legal advice. Have a lawyer draft the documents and a CA confirm the tax treatment.

### A. DPDP Act 2023 (personal data protection)
The DPDP Rules (2025) bring duties in over a phase-in period; check the current deadlines with your lawyer. Building it right from day one costs little.

**Notice and consent**
- [ ] Write a **privacy notice in plain language**: what is collected (phone, name, date of birth, gender, call records, audio/video during calls, hosts' PAN/bank/UPI), why, how long it's kept, who it's shared with (Supabase, Agora, KYC provider, Google).
- [ ] Offer the notice in English and the app's languages (users may ask for any of India's 22 scheduled languages).
- [ ] Get **explicit consent** at sign-up, separately for hosts' KYC. *(The app stores the consent time and version; add a host-specific KYC consent.)*
- [ ] Let people **withdraw consent** as easily as they gave it.

**Collect less, keep less**
- [ ] Store only what's needed. *(Done: only the last 4 digits of Aadhaar.)*
- [ ] Set a **retention schedule**: for example, delete call metadata after N months, KYC documents X years after a host leaves, keep billing records 8 years (tax law).
- [ ] **Delete data** when someone deletes their account, except records the law requires. *(Delete account exists in the app; add a web page too.)*

**Security**
- [ ] Encrypt PAN and bank details in the database (Supabase Vault).
- [ ] Limit admin access; turn on 2FA for admins; keep access logs.
- [ ] Have a **breach plan**: tell the Data Protection Board and affected users without delay (the rules ask for a detailed report within 72 hours).

**Rights and children**
- [ ] Publish a **contact for data requests** (access, correction, deletion) and answer within the required time.
- [ ] Block under-18s. *(Done: date-of-birth gate. KYC adds a real age check for hosts.)*

**Vendors**
- [ ] Sign **data processing terms** with each vendor that handles personal data: Supabase, Agora, KYC provider, SMS provider, Google.

### B. IT Rules 2021 (intermediary rules)
The app hosts user conversations, so it is an "intermediary".
- [ ] Publish a **Grievance Officer**: name, email and address, in the app and on the website. *(Placeholder in the app now.)*
- [ ] **Acknowledge complaints within 24 hours, resolve within 15 days.** Act faster on sexual content and impersonation: these must be removed within 24 hours of a complaint.
- [ ] Publish **Terms of Use, Privacy Policy and Community Guidelines**, and remind users of them at least once a year.
- [ ] Ban obscene, sexual, harassing and illegal content in the terms. Enforce it with:
  - report and block *(done)*
  - the moderation queue *(done)*
  - snapshot scanning *(later)*
- [ ] Remove content or accounts when a court or government order arrives, within the time it states.
- [ ] Keep records of removed content and user details for **180 days** after removal, for investigations.
- [ ] Help law enforcement when legally asked (within 72 hours).
- [ ] Watch user numbers: past **50 lakh users** you become a "significant" intermediary with extra duties (Chief Compliance Officer, monthly reports).

### C. Business setup
- [ ] **Register a company:** a **Private Limited** company is best (Play, Apple, payment and payout providers prefer it). Cost ~₹7,000–15,000 through a filing service. An LLP is cheaper to run but less accepted.
- [ ] **Company PAN and TAN** (TAN is needed to deduct TDS on host payouts).
- [ ] **GST registration:** required for selling digital services.
- [ ] **Current bank account** in the company's name (needed for payouts, gateways and Play payments).
- [ ] **D-U-N-S number:** free, needed for **organisation** accounts on Google Play and Apple.
- [ ] Udyam (MSME) registration: optional, free, gives some benefits.
- [ ] **Trademark** for the app name (~₹4,500–9,000 per class). Check the name is free first; "Baatein" is a placeholder.
- [ ] Have a lawyer draft these documents:
  - [ ] Terms of Use
  - [ ] Privacy Policy
  - [ ] Community Guidelines
  - [ ] Refund Policy (coins)
  - [ ] **Host Agreement:** hosts are independent earners, not employees; earnings, hold period, deductions, conduct rules, termination.
- [ ] **Website** with the legal pages, a support contact, the grievance officer and an **account-deletion page** (Play requires a web link).
- [ ] Support email (support@) and grievance email (grievance@) on your domain.

### D. Tax
Confirm every line with a CA.
- [ ] **GST on coin sales:** confirm whether Google collects and pays GST on Play purchases for you, or you must. File GST returns monthly or quarterly.
- [ ] **TDS on host payouts:** the CA picks the section and rate. Then each quarter:
  - [ ] deduct TDS on each payout
  - [ ] deposit it by the 7th of the next month
  - [ ] file quarterly TDS returns
  - [ ] give each host a **Form 16A**

  *(The dashboard shows a placeholder 1% today; we'll set the real rate.)*
- [ ] **Collect PAN from every host.** *(Done: without a PAN, TDS is a much higher rate.)*
- [ ] Give hosts an **annual earnings statement**; they file their own income tax.
- [ ] Company income tax: advance tax, yearly return, statutory audit (Pvt Ltd).
- [ ] Bookkeeping: monthly reconciliation of Google payouts, coin liability (coins sold but not yet used), and host payouts.

### E. Google Play Store
**Account and listing**
- [ ] Create the Play Console account as an **Organisation** (needs the D-U-N-S number). Personal accounts must first run a closed test with 12 testers for 14 days.
- [ ] Store listing: name, description, screenshots, feature graphic, support email, privacy policy URL.
- [ ] **Content rating questionnaire** answered honestly; expect **18+ / Adults only**.
- [ ] **Data safety form** matching exactly what's collected: phone, name, DOB, gender, audio/video, hosts' financial info, purchase history, device IDs.
- [ ] **Account deletion:** in the app *(done)* + a web URL.

**Permissions and calling**
- [ ] Declare camera and microphone use (only during calls).
- [ ] Declare the **foreground service** types for calls (phone call / microphone / camera).
- [ ] Declare the **full-screen intent** permission for incoming calls (allowed for calling apps).

**Billing and policy**
- [ ] Integrate **Play Billing** for coins and enrol in the **15% service fee** tier.
- [ ] **Policy risk:** Play doesn't allow sexual content, sexual services, or apps that look like paid companionship for sexual purposes. Keep the listing, screenshots and guidelines clearly about **friendly conversation**. Keep moderation strict and visible (report, block, KYC, snapshot scanning). This is the biggest launch risk; read Play's "Inappropriate Content" and "User Generated Content" policies before submitting.
- [ ] Keep the **target API level** current (Expo updates handle most of this).

**Release steps**
- [ ] Internal testing → closed testing → production with a staged rollout (start at 10–20%).

**iPhone later:** Apple adds the $99/year account, In-App Purchase for coins, and the same moderation and account-deletion rules. Its review is stricter on user-generated content and age rating.

---

## Part 3: Suggested order

| Step | What | Needs from you |
|---|---|---|
| 1 | Finish the live setup: phone login (test numbers), admin account, Agora, Vercel deploy, new APK | Supabase access token, Agora App ID + certificate, admin email/password |
| 2 | Start the company setup: Pvt Ltd, GST, current account, D-U-N-S | Founder documents, address |
| 3 | DLT registration + MSG91 → real SMS OTP | Company documents |
| 4 | Firebase push → calls ring when the app is closed | Firebase project |
| 5 | KYC provider (Cashfree Secure ID or Surepass) → automatic host verification | Provider account |
| 6 | Play Console (organisation) + Play Billing → real coin purchases | D-U-N-S, Play account |
| 7 | Legal documents + website + grievance officer | Lawyer |
| 8 | Payout API (Cashfree Payouts) when volume needs it; CA sets TDS | Current account, CA |
| 9 | Snapshot moderation, Sentry, PostHog | Google Cloud account |
| 10 | Play Store internal → closed → production release | All of the above |
