import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { LANGUAGES } from '@/data/catalog';
import { translate, useT } from '@/i18n';
import { languageName } from '@/i18n/labels';
import { haptic } from '@/lib/haptics';
import { useSession } from '@/stores/session';
import { radius, spacing, useTheme } from '@/theme';

import { AppText } from './AppText';
import { PressableScale } from './PressableScale';
import { Sheet } from './Sheet';
import { toast } from './Toast';

/**
 * App (interface) language. Separate from the calling languages in the profile: someone can read
 * the app in English and talk in Telugu, or the other way round. Applies instantly, no restart.
 */
export function LanguageSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const t = useT();
  const current = useSession((s) => s.uiLanguage);
  const setUiLanguage = useSession((s) => s.setUiLanguage);

  return (
    <Sheet visible={visible} onClose={onClose} title={t('language.appLanguage')}>
      <AppText color="textSecondary" style={{ marginTop: -spacing.sm }}>
        {t('language.appLanguageHint')}
      </AppText>
      <View accessibilityRole="radiogroup" style={{ gap: spacing.sm }}>
        {LANGUAGES.map((l) => {
          const selected = l.code === current;
          const localName = languageName(t, l.code);
          return (
            <PressableScale
              key={l.code}
              hapticOnPress={false}
              onPress={() => {
                haptic.select();
                if (!selected) {
                  setUiLanguage(l.code);
                  toast.success(translate(l.code, 'language.changed'));
                }
                onClose();
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={l.native}
              style={[styles.row, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primarySoft : colors.surface }]}>
              <View style={{ flex: 1 }}>
                <AppText variant="h3">{l.native}</AppText>
                {localName !== l.native && (
                  <AppText variant="caption" color="textSecondary">
                    {localName}
                  </AppText>
                )}
              </View>
              <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={selected ? colors.primary : colors.textMuted} />
            </PressableScale>
          );
        })}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 60, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.lg, borderWidth: 1.5 },
});
