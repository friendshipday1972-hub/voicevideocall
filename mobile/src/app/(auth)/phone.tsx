import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Header, Screen } from '@/components/Layout';
import { TextField } from '@/components/TextField';
import { useT } from '@/i18n';
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

  const send = () => {
    setTouched(true);
    if (!valid) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      router.push({ pathname: '/otp', params: { phone } });
    }, 700);
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
