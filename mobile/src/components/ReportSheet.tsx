import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { REPORT_CATEGORIES, type ReportCategory } from '@/data/catalog';
import { useT } from '@/i18n';
import { haptic } from '@/lib/haptics';
import { useSocial } from '@/stores/social';
import { radius, spacing, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';
import { PressableScale } from './PressableScale';
import { Sheet } from './Sheet';
import { TextField } from './TextField';
import { toast } from './Toast';

type Props = {
  visible: boolean;
  onClose: () => void;
  targetId: string;
  targetName: string;
  sessionId?: string;
  onReported?: (blocked: boolean) => void;
};

export function ReportSheet({ visible, onClose, targetId, targetName, sessionId, onReported }: Props) {
  const { colors } = useTheme();
  const t = useT();
  const report = useSocial((s) => s.report);
  const [sending, setSending] = useState(false);
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(true);

  const close = () => {
    setCategory(null);
    setDetails('');
    setAlsoBlock(true);
    onClose();
  };

  const submit = async () => {
    if (!category || sending) return;
    setSending(true);
    try {
      // One server call files the report (for the admin queue) and blocks, if asked.
      await report({ targetId, sessionId, category, details, block: alsoBlock });
      haptic.success();
      toast.success(alsoBlock ? t('report.doneBlocked', { name: targetName }) : t('report.done'));
      onReported?.(alsoBlock);
      close();
    } catch {
      haptic.error();
      toast.error(t('errors.network'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={close}
      title={t('report.title', { name: targetName })}
      footer={<Button title={t('report.submit')} variant="danger" icon="flag" disabled={!category} loading={sending} onPress={submit} />}>
      <AppText color="textSecondary" style={{ marginTop: -spacing.sm }}>
        {t('report.body')}
      </AppText>
      <View accessibilityRole="radiogroup" style={{ gap: spacing.sm }}>
        {REPORT_CATEGORIES.map((c) => {
          const selected = category === c.key;
          return (
            <PressableScale
              key={c.key}
              hapticOnPress={false}
              onPress={() => {
                haptic.select();
                setCategory(c.key);
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={t(`report.cat.${c.key}`)}
              style={[styles.option, { borderColor: selected ? colors.danger : colors.border, backgroundColor: selected ? 'rgba(220,38,38,0.08)' : colors.surface }]}>
              <AppText variant="bodyMedium" style={{ flex: 1 }}>
                {t(`report.cat.${c.key}`)}
              </AppText>
              <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={20} color={selected ? colors.danger : colors.textMuted} />
            </PressableScale>
          );
        })}
      </View>
      <TextField label={t('report.details')} value={details} onChangeText={setDetails} placeholder={t('report.detailsPlaceholder')} multiline maxLength={500} />
      <PressableScale
        onPress={() => setAlsoBlock((b) => !b)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: alsoBlock }}
        accessibilityLabel={t('report.alsoBlock', { name: targetName })}
        style={styles.check}>
        <Ionicons name={alsoBlock ? 'checkbox' : 'square-outline'} size={22} color={alsoBlock ? colors.primary : colors.textMuted} />
        <AppText variant="bodyMedium">{t('report.alsoBlock', { name: targetName })}</AppText>
      </PressableScale>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  option: { flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingHorizontal: spacing.lg, borderRadius: radius.md, borderWidth: 1.5 },
  check: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
});
