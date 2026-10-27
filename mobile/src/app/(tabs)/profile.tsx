import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Switch, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { UserAvatar } from '@/components/Avatar';
import { Card, Divider, ListRow, Screen, SectionTitle } from '@/components/Layout';
import { PressableScale } from '@/components/PressableScale';
import { APP_NAME } from '@/config/appConfig';

import { LanguageSheet } from '@/components/LanguageSheet';
import { LANGUAGES } from '@/data/catalog';
import { useT } from '@/i18n';
import { languageName } from '@/i18n/labels';
import { signOutAndReset } from '@/lib/account';
import { useSession } from '@/stores/session';
import { useSocial } from '@/stores/social';
import { useWallet } from '@/stores/wallet';
import { spacing, useTheme } from '@/theme';

export default function Profile() {
  const { colors } = useTheme();
  const t = useT();
  const uiLanguage = useSession((s) => s.uiLanguage);
  const [langOpen, setLangOpen] = useState(false);
  const profile = useSession((s) => s.profile);
  const phone = useSession((s) => s.phone);
  const notifications = useSession((s) => s.notifications);
  const setNotification = useSession((s) => s.setNotification);
  const blockedCount = useSocial((s) => s.blocked.length);
  const callsCount = useSocial((s) => s.calls.length);
  const balance = useWallet((s) => s.balance);

  const logout = () =>
    Alert.alert(t('profile.logoutTitle'), t('profile.logoutBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.logout'), style: 'destructive', onPress: signOutAndReset },
    ]);

  return (
    <Screen edges={['top']}>
      <AppText variant="h1" style={{ paddingTop: spacing.lg, marginBottom: spacing.lg }} accessibilityRole="header">
        {t('profile.title')}
      </AppText>

      <Animated.View entering={FadeInDown.duration(300)}>
        <Card style={styles.me}>
          <UserAvatar avatarKey={profile?.avatarKey} size={72} />
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="h2">{profile?.displayName}</AppText>
            <AppText variant="caption" color="textSecondary">
              +91 {phone?.replace(/(\d{5})(\d{5})/, '$1 $2')}
            </AppText>
            <AppText variant="caption" color="textSecondary" numberOfLines={1}>
              {profile?.languages.map((l) => languageName(t, l)).join(', ')}
            </AppText>
          </View>
          <PressableScale onPress={() => router.push('/settings/edit-profile')} accessibilityLabel={t('profile.editProfile')} hitSlop={10}>
            <View style={[styles.edit, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="pencil" size={18} color={colors.primary} />
            </View>
          </PressableScale>
        </Card>
      </Animated.View>

      <View style={styles.stats}>
        {[
          { label: t('profile.coins'), value: balance },
          { label: t('profile.calls'), value: callsCount },
        ].map((s) => (
          <Card key={s.label} style={styles.stat}>
            <AppText variant="h2" tabular>
              {s.value}
            </AppText>
            <AppText variant="caption" color="textMuted">
              {s.label}
            </AppText>
          </Card>
        ))}
      </View>

      <SectionTitle title={t('profile.settings')} />
      <Card style={{ paddingVertical: spacing.xs }}>
        <ListRow icon="language-outline" title={t('language.appLanguage')} subtitle={LANGUAGES.find((l) => l.code === uiLanguage)?.native} onPress={() => setLangOpen(true)} />
        <Divider />
        <ListRow icon="person-outline" title={t('profile.editProfile')} subtitle={t('profile.editProfileSub')} onPress={() => router.push('/settings/edit-profile')} />
        <Divider />
        <ListRow
          icon="notifications-outline"
          title={t('profile.callAlerts')}
          right={<Switch value={notifications.calls} onValueChange={(v) => setNotification('calls', v)} trackColor={{ true: colors.primary, false: colors.border }} thumbColor="#fff" accessibilityLabel={t('profile.callAlerts')} />}
        />
        <Divider />
        <ListRow
          icon="heart-outline"
          title={t('profile.favOnline')}
          right={<Switch value={notifications.favoritesOnline} onValueChange={(v) => setNotification('favoritesOnline', v)} trackColor={{ true: colors.primary, false: colors.border }} thumbColor="#fff" accessibilityLabel={t('profile.favOnline')} />}
        />
        <Divider />
        <ListRow
          icon="pricetag-outline"
          title={t('profile.offers')}
          right={<Switch value={notifications.offers} onValueChange={(v) => setNotification('offers', v)} trackColor={{ true: colors.primary, false: colors.border }} thumbColor="#fff" accessibilityLabel={t('profile.offers')} />}
        />
        <Divider />
        <ListRow icon="ban-outline" title={t('profile.blocked')} subtitle={blockedCount ? t('profile.blockedCount', { n: blockedCount }) : t('profile.noneBlocked')} onPress={() => router.push('/settings/blocked')} />
      </Card>

      <SectionTitle title={t('profile.helpSafety')} />
      <Card style={{ paddingVertical: spacing.xs }}>
        <ListRow icon="help-buoy-outline" title={t('profile.help')} subtitle={t('profile.helpSub')} onPress={() => router.push('/settings/help')} />
        <Divider />
        <ListRow icon="shield-checkmark-outline" title={t('profile.guidelines')} onPress={() => router.push('/settings/help')} />
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
        {t('profile.version', { app: APP_NAME })}
      </AppText>
      <LanguageSheet visible={langOpen} onClose={() => setLangOpen(false)} />
      </Screen>
      );
      }

const styles = StyleSheet.create({
  me: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  edit: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  stat: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
});
