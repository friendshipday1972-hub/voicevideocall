import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { formatRupees } from '@/config/appConfig';
import { COIN_PACKS, type CoinPack } from '@/data/mock';
import { useT } from '@/i18n';
import { haptic } from '@/lib/haptics';
import { useWallet } from '@/stores/wallet';
import { radius, spacing, useTheme } from '@/theme';

import { AppText } from './AppText';
import { CoinIcon } from './CoinBadge';
import { PressableScale } from './PressableScale';
import { Sheet } from './Sheet';
import { toast } from './Toast';

export function PackCard({ pack, onPress, busy }: { pack: CoinPack; onPress: () => void; busy?: boolean }) {
  const { colors } = useTheme();
  const t = useT();
  const name = t(`wallet.packs.${pack.name}`);
  const total = pack.coins + pack.bonus;
  return (
    <PressableScale
      onPress={onPress}
      disabled={busy}
      accessibilityLabel={`${t('wallet.pack', { name })}, ${t('wallet.totalCoins', { n: total })}, ${formatRupees(pack.pricePaise)}`}
      style={[styles.pack, { backgroundColor: colors.surface, borderColor: pack.tag ? colors.primary : colors.border }]}>
      {pack.tag && (
        <View style={[styles.tag, { backgroundColor: colors.primary }]}>
          <AppText variant="caption" style={{ color: colors.onPrimary, fontSize: 11 }}>
            {pack.tag === 'Popular' ? t('wallet.packs.popular') : t('wallet.packs.bestValue')}
          </AppText>
        </View>
      )}
      <View style={styles.packLeft}>
        <CoinIcon size={34} />
        <View>
          <AppText variant="h3" tabular>
            {t('wallet.totalCoins', { n: total.toLocaleString('en-IN') })}
          </AppText>
          <AppText variant="caption" color={pack.bonus ? 'success' : 'textMuted'}>
            {pack.bonus ? t('wallet.bonus', { coins: pack.coins, bonus: pack.bonus }) : name}
          </AppText>
        </View>
      </View>
      <View style={[styles.price, { backgroundColor: colors.primarySoft }]}>
        {busy ? (
          <Ionicons name="hourglass" size={16} color={colors.primary} />
        ) : (
          <AppText variant="label" color="primary" tabular>
            {formatRupees(pack.pricePaise)}
          </AppText>
        )}
      </View>
    </PressableScale>
  );
}

/** Coin purchase sheet. Used in the wallet and mid-call without leaving the call screen. */
export function TopUpSheet({ visible, onClose, reason }: { visible: boolean; onClose: () => void; reason?: string }) {
  const t = useT();
  const purchase = useWallet((s) => s.purchase);
  const [busyId, setBusyId] = useState<string | null>(null);

  const buy = async (pack: CoinPack) => {
    setBusyId(pack.id);
    try {
      await purchase(pack);
      haptic.success();
      toast.success(t('wallet.added', { n: pack.coins + pack.bonus }));
      onClose();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('topUp.title')}>
      {reason && (
        <AppText color="textSecondary" style={{ marginTop: -spacing.sm }}>
          {reason}
        </AppText>
      )}
      {COIN_PACKS.map((p) => (
        <PackCard key={p.id} pack={p} busy={busyId === p.id} onPress={() => buy(p)} />
      ))}
      <AppText variant="caption" color="textMuted" align="center">
        {t('common.demoPurchase')}
      </AppText>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  pack: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1.5 },
  packLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  price: { minWidth: 72, height: 38, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
  tag: { position: 'absolute', top: -10, right: spacing.lg, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill },
});
