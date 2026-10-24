import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInRight, FadeOutLeft, useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { UserAvatar } from '@/components/Avatar';
import { AvatarPicker } from '@/components/AvatarPicker';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Card, Screen } from '@/components/Layout';
import { PressableScale } from '@/components/PressableScale';
import { TextField } from '@/components/TextField';
import { toast } from '@/components/Toast';
import { appConfig } from '@/config/appConfig';
import { LANGUAGES, type LanguageCode } from '@/data/mock';
import { useT } from '@/i18n';
import { languageName } from '@/i18n/labels';
import { signOutAndReset } from '@/lib/account';
import { applyLedger } from '@/lib/billing';
import { haptic } from '@/lib/haptics';
import { useBackHandler } from '@/lib/useBackHandler';
import { ageFromDob, roleForGender, useSession, type Gender } from '@/stores/session';
import { useWallet } from '@/stores/wallet';
import { motion, radius, spacing, useTheme } from '@/theme';

type StepName = 'About you' | 'Pick an avatar' | 'Your languages';
// Callers pick a privacy avatar; hosts (women) skip it because KYC adds their verified photo.
const USER_STEPS: readonly StepName[] = ['About you', 'Pick an avatar', 'Your languages'];
const HOST_STEPS: readonly StepName[] = ['About you', 'Your languages'];
const STEP_KEY = { 'About you': 'onboarding.aboutYou', 'Pick an avatar': 'onboarding.pickAvatar', 'Your languages': 'onboarding.yourLanguages' } as const;

function validDob(d: string, m: string, y: string): string | null {
  const dd = Number(d);
  const mm = Number(m);
  const yy = Number(y);
  if (!d || !m || y.length !== 4) return null;
  const date = new Date(yy, mm - 1, dd);
  if (date.getFullYear() !== yy || date.getMonth() !== mm - 1 || date.getDate() !== dd) return null;
  return `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

function Progress({ step, total }: { step: number; total: number }) {
  const { colors } = useTheme();
  const t = useT();
  const bar = useAnimatedStyle(() => ({ transform: [{ scaleX: withTiming((step + 1) / total, { duration: motion.base, easing: motion.ease }) }] }));
  return (
    <View style={{ gap: spacing.sm, marginTop: spacing.md }} accessibilityLabel={t('onboarding.stepOf', { n: step + 1, total })}>
      <AppText variant="caption" color="textMuted">
        {t('onboarding.stepOf', { n: step + 1, total })}
      </AppText>
      <View style={[styles.track, { backgroundColor: colors.primarySoft }]}>
        <Animated.View style={[styles.fill, { backgroundColor: colors.primary }, bar]} />
      </View>
    </View>
  );
}

export default function Onboarding() {
  const { colors } = useTheme();
  const completeProfile = useSession((s) => s.completeProfile);
  const t = useT();
  const uiLanguage = useSession((s) => s.uiLanguage);

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [avatar, setAvatar] = useState('sun');
  const [languages, setLanguages] = useState<LanguageCode[]>([uiLanguage]);
  const [consent, setConsent] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const monthRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);

  const isHost = gender === 'female';
  const steps = isHost ? HOST_STEPS : USER_STEPS;
  const current = steps[Math.min(step, steps.length - 1)];
  const isLast = step >= steps.length - 1;

  const dob = validDob(day, month, year);
  const age = dob ? ageFromDob(dob) : null;
  const underage = age !== null && age < appConfig.minAge;
  const nameError = submitted && name.trim().length < 2 ? t('onboarding.nameError') : null;
  const dobError =
    submitted && !dob ? t('onboarding.dobInvalid') : underage ? t('onboarding.underage', { age: appConfig.minAge }) : null;

  const stepValid = current === 'About you' ? name.trim().length >= 2 && !!gender && !!dob && !underage : current === 'Pick an avatar' ? !!avatar : languages.length > 0 && consent;

  const next = () => {
    setSubmitted(true);
    if (!stepValid) {
      haptic.warning();
      return;
    }
    if (!isLast) {
      setStep(step + 1);
      setSubmitted(false);
      return;
    }
    haptic.success();
    completeProfile({ displayName: name.trim(), gender: gender!, role: roleForGender(gender!), dateOfBirth: dob!, avatarKey: isHost ? 'flower' : avatar, languages, consentAt: Date.now(), consentVersion: '2026-10' });
    if (!isHost) {
      // One free voice minute for every new caller, recorded like any other ledger entry.
      const r = applyLedger(useWallet.getState(), { delta: appConfig.trialCoins, reason: 'signup_trial', idempotencyKey: 'signup_trial', note: 'Welcome coins' });
      if (r.applied) {
        useWallet.getState().commit(r.wallet);
        toast.success(t('onboarding.welcomeCoins', { n: appConfig.trialCoins }));
      }
    }
  };

  const back = () => {
    if (step > 0) {
      setStep(step - 1);
      setSubmitted(false);
      return;
    }
    Alert.alert(t('onboarding.changeNumberTitle'), t('onboarding.changeNumberBody'), [
      { text: t('onboarding.stayHere'), style: 'cancel' },
      { text: t('onboarding.changeNumber'), style: 'destructive', onPress: signOutAndReset },
    ]);
  };

  // Android back: previous step instead of closing the app (this is the only screen in the stack).
  useBackHandler(() => {
    back();
    return true;
  });

  return (
    <Screen
      footer={
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Button title={t('common.back')} variant="ghost" onPress={back} style={{ flex: 1 }} />
          <Button title={isLast ? (isHost ? t('onboarding.toVerification') : t('onboarding.startTalking')) : t('common.next')} onPress={next} style={{ flex: 2 }} disabled={underage} />
        </View>
      }>
      <Progress step={step} total={steps.length} />
      <AppText variant="h1" style={{ marginTop: spacing.lg, marginBottom: spacing.xl }} accessibilityRole="header">
        {t(STEP_KEY[current])}
      </AppText>

      {current === 'About you' && (
        <Animated.View key="s0" entering={FadeInRight.duration(260)} exiting={FadeOutLeft.duration(160)} style={{ gap: spacing.xl }}>
          <View style={{ gap: spacing.sm }}>
            <AppText variant="label" color="textSecondary">
              {t('onboarding.gender')} <AppText color="primary">*</AppText>
            </AppText>
            <View style={styles.row}>
              {(['male', 'female', 'other'] as const).map((g) => (
                <Chip key={g} label={t(`onboarding.${g}`)} selected={gender === g} onPress={() => setGender(g)} />
              ))}
            </View>
            {submitted && !gender && (
              <AppText variant="caption" color="danger">
                {t('onboarding.chooseOne')}
              </AppText>
            )}
            {gender && (
              <Animated.View key={isHost ? 'host' : 'user'} entering={FadeIn.duration(motion.base)}>
                <Card style={[styles.roleCard, { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft }]}>
                  <Ionicons name={isHost ? 'shield-checkmark' : 'call'} size={20} color={colors.primary} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText variant="label">{isHost ? t('onboarding.joinAsHost') : t('onboarding.joinAsCaller')}</AppText>
                    <AppText variant="caption" color="textSecondary">
                      {isHost ? t('onboarding.joinAsHostBody') : t('onboarding.joinAsCallerBody')}
                    </AppText>
                  </View>
                </Card>
              </Animated.View>
            )}
          </View>
          <TextField
            label={t('onboarding.displayName')}
            required
            value={name}
            onChangeText={setName}
            placeholder={isHost ? t('onboarding.namePlaceholderHost') : t('onboarding.namePlaceholderCaller')}
            maxLength={24}
            autoCapitalize="words"
            error={nameError}
            helper={isHost ? t('onboarding.nameHelpHost') : t('onboarding.nameHelpCaller')}
          />
          <View style={{ gap: spacing.sm }}>
            <AppText variant="label" color="textSecondary">
              {t('onboarding.dob')} <AppText color="primary">*</AppText>
            </AppText>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <TextField label={t('onboarding.day')} value={day} onChangeText={(text) => { const v = text.replace(/\D/g, '').slice(0, 2); setDay(v); if (v.length === 2) monthRef.current?.focus(); }} keyboardType="number-pad" placeholder="DD" maxLength={2} />
              </View>
              <View style={{ flex: 1 }}>
                <TextField ref={monthRef} label={t('onboarding.month')} value={month} onChangeText={(text) => { const v = text.replace(/\D/g, '').slice(0, 2); setMonth(v); if (v.length === 2) yearRef.current?.focus(); }} keyboardType="number-pad" placeholder="MM" maxLength={2} />
              </View>
              <View style={{ flex: 1.4 }}>
                <TextField ref={yearRef} label={t('onboarding.year')} value={year} onChangeText={(text) => setYear(text.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" placeholder="YYYY" maxLength={4} />
              </View>
            </View>
            {dobError ? (
              <View style={[styles.alert, { backgroundColor: underage ? 'rgba(220,38,38,0.1)' : 'transparent' }]}>
                {underage && <Ionicons name="hand-left" size={18} color={colors.danger} />}
                <AppText variant="caption" color="danger" style={{ flex: 1 }} role="alert">
                  {dobError}
                </AppText>
              </View>
            ) : (
              <AppText variant="caption" color="textMuted">
                {t('onboarding.adultsOnly', { age: appConfig.minAge })}
              </AppText>
            )}
          </View>
        </Animated.View>
      )}

      {current === 'Pick an avatar' && (
        <Animated.View key="s1" entering={FadeInRight.duration(260)} exiting={FadeOutLeft.duration(160)} style={{ gap: spacing.xl, alignItems: 'center' }}>
          <UserAvatar avatarKey={avatar} size={112} />
          <AppText color="textSecondary" align="center">
            {t('onboarding.avatarHelp')}
          </AppText>
          <AvatarPicker value={avatar} onChange={setAvatar} />
        </Animated.View>
      )}

      {current === 'Your languages' && (
        <Animated.View key="s2" entering={FadeInRight.duration(260)} exiting={FadeOutLeft.duration(160)} style={{ gap: spacing.xl }}>
          <AppText color="textSecondary">{isHost ? t('onboarding.langHelpHost') : t('onboarding.langHelpCaller')}</AppText>
          <View style={styles.wrap}>
            {LANGUAGES.map((l) => (
              <Chip
                key={l.code}
                label={`${l.native}${l.native !== languageName(t, l.code) ? ` · ${languageName(t, l.code)}` : ''}`}
                selected={languages.includes(l.code)}
                onPress={() => setLanguages((cur) => (cur.includes(l.code) ? cur.filter((c) => c !== l.code) : [...cur, l.code]))}
              />
            ))}
          </View>
          {submitted && languages.length === 0 && (
            <AppText variant="caption" color="danger">
              {t('onboarding.langError')}
            </AppText>
          )}
          <Card>
            <PressableScale onPress={() => setConsent((c) => !c)} accessibilityRole="checkbox" accessibilityState={{ checked: consent }} accessibilityLabel={t('onboarding.consentError')} style={styles.consent}>
              <Ionicons name={consent ? 'checkbox' : 'square-outline'} size={24} color={consent ? colors.primary : colors.textMuted} />
              <AppText variant="body" style={{ flex: 1 }}>
                {t('onboarding.consent', { age: appConfig.minAge, extra: isHost ? t('onboarding.consentHostExtra') : '' })}
              </AppText>
            </PressableScale>
          </Card>
          {submitted && !consent && (
            <AppText variant="caption" color="danger">
              {t('onboarding.consentError')}
            </AppText>
          )}
        </Animated.View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  track: { height: 6, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: 6, width: '100%', borderRadius: radius.pill, transformOrigin: 'left' },
  row: { flexDirection: 'row', gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  alert: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.sm },
  roleCard: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start', marginTop: spacing.sm },
  consent: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
});
