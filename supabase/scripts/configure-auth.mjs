// Turns on phone (OTP) login with fixed test numbers, through the Supabase Management API.
// Needs SUPABASE_ACCESS_TOKEN (supabase.com → Account → Access tokens) in the root .env.
// Run from the repo root: node --env-file=.env supabase/scripts/configure-auth.mjs
//
// Test numbers log in with a fixed code and no SMS is sent. Real SMS needs an SMS provider
// (Twilio or MSG91 with DLT registration); set SMS_PROVIDER_* in .env and re-run to switch.

const token = process.env.SUPABASE_ACCESS_TOKEN;
const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!token) throw new Error('Add SUPABASE_ACCESS_TOKEN to .env');
const ref = new URL(url).hostname.split('.')[0];

// 10-digit Indian numbers for testers, all with the same code. Override with TEST_PHONES="9000000001,9000000002".
const phones = (process.env.TEST_PHONES ?? '9000000001,9000000002,9000000003,9000000004,9000000005,9000000006').split(',').map((p) => p.trim()).filter(Boolean);
const code = process.env.TEST_OTP ?? '123456';
const validUntil = new Date(Date.now() + 365 * 86_400_000).toISOString();

const body = {
  external_phone_enabled: true,
  sms_autoconfirm: false,
  sms_otp_exp: 300,
  sms_otp_length: 6,
  sms_test_otp: phones.map((p) => `91${p.replace(/\D/g, '').slice(-10)}=${code}`).join(','),
  sms_test_otp_valid_until: validUntil,
  // A provider must be named for phone login to be on. Test numbers never reach it.
  sms_provider: 'twilio',
  sms_twilio_account_sid: process.env.TWILIO_ACCOUNT_SID ?? 'AC00000000000000000000000000000000',
  sms_twilio_auth_token: process.env.TWILIO_AUTH_TOKEN ?? 'test-numbers-only',
  sms_twilio_message_service_sid: process.env.TWILIO_MESSAGE_SERVICE_SID ?? 'MG00000000000000000000000000000000',
};

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
if (!res.ok) throw new Error(`Supabase answered ${res.status}: ${await res.text()}`);
console.log(`Phone login is on. Test numbers (code ${code}): ${phones.map((p) => `+91 ${p}`).join(', ')}`);
