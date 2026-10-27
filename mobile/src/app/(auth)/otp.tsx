import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Header, Screen } from '@/components/Layout';
import { toast } from '@/components/Toast';
import { useT } from '@/i18n';
import { haptic } from '@/lib/haptics';
import { useSession } from '@/stores/session';
import { fonts, radius, spacing, useTheme } from '@/theme';

const LENGTH = 6;
const RESEND_SECONDS = 30;

export default function Otp() {
  const { colors } = useTheme();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const t = useT();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const input = useRef<TextInput>(null);
  const shake = useSharedValue(0);

  useEffect(() => {
    if (seconds <= 0) return;
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [seconds]);

  const verify = async (value: string) => {
    if (value.length !== LENGTH || loading) return;
    setLoading(true);
    try {
      await useSession.getState().verifyOtp(phone ?? '', value);
      haptic.success();
    } catch (e) {
      haptic.error();
      setError(t((e as Error).message === 'otp_expired' ? 'otp.expired' : 'otp.wrong'));
      shake.set(withSequence(withTiming(-8, { duration: 50 }), withTiming(8, { duration: 50 }), withTiming(-6, { duration: 50 }), withTiming(0, { duration: 50 })));
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  return (
    <Screen footer={<Button title={t('otp.verify')} onPress={() => verify(code)} loading={loading} disabled={code.length !== LENGTH} />}>
      <Header title="" />
      <Animated.View entering={FadeInDown.duration(350)} style={{ gap: spacing.sm, marginBottom: spacing.xl }}>
        <AppText variant="h1">{t('otp.title')}</AppText>
        <AppText color="textSecondary">
          {t('otp.sentTo', { phone: phone ?? '' })}
        </AppText>
      </Animated.View>

      <Pressable onPress={() => input.current?.focus()} accessibilityLabel={t('otp.inputLabel')}>
        <Animated.View style={[styles.cells, shakeStyle]}>
          {Array.from({ length: LENGTH }).map((_, i) => {
            const active = i === code.length;
            const filled = i < code.length;
            return (
              <View
                key={i}
                style={[
                  styles.cell,
                  { backgroundColor: colors.surface, borderColor: error ? colors.danger : active ? colors.primary : filled ? colors.secondary : colors.border },
                  active && { borderWidth: 2 },
                ]}>
                <AppText style={{ fontFamily: fonts.heading, fontSize: 24 }}>{code[i] ?? ''}</AppText>
              </View>
            );
          })}
        </Animated.View>
      </Pressable>
      <TextInput
        ref={input}
        value={code}
        onChangeText={(t) => {
          const v = t.replace(/\D/g, '').slice(0, LENGTH);
          setError(null);
          setCode(v);
          if (v.length === LENGTH) verify(v);
        }}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        autoFocus
        maxLength={LENGTH}
        style={styles.hidden}
        accessibilityLabel={t('otp.inputLabel')}
      />
      {error && (
        <AppText variant="caption" color="danger" style={{ marginTop: spacing.md }} role="alert">
          {error}
        </AppText>
      )}

      <View style={styles.resend}>
        {seconds > 0 ? (
          <AppText color="textMuted" tabular>
            {t('otp.resendIn', { s: String(seconds).padStart(2, '0') })}
          </AppText>
        ) : (
          <Pressable
            hitSlop={12}
            onPress={() => {
              setSeconds(RESEND_SECONDS);
              useSession.getState().sendOtp(phone ?? '').then(
                () => toast.info(t('otp.resent')),
                () => toast.error(t('otp.sendFailed')),
              );
            }}
            accessibilityRole="button">
            <AppText variant="label" color="primary">
              {t('otp.resend')}
            </AppText>
          </Pressable>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cells: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  cell: { flex: 1, maxWidth: 56, aspectRatio: 0.85, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  hidden: { position: 'absolute', opacity: 0, width: 1, height: 1 },
  resend: { marginTop: spacing.xl, alignItems: 'center' },
});
