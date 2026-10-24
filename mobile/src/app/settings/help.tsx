import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { Card, Divider, Header, ListRow, Screen, SectionTitle } from '@/components/Layout';
import { PressableScale } from '@/components/PressableScale';
import { appConfig } from '@/config/appConfig';
import { useT } from '@/i18n';
import { spacing, useTheme } from '@/theme';

const FAQ = [
  { q: 'help.q1', a: 'help.a1' },
  { q: 'help.q2', a: 'help.a2' },
  { q: 'help.q3', a: 'help.a3' },
  { q: 'help.q4', a: 'help.a4' },
  { q: 'help.q5', a: 'help.a5' },
] as const;

const GUIDELINES = ['help.g1', 'help.g2', 'help.g3', 'help.g4', 'help.g5', 'help.g6'] as const;

export default function Help() {
  const { colors } = useTheme();
  const t = useT();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <Screen>
      <Header title={t('help.title')} />

      <SectionTitle title={t('help.faqTitle')} />
      <Card style={{ paddingVertical: spacing.xs }}>
        {FAQ.map((f, i) => (
          <View key={f.q}>
            {i > 0 && <Divider />}
            <PressableScale onPress={() => setOpen(open === i ? null : i)} scaleTo={0.99} accessibilityState={{ expanded: open === i }} accessibilityLabel={t(f.q)}>
              <View style={styles.q}>
                <AppText variant="bodyMedium" style={{ flex: 1 }}>
                  {t(f.q)}
                </AppText>
                <Ionicons name={open === i ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
              </View>
            </PressableScale>
            {open === i && (
              <Animated.View entering={FadeIn.duration(200)}>
                <AppText color="textSecondary" style={{ paddingBottom: spacing.md }}>
                  {t(f.a)}
                </AppText>
              </Animated.View>
            )}
          </View>
        ))}
      </Card>

      <SectionTitle title={t('help.guidelinesTitle')} />
      <Card style={{ gap: spacing.sm }}>
        {GUIDELINES.map((g) => (
          <View key={g} style={styles.g}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <AppText>{t(g)}</AppText>
          </View>
        ))}
      </Card>

      <SectionTitle title={t('help.contact')} />
      <Card style={{ paddingVertical: spacing.xs }}>
        <ListRow icon="mail-outline" title={t('help.email')} subtitle="support@example.com" onPress={() => Linking.openURL('mailto:support@example.com')} />
        <Divider />
        <ListRow icon="person-outline" title={t('help.grievance')} subtitle={`${appConfig.grievanceOfficer.name} · ${appConfig.grievanceOfficer.email}`} onPress={() => Linking.openURL(`mailto:${appConfig.grievanceOfficer.email}`)} />
      </Card>
      <AppText variant="caption" color="textMuted" style={{ marginTop: spacing.md }}>
        {t('help.grievanceNote')}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  q: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52 },
  g: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
