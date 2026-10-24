import { Ionicons } from '@expo/vector-icons';
import { FlatList, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { UserAvatar } from '@/components/Avatar';
import { Card, EmptyState, MAX_WIDTH } from '@/components/Layout';
import { formatRupees } from '@/config/appConfig';
import { useLanguage, useT } from '@/i18n';
import { formatDuration, formatWhen } from '@/lib/format';
import { useHost } from '@/stores/host';
import { spacing, useTheme } from '@/theme';

/** Calls the host has taken, with what each one earned. */
export default function HostCalls() {
  const { colors } = useTheme();
  const t = useT();
  const lang = useLanguage();
  const insets = useSafeAreaInsets();
  const calls = useHost((s) => s.calls);
  const totalPaise = calls.reduce((a, c) => a + c.earnedPaise, 0);

  return (
    <View style={[styles.flex, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <FlatList
        data={calls}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ paddingTop: spacing.lg, gap: spacing.xs, marginBottom: spacing.sm }}>
            <AppText variant="h1" accessibilityRole="header">
              {t('hostCalls.title')}
            </AppText>
            {calls.length > 0 && (
              <AppText color="textSecondary">
                {t('hostCalls.summary', { n: calls.length, amount: formatRupees(totalPaise) })}
              </AppText>
            )}
          </View>
        }
        ListEmptyComponent={<EmptyState icon="call-outline" title={t('hostCalls.emptyTitle')} body={t('hostCalls.emptyBody')} />}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 35).duration(260)}>
            <Card style={styles.row}>
              <UserAvatar avatarKey={item.avatarKey} size={44} />
              <View style={{ flex: 1, gap: 2 }}>
                <View style={styles.inline}>
                  <AppText variant="h3">{item.callerName}</AppText>
                  <Ionicons name={item.type === 'video' ? 'videocam' : 'call'} size={14} color={colors.textMuted} />
                </View>
                <AppText variant="caption" color="textSecondary">
                  {formatWhen(item.startedAt, lang)} · {formatDuration(item.durationSec)}
                </AppText>
              </View>
              <AppText variant="label" tabular color={item.earnedPaise > 0 ? 'success' : 'textMuted'}>
                {item.earnedPaise > 0 ? `+${formatRupees(item.earnedPaise)}` : '—'}
              </AppText>
            </Card>
          </Animated.View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md, flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
