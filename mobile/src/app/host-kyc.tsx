import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import Animated, { FadeInRight, FadeOutLeft, FadeIn } from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Card, Screen } from '@/components/Layout';
import { PressableScale } from '@/components/PressableScale';
import { TextField } from '@/components/TextField';
import { toast } from '@/components/Toast';
import { appConfig, formatRupees, levelRequirements } from '@/config/appConfig';
import { LANGUAGES, type LanguageCode } from '@/data/mock';
import { t as tNow, useT } from '@/i18n';
import { languageName } from '@/i18n/labels';
import { signOutAndReset } from '@/lib/account';
import { haptic } from '@/lib/haptics';
import { useBackHandler } from '@/lib/useBackHandler';
import { useHost } from '@/stores/host';
import { useSession } from '@/stores/session';
import { motion, radius, spacing, useTheme } from '@/theme';

const STEPS = ['kyc.step1', 'kyc.step2', 'kyc.step3'] as const;

function confirmLeave() {
  Alert.alert(tNow('kyc.leaveTitle'), tNow('kyc.leaveBody'), [
    { text: tNow('common.stay'), style: 'cancel' },
    { text: tNow('common.logout'), style: 'destructive', onPress: signOutAndReset },
  ]);
}
const PAN_RE = /^[A-Z]{5}\d{4}[A-Z]$/;
const UPI_RE = /^[\w.-]{2,}@[a-zA-Z]{2,}$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

function VerifyTile({ title, body, done, onPress, icon }: { title: string; body: string; done: boolean; onPress: () => Promise<void> | void; icon: 'id-card' | 'happy' }) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  return (
    <PressableScale
      onPress={async () => {
        if (done || busy) return;
        setBusy(true);
        await onPress();
        setBusy(false);
      }}
      accessibilityLabel={title}
      accessibilityState={{ checked: done, busy }}
      style={[styles.tile, { borderColor: done ? colors.success : colors.border, backgroundColor: colors.surface }]}>
      <View style={[styles.tileIcon, { backgroundColor: done ? 'rgba(22,163,74,0.12)' : colors.primarySoft }]}>
        <Ionicons name={icon} size={22} color={done ? colors.success : colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="h3">{title}</AppText>
        <AppText variant="caption" color="textSecondary">
          {body}
        </AppText>
      </View>
      {busy ? (
        <ActivityIndicator color={colors.primary} />
      ) : done ? (
        <Animated.View entering={FadeIn.duration(motion.base)}>
          <Ionicons name="checkmark-circle" size={26} color={colors.success} />
        </Animated.View>
      ) : (
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      )}
    </PressableScale>
  );
}

function Pending() {
const { colors } = useTheme();
const t = useT();
  const simulateApproval = useHost((s) => s.simulateApproval);
  useBackHandler(() => {
    confirmLeave();
    return true;
  });
  const steps = [
    { label: t('kyc.t1'), done: true },
    { label: t('kyc.t2'), done: true },
    { label: t('kyc.t3'), done: false },
    { label: t('kyc.t4'), done: false },
  ];
  return (
    <Screen
      footer={
        <View style={{ gap: spacing.sm }}>
          <Button
            title={t('kyc.simulate')}
            icon="flash"
            onPress={() => {
              simulateApproval();
              haptic.success();
              toast.success(t('kyc.approved'));
            }}
          />
          <Button title={t('common.logout')} variant="ghost" size="md" onPress={confirmLeave} />
        </View>
      }>
      <View style={{ height: spacing.xl }} />
      <View style={{ alignItems: 'center', gap: spacing.md, marginVertical: spacing.xl }}>
        <View style={[styles.bigIcon, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name="hourglass" size={40} color={colors.primary} />
        </View>
        <AppText variant="h1" align="center">
          {t('kyc.reviewTitle')}
        </AppText>
        <AppText color="textSecondary" align="center">
          {t('kyc.reviewBody')}
        </AppText>
      </View>
      <Card style={{ gap: spacing.lg }}>
        {steps.map((s, i) => (
          <View key={s.label} style={styles.timelineRow}>
            <View style={[styles.dot, { backgroundColor: s.done ? colors.success : colors.border }]}>{s.done && <Ionicons name="checkmark" size={14} color="#fff" />}</View>
            <AppText variant="bodyMedium" color={s.done ? 'text' : 'textMuted'}>
              {s.label}
            </AppText>
            {i === 2 && <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 'auto' }} />}
          </View>
        ))}
      </Card>
    </Screen>
  );
}

export default function HostKyc() {
const { colors } = useTheme();
const t = useT();
  const status = useHost((s) => s.status);
  const submitApplication = useHost((s) => s.submitApplication);
  const profile = useSession((s) => s.profile);

  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState(profile?.displayName ?? '');
  const [bio, setBio] = useState('');
  const [langs, setLangs] = useState<LanguageCode[]>(profile?.languages ?? []);
  const [pan, setPan] = useState('');
  const [aadhaarDone, setAadhaarDone] = useState(false);
  const [selfieDone, setSelfieDone] = useState(false);
  const [payoutKind, setPayoutKind] = useState<'upi' | 'bank'>('upi');
  const [upi, setUpi] = useState('');
  const [account, setAccount] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [agree, setAgree] = useState(false);

  // Android back: previous step; on the first step, offer to log out (verification is mandatory).
  useBackHandler(() => {
    if (status === 'pending') return false; // Pending handles its own back.
    if (step === 0) confirmLeave();
    else {
      setStep(step - 1);
      setSubmitted(false);
    }
    return true;
  });

  if (status === 'pending') return <Pending />;

  const errors = {
    name: name.trim().length < 2 ? t('kyc.errName') : null,
    bio: bio.trim().length < 20 ? t('kyc.errBio') : null,
    langs: langs.length === 0 ? t('kyc.errLangs') : null,
    pan: !PAN_RE.test(pan) ? t('kyc.errPan') : null,
    upi: payoutKind === 'upi' && !UPI_RE.test(upi) ? t('kyc.errUpi') : null,
    account: payoutKind === 'bank' && !/^\d{9,18}$/.test(account) ? t('kyc.errAccount') : null,
    ifsc: payoutKind === 'bank' && !IFSC_RE.test(ifsc) ? t('kyc.errIfsc') : null,
  };
  const stepValid =
    step === 0 ? !errors.name && !errors.bio && !errors.langs : step === 1 ? !errors.pan && aadhaarDone && selfieDone : !errors.upi && !errors.account && !errors.ifsc && agree;
  const show = (e: string | null) => (submitted ? e : null);

  const next = () => {
    setSubmitted(true);
    if (!stepValid) return haptic.warning();
    setSubmitted(false);
    if (step < STEPS.length - 1) return setStep(step + 1);
    submitApplication({
      displayName: name.trim(),
      bio: bio.trim(),
      languages: langs,
      pan,
      aadhaarLast4: '4821',
      selfieDone,
      payout: payoutKind === 'upi' ? { kind: 'upi', upiId: upi } : { kind: 'bank', account, ifsc },
      agreedAt: Date.now(),
    });
    haptic.success();
    toast.success(t('kyc.submitted'));
  };

  const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  return (
    <Screen
      footer={
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          {step > 0 && <Button title={t('common.back')} variant="ghost" onPress={() => setStep(step - 1)} style={{ flex: 1 }} />}
          <Button title={step === STEPS.length - 1 ? t('kyc.submit') : t('common.continue')} onPress={next} style={{ flex: 2 }} />
        </View>
      }>
      <View style={styles.top}>
        <AppText variant="caption" color="textMuted">
          {t('kyc.stepOf', { n: step + 1, total: STEPS.length })}
        </AppText>
        <AppText variant="h1" accessibilityRole="header">
          {t(STEPS[step])}
        </AppText>
      </View>

      {step === 0 && (
        <Animated.View key="h0" entering={FadeInRight.duration(260)} exiting={FadeOutLeft.duration(150)} style={{ gap: spacing.xl }}>
          <Card style={{ gap: spacing.sm, backgroundColor: colors.primarySoft, borderColor: colors.primarySoft }}>
            <View style={styles.inline}>
              <Ionicons name="shield-checkmark" size={18} color={colors.primary} />
              <AppText variant="h3">{t('kyc.requiredTitle')}</AppText>
            </View>
            <AppText variant="caption" color="textSecondary">
              {t('kyc.requiredBody')}
            </AppText>
            <AppText variant="h3" style={{ marginTop: spacing.sm }}>{t('kyc.earn', { min: levelRequirements[0].share, max: levelRequirements[3].share })}</AppText>
            <AppText variant="caption" color="textSecondary">
              {t('kyc.earnBody', { gift: appConfig.giftShareBps / 100, min: formatRupees(appConfig.minWithdrawalPaise) })}
            </AppText>
          </Card>
          <TextField label={t('kyc.hostName')} required value={name} onChangeText={setName} maxLength={24} error={show(errors.name)} />
          <TextField label={t('kyc.about')} required value={bio} onChangeText={setBio} multiline maxLength={200} placeholder={t('kyc.aboutPlaceholder')} error={show(errors.bio)} helper={`${bio.length}/200`} style={{ minHeight: 88, textAlignVertical: 'top' }} />
          <View style={{ gap: spacing.sm }}>
            <AppText variant="label" color="textSecondary">
              {t('kyc.languages')} <AppText color="primary">*</AppText>
            </AppText>
            <View style={styles.wrap}>
              {LANGUAGES.map((l) => (
                <Chip key={l.code} label={languageName(t, l.code)} selected={langs.includes(l.code)} onPress={() => setLangs((c) => (c.includes(l.code) ? c.filter((x) => x !== l.code) : [...c, l.code]))} />
              ))}
            </View>
            {show(errors.langs) && (
              <AppText variant="caption" color="danger">
                {errors.langs}
              </AppText>
            )}
          </View>
        </Animated.View>
      )}

      {step === 1 && (
        <Animated.View key="h1" entering={FadeInRight.duration(260)} exiting={FadeOutLeft.duration(150)} style={{ gap: spacing.lg }}>
          <AppText color="textSecondary">{t('kyc.idBody')}</AppText>
          <TextField label={t('kyc.pan')} required value={pan} onChangeText={(v) => setPan(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))} autoCapitalize="characters" placeholder="ABCDE1234F" error={show(errors.pan)} />
          <VerifyTile
            icon="id-card"
            title={t('kyc.aadhaar')}
            body={aadhaarDone ? t('kyc.aadhaarDone', { last4: '4821' }) : t('kyc.aadhaarBody')}
            done={aadhaarDone}
            onPress={async () => {
              await wait(1400);
              setAadhaarDone(true);
              haptic.success();
            }}
          />
          <VerifyTile
            icon="happy"
            title={t('kyc.selfie')}
            body={selfieDone ? t('kyc.selfieDone') : t('kyc.selfieBody')}
            done={selfieDone}
            onPress={async () => {
              await wait(1800);
              setSelfieDone(true);
              haptic.success();
            }}
          />
          {submitted && (!aadhaarDone || !selfieDone) && (
            <AppText variant="caption" color="danger">
              {t('kyc.bothChecks')}
            </AppText>
          )}
          <AppText variant="caption" color="textMuted">
            {t('kyc.demoNote')}
          </AppText>
        </Animated.View>
      )}

      {step === 2 && (
        <Animated.View key="h2" entering={FadeInRight.duration(260)} exiting={FadeOutLeft.duration(150)} style={{ gap: spacing.lg }}>
          <View style={styles.wrap}>
            <Chip label={t('kyc.upi')} icon="flash" selected={payoutKind === 'upi'} onPress={() => setPayoutKind('upi')} />
            <Chip label={t('kyc.bank')} icon="business" selected={payoutKind === 'bank'} onPress={() => setPayoutKind('bank')} />
          </View>
          {payoutKind === 'upi' ? (
            <TextField label={t('kyc.upiId')} required value={upi} onChangeText={(v) => setUpi(v.trim())} autoCapitalize="none" keyboardType="email-address" placeholder="yourname@okaxis" error={show(errors.upi)} />
          ) : (
            <>
              <TextField label={t('kyc.account')} required value={account} onChangeText={(v) => setAccount(v.replace(/\D/g, ''))} keyboardType="number-pad" error={show(errors.account)} />
              <TextField label={t('kyc.ifsc')} required value={ifsc} onChangeText={(v) => setIfsc(v.toUpperCase().slice(0, 11))} autoCapitalize="characters" placeholder="SBIN0001234" error={show(errors.ifsc)} />
            </>
          )}
          <Card style={{ gap: spacing.sm }}>
            <AppText variant="h3">{t('kyc.rules')}</AppText>
            {[t('kyc.rule1'), t('kyc.rule2'), t('kyc.rule3'), t('kyc.rule4', { days: appConfig.holdDays })].map((r) => (
              <View key={r} style={styles.ruleRow}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <AppText variant="caption" color="textSecondary" style={{ flex: 1 }}>
                  {r}
                </AppText>
              </View>
            ))}
          </Card>
          <PressableScale onPress={() => setAgree((a) => !a)} accessibilityRole="checkbox" accessibilityState={{ checked: agree }} accessibilityLabel={t('kyc.agree')} style={styles.agree}>
            <Ionicons name={agree ? 'checkbox' : 'square-outline'} size={24} color={agree ? colors.primary : colors.textMuted} />
            <AppText style={{ flex: 1 }}>
              {t('kyc.agree')}
            </AppText>
          </PressableScale>
          {submitted && !agree && (
            <AppText variant="caption" color="danger">
              {t('kyc.agreeError')}
            </AppText>
          )}
        </Animated.View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { gap: spacing.xs, paddingTop: spacing.xl, marginBottom: spacing.xl },
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1.5 },
  tileIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  bigIcon: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  timelineRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  agree: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 },
});
