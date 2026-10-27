import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { type Host, type Presence } from '@/data/catalog';
import { useT } from '@/i18n';
import { languageName } from '@/i18n/labels';
import { fonts, radius, spacing, useTheme } from '@/theme';

import { AppText } from './AppText';
import { PresenceDot } from './Avatar';
import { CoinIcon } from './CoinBadge';
import { PressableScale } from './PressableScale';
import { TierBadge } from './Quality';

type Props = {
  host: Host;
  presence: Presence;
  favorite: boolean;
  onOpen: (host: Host) => void;
  onCall: (host: Host, type: 'audio' | 'video') => void;
};

export const HostCard = memo(function HostCard({ host, presence, favorite, onOpen, onCall }: Props) {
  const { colors, isDark } = useTheme();
  const t = useT();
  const canCall = presence === 'online';
  const presenceText = t(`common.presence.${presence}`);

  return (
    // The card is a plain View with the profile area and the call buttons as siblings:
    // nesting buttons inside a button is invalid on web and confuses screen readers.
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.divider }, !isDark && styles.shadow]}>
      <PressableScale
        onPress={() => onOpen(host)}
        scaleTo={0.98}
        accessibilityLabel={`${host.name}, ${host.age}, ${presenceText}, ${t('common.ratingValue', { n: host.rating })}`}>
        <LinearGradient colors={host.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.portrait}>
          <AppText style={styles.initial}>{host.name[0]}</AppText>
          <View style={styles.topRow}>
            <View style={styles.pill}>
              <PresenceDot presence={presence} size={8} />
              <AppText variant="caption" style={{ color: '#fff' }}>
                {presenceText}
              </AppText>
            </View>
            {favorite && <Ionicons name="heart" size={18} color="#fff" accessibilityLabel={t('common.favourite')} />}
          </View>
          <View style={styles.verified}>
            {host.quality.tier !== 'none' ? (
              <TierBadge tier={host.quality.tier} onImage size="sm" />
            ) : (
              <View style={styles.verifiedChip}>
                <Ionicons name="shield-checkmark" size={12} color="#fff" />
                <AppText variant="caption" style={{ color: '#fff', fontSize: 11 }}>
                  {t('common.verified')}
                </AppText>
              </View>
            )}
          </View>
        </LinearGradient>

        <View style={styles.body}>
          <View style={styles.nameRow}>
            <AppText variant="h3" numberOfLines={1} style={{ flexShrink: 1 }}>
              {host.name}, {host.age}
            </AppText>
            <View style={styles.rating}>
              <Ionicons name="star" size={12} color={colors.coin} />
              <AppText variant="caption" tabular>
                {host.rating.toFixed(1)}
              </AppText>
            </View>
          </View>
          <AppText variant="caption" color="textSecondary" numberOfLines={1}>
            {host.languages.map((l) => languageName(t, l)).join(' · ')}
          </AppText>
          <View style={styles.price}>
            <CoinIcon size={12} />
            <AppText variant="caption" tabular color="textSecondary">
              {host.audioRate}
              {t('common.perMin')}
            </AppText>
          </View>
        </View>
      </PressableScale>

      <View style={styles.actions}>
        <PressableScale
          onPress={() => onCall(host, 'audio')}
          disabled={!canCall}
          scaleTo={0.95}
          accessibilityLabel={`${t('common.voiceCall')} ${host.name}`}
          style={[styles.callBtn, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name="call" size={18} color={colors.primary} />
        </PressableScale>
        <PressableScale
          onPress={() => onCall(host, 'video')}
          disabled={!canCall}
          scaleTo={0.95}
          accessibilityLabel={`${t('common.videoCall')} ${host.name}`}
          style={[styles.callBtn, { backgroundColor: colors.primary }]}>
          <Ionicons name="videocam" size={19} color={colors.onPrimary} />
        </PressableScale>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, borderWidth: 1, overflow: 'hidden' },
  shadow: {
    shadowColor: '#881337',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  portrait: {
    aspectRatio: 1.05,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontFamily: fonts.heading,
    fontSize: 56,
    lineHeight: 64,
    color: 'rgba(255,255,255,0.92)',
  },
  topRow: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  verified: { position: 'absolute', bottom: spacing.sm, left: spacing.sm },
  verifiedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  body: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: 2 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  price: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    paddingTop: spacing.sm,
  },
  callBtn: {
    flex: 1,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
