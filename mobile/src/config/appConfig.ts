/**
 * Mirrors the server-side `app_config` table (spec §8). These are the defaults until
 * `loadServerConfig` replaces them with the values admins set in the dashboard.
 */

export const APP_NAME = 'Baatein';

export const appConfig = {
  coinValuePaise: 75, // ₹0.75 per coin, base value used for host earnings
  rates: { audio: 6, video: 10 }, // coins per minute
  hostShareBpsByLevel: { 1: 3500, 2: 4000, 3: 4500, 4: 5000 } as Record<number, number>,
  giftShareBps: 6000,
  trialCoins: 6, // welcome coins for every new caller (ledger reason `signup_trial`)
  refundUnderSeconds: 10,
  lowBalanceWarnSeconds: [60, 20] as const,
  ringTimeoutSeconds: 30,
  holdDays: 7,
  minWithdrawalPaise: 50_000,
  minAge: 18,
  grievanceOfficer: { name: 'Grievance Officer', email: 'grievance@example.com' },
};

export type CallType = keyof typeof appConfig.rates;

/** Row shape of `app_config` in the database. */
export type ServerConfig = {
  coin_value_paise: number;
  audio_rate: number;
  video_rate: number;
  host_share_bps: number[];
  gift_share_bps: number;
  min_withdrawal_paise: number;
  hold_days: number;
  trial_coins: number;
  refund_under_seconds: number;
  ring_timeout_seconds: number;
};

export function applyServerConfig(c: ServerConfig) {
  appConfig.coinValuePaise = c.coin_value_paise;
  appConfig.rates = { audio: c.audio_rate, video: c.video_rate };
  appConfig.hostShareBpsByLevel = Object.fromEntries(c.host_share_bps.map((bps, i) => [i + 1, bps]));
  appConfig.giftShareBps = c.gift_share_bps;
  appConfig.minWithdrawalPaise = c.min_withdrawal_paise;
  appConfig.holdDays = c.hold_days;
  appConfig.trialCoins = c.trial_coins;
  appConfig.refundUnderSeconds = c.refund_under_seconds;
  appConfig.ringTimeoutSeconds = c.ring_timeout_seconds;
}

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
