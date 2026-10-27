import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { CoinIcon } from '@/components/CoinBadge';
import { Card, EmptyState, Screen, SectionTitle } from '@/components/Layout';
import { toast } from '@/components/Toast';
import { PackCard } from '@/components/TopUpSheet';
import { appConfig } from '@/config/appConfig';
import { COIN_PACKS, type CoinPack } from '@/data/catalog';
import { useLanguage, useT } from '@/i18n';
import type { LedgerEntry } from '@/lib/billing';
import { formatWhen } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { useWallet } from '@/stores/wallet';
import { fonts, radius, spacing, useTheme } from '@/theme';



/** Collapse per-minute charges of the same call into one row for readability. */
function groupLedger(ledger: LedgerEntry[]) {
  const rows: { key: string; reason: LedgerEntry['reason']; delta: number; createdAt: number; note?: string; minutes: number }[] = [];
  for (const e of ledger) {
    const last = rows[rows.length - 1];
    if (e.reason === 'call_charge' && last && last.reason === 'call_charge' && last.key.startsWith(`${e.refId}:`)) {
      last.delta += e.delta;
      last.minutes += 1;
      last.createdAt = Math.min(last.createdAt, e.createdAt);
      continue;
    }
    rows.push({ key: `${e.refId}:${e.id}`, reason: e.reason, delta: e.delta, createdAt: e.createdAt, note: e.note, minutes: 1 });
  }
  return rows;
}

export default function Wallet() {
  const { colors } = useTheme();
  const t = useT();
  const lang = useLanguage();
  const balance = useWallet((s) => s.balance);
  const ledger = useWallet((s) => s.ledger);
  const purchase = useWallet((s) => s.purchase);
  const [busy, setBusy] = useState<string | null>(null);

  const buy = async (pack: CoinPack) => {
    setBusy(pack.id);
    try {
      await purchase(pack);
      haptic.success();
      toast.success(t('wallet.added', { n: pack.coins + pack.bonus }));
    } catch (e) {
      if ((e as Error).message === 'payments_coming_soon') toast.info(t('topUp.comingSoon'));
      else toast.error(t('errors.generic'));
    } finally {
      setBusy(null);
    }
  };

  const rows = groupLedger(ledger).slice(0, 30);

  return (
    <Screen edges={['top']}>
      <AppText variant="h1" style={{ paddingTop: spacing.lg, marginBottom: spacing.lg }} accessibilityRole="header">
        {t('wallet.title')}
      </AppText>

      <Animated.View entering={FadeInDown.duration(320)}>
        <LinearGradient colors={colors.gradientPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.balance}>
          <AppText variant="label" style={{ color: 'rgba(255,255,255,0.85)' }}>
            {t('wallet.balance')}
          </AppText>
          <View style={styles.inline}>
            <CoinIcon size={34} />
            <AppText style={{ fontFamily: fonts.heading, fontSize: 44, lineHeight: 52, color: '#fff' }} tabular accessibilityLabel={t('wallet.totalCoins', { n: balance })}>
              {balance.toLocaleString('en-IN')}
            </AppText>
          </View>
          <View style={styles.minutes}>
            {[
              { icon: 'call' as const, label: t('common.voice'), rate: appConfig.rates.audio },
              { icon: 'videocam' as const, label: t('common.video'), rate: appConfig.rates.video },
            ].map((r) => (
              <View key={r.label} style={styles.minutePill}>
                <Ionicons name={r.icon} size={14} color="#fff" />
                <AppText variant="caption" style={{ color: '#fff' }} tabular>
                  {t('wallet.approxMin', { n: Math.floor(balance / r.rate), type: r.label })}
                </AppText>
              </View>
            ))}
          </View>
        </LinearGradient>
      </Animated.View>

      <SectionTitle title={t('wallet.addCoins')} />
      <View style={{ gap: spacing.md }}>
        {COIN_PACKS.map((p, i) => (
          <Animated.View key={p.id} entering={FadeInDown.delay(60 + i * 40).duration(300)}>
            <PackCard pack={p} busy={busy === p.id} onPress={() => buy(p)} />
          </Animated.View>
        ))}
      </View>
      <AppText variant="caption" color="textMuted" style={{ marginTop: spacing.md }}>
        {t('wallet.note', { s: appConfig.refundUnderSeconds })}
      </AppText>

      <SectionTitle title={t('wallet.history')} />
      {rows.length === 0 ? (
        <EmptyState icon="receipt-outline" title={t('wallet.emptyTitle')} body={t('wallet.emptyBody')} />
      ) : (
        <Card padded={false}>
          {rows.map((r, i) => {
            const positive = r.delta > 0;
            return (
              <View key={r.key} style={[styles.tx, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider }]}>
                <View style={[styles.txIcon, { backgroundColor: positive ? 'rgba(22,163,74,0.12)' : colors.primarySoft }]}>
                  <Ionicons name={r.reason === 'purchase' ? 'add' : r.reason === 'call_refund' ? 'refresh' : r.reason === 'gift' ? 'gift' : r.reason === 'signup_trial' ? 'sparkles' : 'call'} size={18} color={positive ? colors.success : colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyMedium">
                    {r.reason === 'call_charge' ? t('wallet.callMinutes', { n: r.minutes }) : t(`wallet.reason.${r.reason}`)}
                  </AppText>
                  <AppText variant="caption" color="textMuted">
                    {formatWhen(r.createdAt, lang)}
                  </AppText>
                </View>
                <AppText variant="label" tabular style={{ color: positive ? colors.success : colors.text }}>
                  {positive ? '+' : ''}
                  {r.delta}
                </AppText>
              </View>
            );
          })}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  balance: { borderRadius: radius.xl, padding: spacing.xl, gap: spacing.sm },
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  minutes: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  minutePill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  tx: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, minHeight: 60 },
  txIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
