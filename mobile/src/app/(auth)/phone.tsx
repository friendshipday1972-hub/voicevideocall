import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Header, Screen } from '@/components/Layout';
import { TextField } from '@/components/TextField';
import { toast } from '@/components/Toast';
import { useT } from '@/i18n';
import { haptic } from '@/lib/haptics';
import { useSession } from '@/stores/session';
import { spacing, useTheme } from '@/theme';

const PHONE_RE = /^[6-9]\d{9}$/;

export default function Phone() {
  const { colors } = useTheme();
  const t = useT();
  const [phone, setPhone] = useState('');
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const valid = PHONE_RE.test(phone);
  const error = touched && phone.length > 0 && !valid ? t('phone.invalid') : null;

  const send = async () => {
    setTouched(true);
    if (!valid || loading) return;
    setLoading(true);
    try {
      await useSession.getState().sendOtp(phone);
      router.push({ pathname: '/otp', params: { phone } });
    } catch (e) {
      haptic.error();
      toast.error(t((e as Error).message === 'too_many' ? 'otp.tooMany' : 'otp.sendFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen footer={<Button title={t('phone.sendOtp')} onPress={send} loading={loading} disabled={!valid} />}>
      <Header title="" />
      <Animated.View entering={FadeInDown.duration(350)} style={{ gap: spacing.sm, marginBottom: spacing.xl }}>
        <AppText variant="h1">{t('phone.title')}</AppText>
        <AppText color="textSecondary">{t('phone.body')}</AppText>
      </Animated.View>
      <TextField
        label={t('phone.label')}
        required
        value={phone}
        onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 10))}
        onBlur={() => setTouched(true)}
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        autoComplete="tel"
        autoFocus
        maxLength={10}
        placeholder="98765 43210"
        error={error}
        left={
          <View style={{ paddingRight: spacing.sm, borderRightWidth: 1, borderRightColor: colors.border }}>
            <AppText variant="bodyMedium">+91</AppText>
          </View>
        }
        onSubmitEditing={send}
      />
      <AppText variant="caption" color="textMuted" style={{ marginTop: spacing.lg }}>
        {t('phone.consent')}
      </AppText>
    </Screen>
  );
}
