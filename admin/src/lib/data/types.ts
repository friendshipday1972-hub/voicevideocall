import type { QualityInput } from '@/lib/quality';

export type LanguageCode = 'hi' | 'te' | 'ta' | 'kn' | 'ml' | 'bn' | 'mr' | 'en';
export type UserStatus = 'active' | 'suspended' | 'banned' | 'deleted';
export type HostStatus = 'active' | 'suspended' | 'banned';
export type CallType = 'audio' | 'video';
export type CallEndReason = 'caller_hangup' | 'host_hangup' | 'low_balance' | 'network' | 'moderation';
export type ReportCategory = 'sexual_content' | 'harassment' | 'abuse' | 'fraud' | 'underage' | 'sharing_contacts' | 'spam' | 'other';
export type ReportStatus = 'open' | 'reviewing' | 'actioned' | 'dismissed';
export type ReportDecision = 'dismiss' | 'warn' | 'strike' | 'suspend' | 'ban';

/** A caller (men and other genders). */
export type User = {
  id: string;
  name: string;
  phone: string;
  age: number;
  city: string;
  languages: LanguageCode[];
  joinedAt: number;
  lastActiveAt: number;
  status: UserStatus;
  coins: number;
  spentPaise: number;
  device: string;
  flags: string[];
};

/** A verified woman host. */
export type Host = {
  id: string;
  name: string;
  age: number;
  city: string;
  phone: string;
  languages: LanguageCode[];
  bio: string;
  level: 1 | 2 | 3 | 4;
  levelOverride: 1 | 2 | 3 | 4 | null;
  status: HostStatus;
  presence: 'online' | 'busy' | 'offline';
  featured: boolean;
  joinedAt: number;
  /** Trailing-30-day behaviour (strikes are kept separately on the host). */
  stats: Omit<QualityInput, 'strikes'>;
  strikes: number;
  kyc: { pan: string; aadhaarLast4: string; faceMatch: number };
  payout: string;
  colors: [string, string];
};

export type Application = {
  id: string;
  name: string;
  age: number;
  city: string;
  phone: string;
  languages: LanguageCode[];
  bio: string;
  pan: string;
  aadhaarLast4: string;
  /** From Aadhaar via DigiLocker. */
  aadhaarGender: 'female' | 'male';
  aadhaarAge: number;
  /** Selfie vs ID photo similarity, 0–100. */
  faceMatch: number;
  livenessPassed: boolean;
  duplicateOf: string | null;
  payout: string;
  submittedAt: number;
  status: 'pending' | 'approved' | 'rejected';
  decisionNote?: string;
  decidedAt?: number;
};

export type Call = {
  id: string;
  userId: string;
  hostId: string;
  type: CallType;
  language: LanguageCode;
  startedAt: number;
  durationSec: number;
  coins: number;
  refundedCoins: number;
  giftCoins: number;
  hostEarnedPaise: number;
  endReason: CallEndReason;
  rating?: number;
  tags?: string[];
  comment?: string;
  reviewHidden?: boolean;
};

export type Purchase = {
  id: string;
  userId: string;
  pack: string;
  pricePaise: number;
  coins: number;
  platform: 'android' | 'ios';
  createdAt: number;
  status: 'verified' | 'refunded';
};

export type Payout = {
  id: string;
  hostId: string;
  amountPaise: number;
  tdsPaise: number;
  method: string;
  status: 'requested' | 'approved' | 'paid' | 'rejected';
  requestedAt: number;
  decidedAt?: number;
  note?: string;
};

export type Report = {
  id: string;
  reporterId: string;
  reporterRole: 'user' | 'host';
  targetId: string;
  targetRole: 'user' | 'host';
  callId?: string;
  category: ReportCategory;
  details: string;
  severity: 1 | 2 | 3 | 4;
  status: ReportStatus;
  createdAt: number;
  decision?: ReportDecision;
  /** The admin's note on the decision (free text). */
  resolution?: string;
  resolvedAt?: number;
};

export type AuditEntry = {
  id: string;
  at: number;
  actor: string;
  /** An `audit.*` translation key (older entries may hold plain text, shown as is). */
  action: string;
  vars?: Record<string, string | number>;
  targetType: 'user' | 'host' | 'application' | 'report' | 'payout' | 'purchase' | 'call' | 'review' | 'config' | 'system';
  targetId: string;
  /** Names and the admin's reason, kept as typed. */
  detail: string;
};

export type AppConfig = {
  coinValuePaise: number;
  audioRate: number;
  videoRate: number;
  hostShareBps: [number, number, number, number];
  giftShareBps: number;
  minWithdrawalPaise: number;
  holdDays: number;
  trialCoins: number;
  refundUnderSeconds: number;
  spotlightMinScore: number;
};

export type Dataset = {
  generatedAt: number;
  users: User[];
  hosts: Host[];
  applications: Application[];
  calls: Call[];
  purchases: Purchase[];
  payouts: Payout[];
  reports: Report[];
  audit: AuditEntry[];
  config: AppConfig;
};

export const CATEGORY_SEVERITY: Record<ReportCategory, 1 | 2 | 3 | 4> = {
  underage: 4,
  sexual_content: 3,
  fraud: 3,
  harassment: 2,
  sharing_contacts: 2,
  abuse: 1,
  spam: 1,
  other: 1,
};
