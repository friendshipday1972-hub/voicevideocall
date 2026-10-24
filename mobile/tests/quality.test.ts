import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bayesianRating, computeQuality, spotlightOrder, type QualityInput } from '../src/lib/quality.ts';

const base: QualityInput = { ratingAvg: 4.8, ratingCount: 900, repeatCallerRate: 0.42, avgCallMinutes: 13, answerRate: 0.97, reportRate: 0.001, activeDays: 24, calls30d: 400, strikes: 0 };

test('an excellent established host reaches Spotlight', () => {
  const q = computeQuality(base);
  assert.ok(q.score >= 85, `score ${q.score}`);
  assert.equal(q.tier, 'spotlight');
  assert.equal(q.atRisk, false);
});

test('3 perfect reviews do not beat 300 very good ones (Bayesian rating)', () => {
  assert.ok(bayesianRating(5, 3) < bayesianRating(4.8, 300));
});

test('weights sum to 100 and score stays within 0..100', () => {
  const q = computeQuality(base);
  assert.equal(q.factors.reduce((a, f) => a + f.weight, 0), 100);
  const worst = computeQuality({ ratingAvg: 1, ratingCount: 500, repeatCallerRate: 0, avgCallMinutes: 0, answerRate: 0, reportRate: 1, activeDays: 0, calls30d: 500, strikes: 0 });
  assert.ok(worst.score >= 0 && worst.score <= 10);
  assert.equal(worst.atRisk, true);
});

test('a strong new host is a Rising star, not Spotlight', () => {
  const q = computeQuality({ ...base, ratingCount: 20, calls30d: 25 });
  assert.equal(q.tier, 'rising_star');
});

test('strikes remove the tier and cut the score', () => {
  const clean = computeQuality(base);
  const struck = computeQuality({ ...base, strikes: 1 });
  assert.equal(struck.tier, 'none');
  assert.ok(struck.score < clean.score);
});

test('reports push a host to at-risk', () => {
  assert.equal(computeQuality({ ...base, reportRate: 0.02 }).atRisk, true);
});

test('tips target the weakest factors', () => {
  const q = computeQuality({ ...base, answerRate: 0.55 });
  assert.equal(q.tips.length >= 1, true);
  assert.match(q.tips[0], /Answer more/);
});

test('spotlight order gives every 4th slot to a rising star and hides at-risk hosts', () => {
  const mk = (id: string, over: Partial<QualityInput>, featured = false) => ({ id, featured, quality: computeQuality({ ...base, ...over }) });
  const hosts = [
    mk('a', {}),
    mk('b', { ratingAvg: 4.7 }),
    mk('c', { ratingAvg: 4.6 }),
    mk('d', { ratingAvg: 4.5 }),
    mk('new', { ratingCount: 20, calls30d: 20 }),
    mk('bad', { reportRate: 0.05 }),
  ];
  const order = spotlightOrder(hosts).map((h) => h.id);
  assert.equal(order[3], 'new');
  assert.equal(order.includes('bad'), false);
});

test('a brand-new host with no calls is not at risk', () => {
  const q = computeQuality({ ratingAvg: 0, ratingCount: 0, repeatCallerRate: 0, avgCallMinutes: 0, answerRate: 1, reportRate: 0, activeDays: 0, calls30d: 0, strikes: 0 });
  assert.equal(q.atRisk, false);
  assert.equal(q.tier, 'none');
});
