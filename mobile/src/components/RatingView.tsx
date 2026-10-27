import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { RATING_TAGS } from '@/data/catalog';
import { useT } from '@/i18n';
import { tagLabel } from '@/i18n/labels';
import { haptic } from '@/lib/haptics';
import { spacing, useTheme } from '@/theme';

import { Chip } from './Chip';
import { PressableScale } from './PressableScale';

export function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const { colors } = useTheme();
  const t = useT();
  return (
    <View style={styles.stars} accessibilityRole="adjustable" accessibilityLabel={t('rating.stars', { n: value })}>
      {[1, 2, 3, 4, 5].map((n) => (
        <PressableScale
          key={n}
          hapticOnPress={false}
          scaleTo={0.8}
          onPress={() => {
            haptic.select();
            onChange(n);
          }}
          accessibilityLabel={t('rating.stars', { n })}
          hitSlop={4}>
          <Ionicons name={n <= value ? 'star' : 'star-outline'} size={40} color={n <= value ? colors.coin : colors.textMuted} />
        </PressableScale>
      ))}
    </View>
  );
}

export function RatingTags({ selected, onToggle }: { selected: string[]; onToggle: (tag: string) => void }) {
  const t = useT();
  return (
    <View style={styles.tags}>
      {RATING_TAGS.map((tag) => (
        <Chip key={tag} label={tagLabel(t, tag)} size="sm" selected={selected.includes(tag)} onPress={() => onToggle(tag)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stars: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  tags: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm },
});
