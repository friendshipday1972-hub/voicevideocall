import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { AVATARS } from '@/data/catalog';
import { useT } from '@/i18n';
import { haptic } from '@/lib/haptics';
import { spacing, useTheme } from '@/theme';

import { UserAvatar } from './Avatar';
import { PressableScale } from './PressableScale';

export function AvatarPicker({ value, onChange }: { value: string; onChange: (key: string) => void }) {
  const { colors } = useTheme();
  const t = useT();
  return (
    <View style={styles.grid} accessibilityRole="radiogroup">
      {AVATARS.map((a) => {
        const selected = a.key === value;
        return (
          <PressableScale
            key={a.key}
            hapticOnPress={false}
            onPress={() => {
              haptic.select();
              onChange(a.key);
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={t('avatar.label', { name: a.key })}
            style={[styles.cell, { borderColor: selected ? colors.primary : 'transparent' }]}>
            <UserAvatar avatarKey={a.key} size={64} />
            {selected && (
              <View style={[styles.check, { backgroundColor: colors.primary, borderColor: colors.background }]}>
                <Ionicons name="checkmark" size={14} color="#fff" />
              </View>
            )}
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'center' },
  cell: { padding: 4, borderRadius: 40, borderWidth: 3 },
  check: { position: 'absolute', right: 0, bottom: 0, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
});
