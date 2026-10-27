import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Switch, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { HostAvatar } from '@/components/Avatar';
import { Chip } from '@/components/Chip';
import { CoinIcon } from '@/components/CoinBadge';
import { LanguageSheet } from '@/components/LanguageSheet';
import { Card, Divider, ListRow, Screen, SectionTitle } from '@/components/Layout';
import { APP_NAME, appConfig, levelRequirements } from '@/config/appConfig';
import { LANGUAGES } from '@/data/catalog';
import { useT } from '@/i18n';
import { languageName } from '@/i18n/labels';
import { signOutAndReset } from '@/lib/account';
import { useHost } from '@/stores/host';
import { useSession } from '@/stores/session';
import { levelColors, radius, spacing, useTheme } from '@/theme';

/** What users see about the host, plus KYC, payout and account settings. */
export default function HostProfile() {
  const { colors } = useTheme();
  const t = useT();
  const uiLanguage = useSession((s) => s.uiLanguage);
  const [langOpen, setLangOpen] = useState(false);
  const profile = useSession((s) => s.profile);
  const phone = useSession((s) => s.phone);
  const notifications = useSession((s) => s.notifications);
  const setNotification = useSession((s) => s.setNotification);
  const bio = useHost((s) => s.bio);
  const target = useHost((s) => s.payoutTarget);
  const idSummary = useHost((s) => s.idSummary);
  const level = useHost((s) => s.level);

  const name = profile?.displayName ?? '';
  const payout = target?.kind === 'upi' ? `UPI · ${target.upiId}` : target ? `Bank · A/c ••${target.last4}` : '—';
  const share = levelRequirements[level - 1].share;

  const logout = () =>
    Alert.alert(t('profile.logoutTitle'), t('hostProfileTab.logoutBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.logout'), style: 'destructive', onPress: signOutAndReset },
    ]);

  return (
    <Screen edges={['top']}>
      <AppText variant="h1" style={{ paddingTop: spacing.lg, marginBottom: spacing.lg }} accessibilityRole="header">
        {t('hostProfileTab.title')}
      </AppText>

      <Animated.View entering={FadeInDown.duration(280)}>
        <Card padded={false} style={{ overflow: 'hidden' }}>
          <LinearGradient colors={[colors.secondary, colors.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cover} />
          <View style={styles.body}>
            <View style={[styles.avatarRing, { borderColor: colors.surface }]}>
              <HostAvatar host={{ name: name || 'H', colors: [colors.primary, colors.accent] as const }} size={84} />
            </View>
            <View style={styles.nameRow}>
              <AppText variant="h2">{name}</AppText>
              <Ionicons name="shield-checkmark" size={18} color={colors.accent} accessibilityLabel={t('common.verified')} />
            </View>
            <View style={[styles.level, { backgroundColor: levelColors[level] }]}>
              <AppText variant="caption" style={{ color: '#fff' }}>
                {t('hostProfileTab.share', { n: level, pct: share })}
              </AppText>
            </View>
            {bio ? (
              <AppText color="textSecondary" align="center">
                {bio}
              </AppText>
            ) : null}
            <View style={styles.chips}>
              {(profile?.languages ?? []).map((l) => (
                <Chip key={l} label={languageName(t, l)} size="sm" icon="language" />
              ))}
            </View>
          </View>
        </Card>
      </Animated.View>

      <SectionTitle title={t('hostProfileTab.whatCallersPay')} />
      <View style={styles.rates}>
        {[
          { icon: 'call' as const, label: t('common.voice'), rate: appConfig.rates.audio },
          { icon: 'videocam' as const, label: t('common.video'), rate: appConfig.rates.video },
        ].map((r) => (
          <Card key={r.label} style={{ flex: 1, gap: spacing.xs }}>
            <Ionicons name={r.icon} size={18} color={colors.primary} />
            <AppText variant="label">{r.label}</AppText>
            <View style={styles.inline}>
              <CoinIcon size={14} />
              <AppText variant="h3" tabular>
                {r.rate}/min
              </AppText>
            </View>
          </Card>
        ))}
      </View>
      <AppText variant="caption" color="textMuted" style={{ marginTop: spacing.sm }}>
        {t('hostProfileTab.ratesNote')}
      </AppText>

      <SectionTitle title={t('hostProfileTab.verification')} />
      <Card style={{ paddingVertical: spacing.xs }}>
        <ListRow icon="id-card-outline" title={t('hostProfileTab.identity')} subtitle={t('hostProfileTab.identitySub', { pan: idSummary?.pan ?? '', aadhaar: idSummary?.aadhaarLast4 ?? '' })} right={<Ionicons name="checkmark-circle" size={22} color={colors.success} />} />
        <Divider />
        <ListRow icon="wallet-outline" title={t('hostProfileTab.payout')} subtitle={payout} />
        <Divider />
        <ListRow icon="call-outline" title={t('hostProfileTab.phone')} subtitle={t('hostProfileTab.phoneSub', { phone: phone ?? '' })} />
      </Card>

      <SectionTitle title={t('profile.settings')} />
      <Card style={{ paddingVertical: spacing.xs, marginBottom: spacing.sm }}>
        <ListRow icon="language-outline" title={t('language.appLanguage')} subtitle={LANGUAGES.find((l) => l.code === uiLanguage)?.native} onPress={() => setLangOpen(true)} />
      </Card>
      <Card style={{ paddingVertical: spacing.xs }}>
        <ListRow
          icon="notifications-outline"
          title={t('hostProfileTab.incomingAlerts')}
          right={<Switch value={notifications.calls} onValueChange={(v) => setNotification('calls', v)} trackColor={{ true: colors.primary, false: colors.border }} thumbColor="#fff" accessibilityLabel={t('hostProfileTab.incomingAlerts')} />}
        />
        <Divider />
        <ListRow icon="sparkles-outline" title={t('hostProfileTab.feedbackRow')} subtitle={t('hostProfileTab.feedbackRowSub')} onPress={() => router.push('/host-mode/feedback')} />
        <Divider />
        <ListRow icon="shield-checkmark-outline" title={t('hostProfileTab.rulesRow')} subtitle={t('hostProfileTab.rulesRowSub')} onPress={() => router.push('/settings/help')} />
        <Divider />
        <ListRow icon="help-buoy-outline" title={t('profile.help')} subtitle={t('profile.helpSub')} onPress={() => router.push('/settings/help')} />
      </Card>

      <View style={{ marginTop: spacing.xxl, gap: spacing.sm }}>
        <Card style={{ paddingVertical: spacing.xs }}>
          <ListRow icon="log-out-outline" title={t('common.logout')} onPress={logout} showChevron={false} />
        </Card>
        <Card style={{ paddingVertical: spacing.xs }}>
          <ListRow icon="trash-outline" title={t('profile.deleteAccount')} danger onPress={() => router.push('/settings/delete-account')} />
        </Card>
      </View>

      <AppText variant="caption" color="textMuted" align="center" style={{ marginTop: spacing.xl }}>
        {t('hostProfileTab.version', { app: APP_NAME })}
      </AppText>
      <LanguageSheet visible={langOpen} onClose={() => setLangOpen(false)} />
      </Screen>
      );
      }

const styles = StyleSheet.create({
  cover: { height: 88 },
  body: { alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, marginTop: -48 },
  avatarRing: { borderWidth: 4, borderRadius: 50 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  level: { paddingHorizontal: spacing.md, paddingVertical: 3, borderRadius: radius.pill },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  rates: { flexDirection: 'row', gap: spacing.md },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
