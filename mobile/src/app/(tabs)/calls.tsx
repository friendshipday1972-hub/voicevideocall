import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { HostAvatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { CoinIcon } from '@/components/CoinBadge';
import { Card, EmptyState, MAX_WIDTH } from '@/components/Layout';
import { PressableScale } from '@/components/PressableScale';
import { hostColors } from '@/data/catalog';
import { useLanguage, useT } from '@/i18n';
import { formatDuration, formatWhen } from '@/lib/format';
import { useHosts, usePresence } from '@/stores/hosts';
import { useSocial, type CallRecord } from '@/stores/social';
import { spacing, useTheme } from '@/theme';

type Filter = 'all' | 'favorites';

function CallRow({ call, index }: { call: CallRecord; index: number }) {
const { colors } = useTheme();
const t = useT();
const lang = useLanguage();
  // Name and colour come with the call record, so past calls show even if she's no longer listed.
  const host = { id: call.hostId, name: call.hostName, colors: hostColors(call.hostId) };
  const presence = usePresence((s) => s.presence[call.hostId]);
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 35).duration(280)}>
      <PressableScale onPress={() => router.push({ pathname: '/host/[id]', params: { id: host.id } })} scaleTo={0.985} accessibilityLabel={`${host.name}, ${formatWhen(call.startedAt, lang)}`}>
        <Card style={styles.row}>
          <HostAvatar host={host} size={48} presence={presence} />
          <View style={{ flex: 1, gap: 2 }}>
            <View style={styles.inline}>
              <AppText variant="h3">{host.name}</AppText>
              <Ionicons name={call.type === 'video' ? 'videocam' : 'call'} size={14} color={colors.textMuted} />
            </View>
            <AppText variant="caption" color="textSecondary">
              {formatWhen(call.startedAt, lang)} · {formatDuration(call.durationSec)}
            </AppText>
            {call.refundedCoins > 0 && (
              <AppText variant="caption" color="success">
                {t('callsTab.refunded', { n: call.refundedCoins })}
              </AppText>
            )}
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <View style={styles.inline}>
              <CoinIcon size={14} />
              <AppText variant="label" tabular>
                {call.coinsCharged}
              </AppText>
            </View>
            {call.rating ? (
              <View style={styles.inline}>
                <Ionicons name="star" size={12} color={colors.coin} />
                <AppText variant="caption" color="textSecondary">
                  {call.rating}
                </AppText>
              </View>
            ) : null}
          </View>
        </Card>
      </PressableScale>
    </Animated.View>
  );
}

export default function Calls() {
  const { colors } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const calls = useSocial((s) => s.calls);
  const favorites = useSocial((s) => s.favorites);
  const [filter, setFilter] = useState<Filter>('all');
  const presence = usePresence((s) => s.presence);

  const favHosts = useHosts((s) => s.hosts).filter((h) => favorites.includes(h.id));

  return (
    <View style={[styles.flex, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.column}>
        <AppText variant="h1" style={{ paddingTop: spacing.lg }} accessibilityRole="header">
          {t('callsTab.title')}
        </AppText>
        <View style={styles.filters}>
          <Chip label={t('callsTab.recent')} selected={filter === 'all'} onPress={() => setFilter('all')} />
          <Chip label={`${t('callsTab.favourites')}${favorites.length ? ` (${favorites.length})` : ''}`} icon="heart" selected={filter === 'favorites'} onPress={() => setFilter('favorites')} />
        </View>
      </View>

      {filter === 'all' ? (
        <FlatList
          data={calls}
          keyExtractor={(c) => c.id}
          renderItem={({ item, index }) => <CallRow call={item} index={index} />}
          contentContainerStyle={[styles.column, styles.list]}
          ListEmptyComponent={<EmptyState icon="call-outline" title={t('callsTab.emptyTitle')} body={t('callsTab.emptyBody')} action={<Button title={t('callsTab.emptyAction')} size="md" onPress={() => router.push('/')} />} />}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={favHosts}
          keyExtractor={(h) => h.id}
          contentContainerStyle={[styles.column, styles.list]}
          ListEmptyComponent={<EmptyState icon="heart-outline" title={t('callsTab.favEmptyTitle')} body={t('callsTab.favEmptyBody')} />}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(index * 35).duration(280)}>
              <PressableScale onPress={() => router.push({ pathname: '/host/[id]', params: { id: item.id } })} scaleTo={0.985} accessibilityLabel={item.name}>
                <Card style={styles.row}>
                  <HostAvatar host={item} size={48} presence={presence[item.id]} />
                  <View style={{ flex: 1 }}>
                    <AppText variant="h3">{item.name}</AppText>
                    <AppText variant="caption" color="textSecondary">
                      {presence[item.id] === 'online' ? t('common.onlineNow') : t(`common.presence.${presence[item.id]}`)}
                    </AppText>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Card>
              </PressableScale>
            </Animated.View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  column: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', paddingHorizontal: spacing.lg },
  filters: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.lg },
  list: { gap: spacing.md, paddingBottom: spacing.xxl, flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
