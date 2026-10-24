'use client';

import { AlertTriangle, Lightbulb, Sparkles, TrendingUp, Trophy } from 'lucide-react';

import { TIER_LABEL, type QualityResult, type QualityTier } from '@/lib/quality';

import { Pill } from './ui';

export function TierPill({ tier }: { tier: QualityTier }) {
  if (tier === 'none') return null;
  const Icon = tier === 'spotlight' ? Sparkles : tier === 'top_rated' ? Trophy : TrendingUp;
  return (
    <Pill tone={tier === 'spotlight' ? 'gold' : tier === 'top_rated' ? 'info' : 'good'} icon={Icon}>
      {TIER_LABEL[tier]}
    </Pill>
  );
}

export function RiskPill() {
  return (
    <Pill tone="bad" icon={AlertTriangle}>
      At risk
    </Pill>
  );
}

/** Score 0–100 as a number + thin bar (data color; risk is shown by the pill, not by color alone). */
export function ScoreBar({ score }: { score: number }) {
  return (
    <span className="inline-flex items-center gap-2" aria-label={`Spotlight score ${score} of 100`}>
      <span className="tabular w-7 text-right font-display font-semibold">{score}</span>
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <span className="block h-full rounded-full bg-data" style={{ width: `${score}%` }} />
      </span>
    </span>
  );
}

export function FactorBreakdown({ quality }: { quality: QualityResult }) {
  return (
    <div className="flex flex-col gap-3">
      {quality.factors.map((f) => (
        <div key={f.key}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-fg-2">
              {f.label} <span className="text-fg-3">· weight {f.weight}</span>
            </span>
            <span className="tabular font-medium">{Math.round(f.value * f.weight)} pts</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-data" style={{ width: `${Math.max(2, f.value * 100)}%` }} />
          </div>
        </div>
      ))}
      {quality.tips.length > 0 && (
        <div className="mt-1 flex flex-col gap-1.5 rounded-lg bg-surface-2 p-3">
          <p className="text-xs font-medium">Coaching tips shown to the host</p>
          {quality.tips.map((t) => (
            <p key={t} className="flex gap-1.5 text-xs text-fg-2">
              <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-gold" aria-hidden />
              {t}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export function StarsText({ value }: { value: number }) {
  return (
    <span className="text-gold" aria-label={`${value} out of 5 stars`}>
      {'★'.repeat(Math.round(value))}
      <span className="text-fg-3 opacity-40">{'★'.repeat(5 - Math.round(value))}</span>
    </span>
  );
}
