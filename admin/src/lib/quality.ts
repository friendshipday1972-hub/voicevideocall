// Copy of mobile/src/lib/quality.ts. Keep the two identical (both are unit tested).
// With the real backend this logic moves to one Postgres function used by both.
/**
 * Spotlight Score: how good an impression a host makes, 0–100.
 *
 * Built only from behaviour that reflects good conversations (never looks or explicit content):
 * rating (Bayesian, so 3 reviews can't beat 300), callers coming back, call length, answering
 * calls, consistency and safety. Pure functions with no imports so they are unit tested with
 * `node --test` and copied 1:1 into the admin panel (admin/src/lib/quality.ts). With the real
 * backend this runs nightly in Postgres next to the level recompute.
 */

export type QualityInput = {
  ratingAvg: number; // 0–5
  ratingCount: number;
  repeatCallerRate: number; // 0–1, share of callers who called again within 30 days
  avgCallMinutes: number;
  answerRate: number; // 0–1, answered / rung
  reportRate: number; // 0–1, upheld reports / calls
  activeDays: number; // days online in the last 30
  calls30d: number;
  strikes: number;
};

export type QualityTier = 'spotlight' | 'top_rated' | 'rising_star' | 'none';

export type QualityFactor = { key: 'rating' | 'repeat' | 'engagement' | 'reliability' | 'consistency' | 'safety'; label: string; weight: number; value: number };

export type QualityResult = {
  score: number; // 0–100, rounded
  tier: QualityTier;
  factors: QualityFactor[]; // value 0–1 each; weight sums to 100
  atRisk: boolean;
  tips: string[];
  /** The factors the tips are about, so apps can show localized tips. */
  tipKeys: QualityFactor['key'][];
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** Prior for the Bayesian rating: a new host starts as if she had PRIOR_COUNT ratings of PRIOR_MEAN. */
const PRIOR_MEAN = 4.0;
const PRIOR_COUNT = 20;

export function bayesianRating(avg: number, count: number): number {
  return (PRIOR_MEAN * PRIOR_COUNT + avg * count) / (PRIOR_COUNT + count);
}

const TIPS: Record<QualityFactor['key'], string> = {
  rating: 'Callers rate warm, attentive conversations highest. Use their name and ask about their day.',
  repeat: 'Regulars matter most. Remember details from past calls; callers love being remembered.',
  engagement: 'Longer calls come from open questions. Try “what was the best part of your week?”',
  reliability: 'Answer more of the calls you receive while online. Go offline when you can’t talk.',
  consistency: 'Go online at the same times each day so regular callers can find you.',
  safety: 'Keep every call within the community guidelines. Reports lower your score quickly.',
};

export function computeQuality(q: QualityInput): QualityResult {
  const factors: QualityFactor[] = [
    { key: 'rating', label: 'Ratings', weight: 35, value: clamp01((bayesianRating(q.ratingAvg, q.ratingCount) - 3) / 2) },
    { key: 'repeat', label: 'Callers return', weight: 20, value: clamp01(q.repeatCallerRate / 0.4) },
    { key: 'engagement', label: 'Call length', weight: 15, value: clamp01(q.avgCallMinutes / 12) },
    { key: 'reliability', label: 'Answers calls', weight: 15, value: clamp01((q.answerRate - 0.5) / 0.5) },
    { key: 'consistency', label: 'Regularly online', weight: 5, value: clamp01(q.activeDays / 20) },
    { key: 'safety', label: 'Safe & respectful', weight: 10, value: 1 - clamp01(q.reportRate / 0.02) },
  ];
  const raw = factors.reduce((sum, f) => sum + f.weight * f.value, 0);
  const score = Math.round(raw * Math.max(0, 1 - 0.15 * q.strikes));

  const established = q.calls30d >= 50;
  const tier: QualityTier =
    q.strikes > 0
      ? 'none'
      : established && score >= 85
        ? 'spotlight'
        : established && score >= 72
          ? 'top_rated'
          : !established && score >= 68
            ? 'rising_star'
            : 'none';

  // A low score only means risk once there is enough data (a brand-new host is not at risk).
  const atRisk = (score < 45 && q.calls30d >= 10) || q.reportRate > 0.015 || q.strikes >= 2;
  const tipKeys = [...factors]
    .sort((a, b) => a.value - b.value)
    .filter((f) => f.value < 0.8)
    .slice(0, 2)
    .map((f) => f.key);

  return { score, tier, factors, atRisk, tips: tipKeys.map((k) => TIPS[k]), tipKeys };
}

export const TIER_LABEL: Record<QualityTier, string> = {
  spotlight: 'Spotlight',
  top_rated: 'Top rated',
  rising_star: 'Rising star',
  none: '',
};

/**
 * Order hosts for the "Spotlight" row: best scores first, but every 4th slot goes to a
 * rising star so new hosts with a great start get noticed (fair exposure, no rich-get-richer).
 * Admin-featured hosts get a fixed boost. `minScore` is `spotlightMinScore` in app config.
 */
export function spotlightOrder<T extends { id: string; quality: QualityResult; featured?: boolean }>(hosts: T[], limit = 8, minScore = 60): T[] {
  const rank = (h: T) => h.quality.score + (h.featured ? 8 : 0);
  const eligible = hosts.filter((h) => !h.quality.atRisk && h.quality.score >= minScore);
  const rising = eligible.filter((h) => h.quality.tier === 'rising_star').sort((a, b) => rank(b) - rank(a));
  const rest = eligible.filter((h) => h.quality.tier !== 'rising_star').sort((a, b) => rank(b) - rank(a));
  const out: T[] = [];
  while (out.length < limit && (rest.length || rising.length)) {
    const takeRising = (out.length + 1) % 4 === 0 && rising.length > 0;
    const next = takeRising ? rising.shift() : (rest.shift() ?? rising.shift());
    if (next) out.push(next);
  }
  return out;
}
