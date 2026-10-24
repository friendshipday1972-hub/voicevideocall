'use client';

import { RotateCcw, Save } from 'lucide-react';
import { useState } from 'react';

import { Ready } from '@/components/shell';
import { Button, Card, ConfirmAction, Field, PageHeader, Warning, inputClass, toast } from '@/components/ui';
import { formatRupees } from '@/lib/data/derive';
import { useAdmin } from '@/lib/data/store';
import type { AppConfig } from '@/lib/data/types';

type Form = Record<string, string>;

const toForm = (c: AppConfig): Form => ({
  coinValue: (c.coinValuePaise / 100).toFixed(2),
  audioRate: String(c.audioRate),
  videoRate: String(c.videoRate),
  l1: String(c.hostShareBps[0] / 100),
  l2: String(c.hostShareBps[1] / 100),
  l3: String(c.hostShareBps[2] / 100),
  l4: String(c.hostShareBps[3] / 100),
  gift: String(c.giftShareBps / 100),
  minWithdrawal: String(c.minWithdrawalPaise / 100),
  holdDays: String(c.holdDays),
  trialCoins: String(c.trialCoins),
  refundUnder: String(c.refundUnderSeconds),
  spotlightMin: String(c.spotlightMinScore),
});

/** Validates the form; returns errors per field and the parsed config. */
function parse(f: Form): { errors: Record<string, string>; config?: AppConfig } {
  const errors: Record<string, string> = {};
  const num = (k: string, min: number, max: number, int = true) => {
    const v = Number(f[k]);
    if (!Number.isFinite(v) || (int && !Number.isInteger(v)) || v < min || v > max) errors[k] = `Enter ${int ? 'a whole number' : 'a number'} from ${min} to ${max}.`;
    return v;
  };
  const coin = num('coinValue', 0.1, 5, false);
  const audio = num('audioRate', 1, 100);
  const video = num('videoRate', 1, 200);
  const shares = (['l1', 'l2', 'l3', 'l4'] as const).map((k) => num(k, 10, 70));
  const gift = num('gift', 10, 90);
  const minW = num('minWithdrawal', 100, 10_000);
  const hold = num('holdDays', 0, 30);
  const trial = num('trialCoins', 0, 100);
  const refund = num('refundUnder', 0, 60);
  const spot = num('spotlightMin', 0, 100);
  if (video < audio && !errors.videoRate) errors.videoRate = 'Video should cost at least as much as voice.';
  for (let i = 1; i < 4; i++) if (shares[i] < shares[i - 1] && !errors[`l${i + 1}`]) errors[`l${i + 1}`] = 'Higher levels should earn at least as much.';
  if (Object.keys(errors).length) return { errors };
  return {
    errors,
    config: {
      coinValuePaise: Math.round(coin * 100),
      audioRate: audio,
      videoRate: video,
      hostShareBps: shares.map((s) => Math.round(s * 100)) as AppConfig['hostShareBps'],
      giftShareBps: Math.round(gift * 100),
      minWithdrawalPaise: Math.round(minW * 100),
      holdDays: hold,
      trialCoins: trial,
      refundUnderSeconds: refund,
      spotlightMinScore: spot,
    },
  };
}

function SettingsPageView() {
  const config = useAdmin((s) => s.config);
  const updateConfig = useAdmin((s) => s.updateConfig);
  const resetDemo = useAdmin((s) => s.resetDemo);
  const [form, setForm] = useState<Form>(() => toForm(config));
  const [submitted, setSubmitted] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const { errors, config: parsed } = parse(form);
  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(config));

  const input = (k: string, label: string, hint?: string, suffix?: string) => (
    <Field key={k} label={label} hint={hint} error={submitted ? errors[k] : null}>
      {(id) => (
        <div className="relative">
          <input id={id} inputMode="decimal" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} aria-invalid={submitted && !!errors[k]} className={`${inputClass} ${suffix ? 'pr-14' : ''}`} />
          {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-fg-3">{suffix}</span>}
        </div>
      )}
    </Field>
  );

  const save = () => {
    setSubmitted(true);
    if (!parsed) {
      toast.bad('Fix the highlighted fields');
      return;
    }
    const patch = Object.fromEntries(Object.entries(parsed).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(config[k as keyof AppConfig]))) as Partial<AppConfig>;
    updateConfig(patch);
    setSubmitted(false);
    toast.good('Settings saved. The app picks them up on next launch.');
  };

  const preview = parsed ?? config;
  const perMin = (rate: number, bps: number) => formatRupees(Math.floor((rate * preview.coinValuePaise * bps) / 10_000));

  return (
    <>
      <PageHeader
        title="App settings"
        description="Rates, host shares and limits (the app_config table). Changes apply without an app update."
        actions={
          <Button variant="primary" icon={Save} disabled={!dirty} onClick={save}>
            Save changes
          </Button>
        }
      />
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2">
          <Card title="Coins & call rates">
            <div className="grid gap-4 sm:grid-cols-3">
              {input('coinValue', 'Coin value (host earnings base)', 'Base ₹ per coin', '₹')}
              {input('audioRate', 'Voice call rate', 'Coins per minute', 'coins')}
              {input('videoRate', 'Video call rate', 'Coins per minute', 'coins')}
            </div>
          </Card>
          <Card title="Host share by level" description="Percentage of the gross coin value of each minute">
            <div className="grid gap-4 sm:grid-cols-4">
              {input('l1', 'Level 1', undefined, '%')}
              {input('l2', 'Level 2', undefined, '%')}
              {input('l3', 'Level 3', undefined, '%')}
              {input('l4', 'Level 4', undefined, '%')}
            </div>
            <div className="mt-4">{input('gift', 'Gift share', 'Host share of gift value', '%')}</div>
          </Card>
          <Card title="Wallet, payouts & safety">
            <div className="grid gap-4 sm:grid-cols-3">
              {input('minWithdrawal', 'Minimum withdrawal', undefined, '₹')}
              {input('holdDays', 'Earnings hold', 'Refund / fraud window', 'days')}
              {input('trialCoins', 'Welcome coins', 'Free coins for new callers', 'coins')}
              {input('refundUnder', 'Auto-refund calls under', undefined, 'sec')}
              {input('spotlightMin', 'Spotlight minimum score', 'Below this, hosts aren’t featured', 'pts')}
            </div>
          </Card>
        </div>
        <div className="flex flex-col gap-4">
          <Card title="What a host earns per minute" description="Preview with the values above">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-fg-3">
                  <th className="pb-2 text-left font-medium">Level</th>
                  <th className="pb-2 text-right font-medium">Voice</th>
                  <th className="pb-2 text-right font-medium">Video</th>
                </tr>
              </thead>
              <tbody>
                {preview.hostShareBps.map((bps, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="py-1.5">
                      L{i + 1} · {bps / 100}%
                    </td>
                    <td className="tabular py-1.5 text-right">{perMin(preview.audioRate, bps)}</td>
                    <td className="tabular py-1.5 text-right">{perMin(preview.videoRate, bps)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-fg-3">
              Callers pay {preview.audioRate} coins/min for voice and {preview.videoRate} for video.
            </p>
          </Card>
          <Warning>Big packs sell coins below the coin value (₹0.55 for Max). Check that Level 4 shares stay profitable for Max-pack buyers before raising them.</Warning>
          <Card title="Demo data">
            <p className="mb-3 text-sm text-fg-2">Start over with a fresh 30-day dataset. Your settings and all actions taken in this browser are cleared.</p>
            <Button variant="danger" icon={RotateCcw} onClick={() => setResetOpen(true)}>
              Reset demo data
            </Button>
          </Card>
        </div>
      </div>
      <ConfirmAction
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset all demo data?"
        body="Everything goes back to a fresh demo dataset."
        confirmLabel="Reset"
        danger
        reasonRequired={false}
        onConfirm={() => {
          resetDemo();
          setForm(toForm(useAdmin.getState().config));
          toast.good('Demo data reset');
        }}
      />
    </>
  );
}

export default function SettingsPage() {
  return (
    <Ready>
      <SettingsPageView />
    </Ready>
  );
}
