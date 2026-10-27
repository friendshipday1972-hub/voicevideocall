'use client';

import { Save } from 'lucide-react';
import { useState } from 'react';

import { Ready } from '@/components/shell';
import { Button, Card, Field, PageHeader, Warning, inputClass, toast } from '@/components/ui';
import { useT, type Translate } from '@/i18n';
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
function parse(f: Form, t: Translate): { errors: Record<string, string>; config?: AppConfig } {
  const errors: Record<string, string> = {};
  const num = (k: string, min: number, max: number, int = true) => {
    const v = Number(f[k]);
    if (!Number.isFinite(v) || (int && !Number.isInteger(v)) || v < min || v > max) errors[k] = t(int ? 'settings.errWhole' : 'settings.errNumber', { min, max });
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
  if (video < audio && !errors.videoRate) errors.videoRate = t('settings.errVideo');
  for (let i = 1; i < 4; i++) if (shares[i] < shares[i - 1] && !errors[`l${i + 1}`]) errors[`l${i + 1}`] = t('settings.errLevels');
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
  const t = useT();
  const [form, setForm] = useState<Form>(() => toForm(config));
  const [submitted, setSubmitted] = useState(false);
  const { errors, config: parsed } = parse(form, t);
  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(config));

  const coins = t('common.coins');
  const input = (k: string, label: string, hint?: string, suffix?: string) => (
    <Field key={k} label={label} hint={hint} error={submitted ? errors[k] : null}>
      {(id) => (
        <div className="relative">
          <input id={id} inputMode="decimal" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} aria-invalid={submitted && !!errors[k]} className={`${inputClass} ${suffix ? 'pr-20' : ''}`} />
          {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-fg-3">{suffix}</span>}
        </div>
      )}
    </Field>
  );

  const save = () => {
    setSubmitted(true);
    if (!parsed) {
      toast.bad(t('settings.fixFields'));
      return;
    }
    const patch = Object.fromEntries(Object.entries(parsed).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(config[k as keyof AppConfig]))) as Partial<AppConfig>;
    updateConfig(patch).then(() => {
      setSubmitted(false);
      toast.good(t('settings.saved'));
    }, () => {});
  };

  const preview = parsed ?? config;
  const perMin = (rate: number, bps: number) => formatRupees(Math.floor((rate * preview.coinValuePaise * bps) / 10_000));

  return (
    <>
      <PageHeader
        title={t('settings.title')}
        description={t('settings.description')}
        actions={
          <Button variant="primary" icon={Save} disabled={!dirty} onClick={save}>
            {t('settings.saveChanges')}
          </Button>
        }
      />
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2">
          <Card title={t('settings.coinsRates')}>
            <div className="grid gap-4 sm:grid-cols-3">
              {input('coinValue', t('settings.coinValue'), t('settings.coinValueHint'), '₹')}
              {input('audioRate', t('settings.voiceRate'), t('settings.perMinute'), coins)}
              {input('videoRate', t('settings.videoRate'), t('settings.perMinute'), coins)}
            </div>
          </Card>
          <Card title={t('settings.shareByLevel')} description={t('settings.shareDesc')}>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {input('l1', t('common.levelN', { n: 1 }), undefined, '%')}
              {input('l2', t('common.levelN', { n: 2 }), undefined, '%')}
              {input('l3', t('common.levelN', { n: 3 }), undefined, '%')}
              {input('l4', t('common.levelN', { n: 4 }), undefined, '%')}
            </div>
            <div className="mt-4">{input('gift', t('settings.giftShare'), t('settings.giftShareHint'), '%')}</div>
          </Card>
          <Card title={t('settings.walletSafety')}>
            <div className="grid gap-4 sm:grid-cols-3">
              {input('minWithdrawal', t('settings.minWithdrawal'), undefined, '₹')}
              {input('holdDays', t('settings.hold'), t('settings.holdHint'), t('settings.days'))}
              {input('trialCoins', t('settings.welcome'), t('settings.welcomeHint'), coins)}
              {input('refundUnder', t('settings.refundUnder'), undefined, t('settings.sec'))}
              {input('spotlightMin', t('settings.spotlightMin'), t('settings.spotlightMinHint'), t('settings.pts'))}
            </div>
          </Card>
        </div>
        <div className="flex flex-col gap-4">
          <Card title={t('settings.earnPerMin')} description={t('settings.earnPerMinDesc')}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-fg-3">
                  <th className="pb-2 text-left font-medium">{t('common.level')}</th>
                  <th className="pb-2 text-right font-medium">{t('common.voice')}</th>
                  <th className="pb-2 text-right font-medium">{t('common.video')}</th>
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
            <p className="mt-3 text-xs text-fg-3">{t('settings.callersPay', { voice: preview.audioRate, video: preview.videoRate })}</p>
          </Card>
          <Warning>{t('settings.packWarning')}</Warning>
        </div>
      </div>
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
