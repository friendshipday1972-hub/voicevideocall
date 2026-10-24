/**
 * Mirrors the server-side `app_config` table (spec §8). In the prototype these are
 * local defaults; once the backend is connected they are fetched, never hard-coded.
 */

export const APP_NAME = 'Baatein';

export const appConfig = {
  coinValuePaise: 75, // ₹0.75 per coin, base value used for host earnings
  rates: { audio: 6, video: 10 }, // coins per minute
  hostShareBpsByLevel: { 1: 3500, 2: 4000, 3: 4500, 4: 5000 } as Record<number, number>,
  giftShareBps: 6000,
  trialCoins: 6, // one free voice minute for every new caller (ledger reason `signup_trial`)
  refundUnderSeconds: 10,
  lowBalanceWarnSeconds: [60, 20] as const,
  ringTimeoutSeconds: 30,
  holdDays: 7,
  minWithdrawalPaise: 50_000,
  minAge: 18,
  grievanceOfficer: { name: 'Grievance Officer', email: 'grievance@example.com' },
} as const;

export type CallType = keyof typeof appConfig.rates;

export const levelRequirements = [
  { level: 1, title: 'New', minutes: 0, rating: 0, share: 35 },
  { level: 2, title: 'Rising', minutes: 300, rating: 4.0, share: 40 },
  { level: 3, title: 'Star', minutes: 1500, rating: 4.3, share: 45 },
  { level: 4, title: 'Top', minutes: 4000, rating: 4.5, share: 50 },
] as const;

export function formatRupees(paise: number): string {
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString('en-IN', { minimumFractionDigits: rupees % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}
