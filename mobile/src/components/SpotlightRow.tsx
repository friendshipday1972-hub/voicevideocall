import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView, StyleSheet, View } from 'react-native';

import { type Host, type Presence } from '@/data/mock';
import { useT } from '@/i18n';
import { spotlightOrder } from '@/lib/quality';
import { fonts, radius, spacing, useTheme } from '@/theme';

import { AppText } from './AppText';
import { PresenceDot } from './Avatar';
import { PressableScale } from './PressableScale';
import { TierBadge } from './Quality';

/**
 * Hosts who make the best impression, ranked by Spotlight Score (rating, returning callers,
 * call length, reliability, safety). Every 4th slot goes to a rising star for fair exposure.
 */
export function SpotlightRow({ hosts, presence, onOpen }: { hosts: Host[]; presence: Record<string, Presence>; onOpen: (h: Host) => void }) {
  const { colors } = useTheme();
  const t = useT();
  const ordered = spotlightOrder(hosts, 8);
  if (ordered.length < 2) return null;

  return (
    <View style={{ gap: spacing.md }}>
      <View style={styles.title}>
        <Ionicons name="sparkles" size={18} color={colors.coin} />
        <AppText variant="h3" accessibilityRole="header" style={{ flex: 1 }}>
          {t('home.spotlight')}
        </AppText>
        <AppText variant="caption" color="textMuted">
          {t('home.spotlightSub')}
        </AppText>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingRight: spacing.lg }}>
        {ordered.map((h) => (
          <PressableScale key={h.id} onPress={() => onOpen(h)} scaleTo={0.97} accessibilityLabel={`${h.name}, ${t(`tier.${h.quality.tier}`)}, ${t('common.ratingValue', { n: h.rating })}`}>
            <LinearGradient colors={h.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
              <View style={styles.top}>
                <PresenceDot presence={presence[h.id]} size={9} />
                {h.featured && <Ionicons name="ribbon" size={14} color="#fff" accessibilityLabel={t('common.featured')} />}
              </View>
              <AppText style={styles.initial}>{h.name[0]}</AppText>
              <View style={{ gap: 4 }}>
                <AppText variant="label" style={{ color: '#fff' }} numberOfLines={1}>
                  {h.name}
                </AppText>
                <TierBadge tier={h.quality.tier} onImage size="sm" />
              </View>
            </LinearGradient>
          </PressableScale>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  card: { width: 124, height: 164, borderRadius: radius.lg, padding: spacing.md, justifyContent: 'space-between' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  initial: { fontFamily: fonts.heading, fontSize: 40, lineHeight: 46, color: 'rgba(255,255,255,0.9)', alignSelf: 'center' },
});
