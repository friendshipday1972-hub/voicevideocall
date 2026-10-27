import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card, EmptyState, Screen, SectionTitle } from '@/components/Layout';
import { Sheet } from '@/components/Sheet';
import { TextField } from '@/components/TextField';
import { toast } from '@/components/Toast';
import { appConfig, formatRupees } from '@/config/appConfig';
import { useLanguage, useT } from '@/i18n';
import { earningLabel } from '@/i18n/labels';
import { formatWhen } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { hostBalances, useHost } from '@/stores/host';
import { radius, spacing, useTheme } from '@/theme';

const statusColor = { requested: 'warning', approved: 'accent', paid: 'success', rejected: 'danger' } as const;

export default function Earnings() {
  const { colors } = useTheme();
  const t = useT();
  const lang = useLanguage();
  const earnings = useHost((s) => s.earnings);
  const payouts = useHost((s) => s.payouts);
  const requestPayout = useHost((s) => s.requestPayout);
  const target = useHost((s) => s.payoutTarget);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const b = hostBalances(earnings, now);
  const canWithdraw = b.available >= appConfig.minWithdrawalPaise;
  const payoutTo = target?.kind === 'upi' ? target.upiId : target ? `A/c ••${target.last4}` : '';
  const [sending, setSending] = useState(false);

  const submit = async () => {
    const paise = Math.round(Number(amount) * 100);
    if (!paise) return setError(t('earnings.enterAmount'));
    setSending(true);
    const r = await requestPayout(paise);
    setSending(false);
    if (!r.ok) {
      haptic.error();
      return setError(t(r.error === 'belowMin' ? 'earnings.belowMin' : r.error === 'aboveAvailable' ? 'earnings.aboveAvailable' : 'errors.network'));
    }
    haptic.success();
    toast.success(t('earnings.requested', { amount: formatRupees(paise) }));
    setOpen(false);
    setAmount('');
    setError(null);
  };

  return (
    <Screen edges={['top']}>
      <AppText variant="h1" style={{ paddingTop: spacing.lg, marginBottom: spacing.lg }} accessibilityRole="header">
        {t('earnings.title')}
      </AppText>

      <Animated.View entering={FadeInDown.duration(300)}>
        <Card style={{ gap: spacing.lg }}>
          <View>
            <AppText variant="caption" color="textSecondary">
              {t('earnings.withdrawableNow')}
            </AppText>
            <AppText variant="display" tabular>
              {formatRupees(b.available)}
            </AppText>
          </View>
          <View style={styles.split}>
            <View style={[styles.pill, { backgroundColor: colors.surfaceAlt }]}>
              <Ionicons name="lock-closed" size={14} color={colors.warning} />
              <AppText variant="caption" color="textSecondary" tabular>
                {t('earnings.pending', { amount: formatRupees(b.pending), days: appConfig.holdDays })}
              </AppText>
            </View>
            <View style={[styles.pill, { backgroundColor: colors.surfaceAlt }]}>
              <Ionicons name="trophy" size={14} color={colors.coin} />
              <AppText variant="caption" color="textSecondary" tabular>
                {t('earnings.lifetime', { amount: formatRupees(b.lifetime) })}
              </AppText>
            </View>
          </View>
          <Button
            title={canWithdraw ? t('earnings.withdraw') : t('earnings.withdrawFrom', { min: formatRupees(appConfig.minWithdrawalPaise) })}
            icon="arrow-up-circle"
            disabled={!canWithdraw}
            onPress={() => {
              setAmount(String(Math.floor(b.available / 100)));
              setError(null);
              setOpen(true);
            }}
          />
        </Card>
      </Animated.View>

      {payouts.length > 0 && (
        <>
          <SectionTitle title={t('earnings.withdrawals')} />
          <Card padded={false}>
            {payouts.map((p, i) => (
              <View key={p.id} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider }]}>
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyMedium" tabular>
                    {formatRupees(p.amountPaise)}
                  </AppText>
                  <AppText variant="caption" color="textMuted">
                    {formatWhen(p.createdAt, lang)}
                  </AppText>
                </View>
                <View style={[styles.status, { borderColor: colors[statusColor[p.status]] }]}>
                  <AppText variant="caption" style={{ color: colors[statusColor[p.status]] }}>
                    {p.status === 'requested' ? t('earnings.awaiting') : t(`earnings.${p.status}`)}
                  </AppText>
                </View>
              </View>
            ))}
          </Card>
        </>
      )}

      <SectionTitle title={t('earnings.activity')} />
      {earnings.length === 0 ? (
        <EmptyState icon="cash-outline" title={t('earnings.emptyTitle')} body={t('earnings.emptyBody')} />
      ) : (
        <Card padded={false}>
          {earnings.map((e, i) => {
            const locked = e.reason !== 'payout' && e.availableAt > now;
            return (
              <View key={e.id} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider }]}>
                <View style={[styles.icon, { backgroundColor: e.paise < 0 ? colors.primarySoft : 'rgba(22,163,74,0.12)' }]}>
                  <Ionicons name={e.reason === 'payout' ? 'arrow-up' : e.reason === 'bonus' ? 'gift' : 'call'} size={16} color={e.paise < 0 ? colors.primary : colors.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyMedium">{earningLabel(t, e.label)}</AppText>
                  <AppText variant="caption" color="textMuted">
                    {locked ? t('earnings.unlocks', { when: formatWhen(e.availableAt, lang) }) : formatWhen(e.createdAt, lang)}
                  </AppText>
                </View>
                <AppText variant="label" tabular style={{ color: e.paise < 0 ? colors.text : colors.success }}>
                  {e.paise > 0 ? '+' : '−'}
                  {formatRupees(Math.abs(e.paise))}
                </AppText>
              </View>
            );
          })}
        </Card>
      )}

      <Sheet visible={open} onClose={() => setOpen(false)} title={t('earnings.withdraw')} footer={<Button title={t('earnings.request')} onPress={submit} loading={sending} />}>
        <TextField
          label={t('earnings.amount')}
          value={amount}
          onChangeText={(t) => {
            setAmount(t.replace(/[^\d]/g, ''));
            setError(null);
          }}
          keyboardType="number-pad"
          error={error}
          helper={t('earnings.amountHelp', { available: formatRupees(b.available), min: formatRupees(appConfig.minWithdrawalPaise) })}
        />
        <Card style={{ gap: spacing.xs }}>
          <AppText variant="label">{t('earnings.paidTo', { to: payoutTo })}</AppText>
          <AppText variant="caption" color="textSecondary">
            {t('earnings.paidNote')}
          </AppText>
        </Card>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  split: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, minHeight: 60 },
  icon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  status: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
});
