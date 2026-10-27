import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { appConfig } from '@/config/appConfig';
import { GIFTS, type Gift } from '@/data/catalog';
import { useT } from '@/i18n';
import { motion, radius, spacing, useTheme } from '@/theme';

import { AppText } from './AppText';
import { CoinIcon } from './CoinBadge';
import { PressableScale } from './PressableScale';
import { Sheet } from './Sheet';

export function GiftSheet({ visible, onClose, onSend, balance, hostName }: { visible: boolean; onClose: () => void; onSend: (g: Gift) => void; balance: number; hostName: string }) {
  const { colors } = useTheme();
  const t = useT();
  return (
    <Sheet visible={visible} onClose={onClose} title={t('gifts.title')}>
      <AppText color="textSecondary" style={{ marginTop: -spacing.sm }}>
        {t('gifts.body', { name: hostName, pct: appConfig.giftShareBps / 100, n: balance })}
      </AppText>
      <View style={styles.grid}>
        {GIFTS.map((g) => {
          const affordable = balance >= g.coins;
          return (
            <PressableScale
              key={g.id}
              onPress={() => onSend(g)}
              accessibilityLabel={`${t(`gifts.${g.id}`)}, ${g.coins} ${t('common.coins')}${affordable ? '' : `, ${t('gifts.notEnough')}`}`}
              style={[styles.gift, { backgroundColor: colors.surface, borderColor: colors.border, opacity: affordable ? 1 : 0.55 }]}>
              <View style={[styles.giftIcon, { backgroundColor: colors.surfaceAlt }]}>
                <Ionicons name={g.icon} size={28} color={g.color} />
              </View>
              <AppText variant="label">{t(`gifts.${g.id}`)}</AppText>
              <View style={styles.price}>
                <CoinIcon size={14} />
                <AppText variant="caption" tabular color="textSecondary">
                  {g.coins}
                </AppText>
              </View>
            </PressableScale>
          );
        })}
      </View>
    </Sheet>
  );
}

/** A gift floats up and fades out over the call (eased, no bounce). */
export function GiftBurst({ gift, label, onDone }: { gift: Gift & { key: number }; label: string; onDone: () => void }) {
  const y = useSharedValue(24);
  const o = useSharedValue(0);
  useEffect(() => {
    o.set(withSequence(withTiming(1, { duration: motion.base, easing: motion.ease }), withDelay(1100, withTiming(0, { duration: motion.slow, easing: motion.easeIn }, (done) => {
      if (done) scheduleOnRN(onDone);
    }))));
    y.set(withTiming(-36, { duration: 1700, easing: motion.ease }));
  }, [gift.key, o, y, onDone]);
  const style = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value }] }));
  return (
    <View pointerEvents="none" style={styles.burstWrap}>
      <Animated.View style={[styles.burst, style]}>
        <View style={styles.burstIcon}>
          <Ionicons name={gift.icon} size={44} color={gift.color} />
        </View>
        <AppText variant="label" style={{ color: '#fff' }}>
          {label}
        </AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'space-between' },
  gift: { width: '30%', minWidth: 96, flexGrow: 1, alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.md, borderRadius: radius.lg, borderWidth: 1 },
  giftIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  price: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  burstWrap: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  burst: { alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, borderRadius: radius.xl, backgroundColor: 'rgba(0,0,0,0.45)' },
  burstIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
});
