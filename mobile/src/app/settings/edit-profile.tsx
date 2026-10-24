import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { UserAvatar } from '@/components/Avatar';
import { AvatarPicker } from '@/components/AvatarPicker';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Header, Screen, SectionTitle } from '@/components/Layout';
import { TextField } from '@/components/TextField';
import { toast } from '@/components/Toast';
import { LANGUAGES, type LanguageCode } from '@/data/mock';
import { useT } from '@/i18n';
import { languageName } from '@/i18n/labels';
import { haptic } from '@/lib/haptics';
import { useSession } from '@/stores/session';
import { spacing } from '@/theme';

export default function EditProfile() {
  const t = useT();
  const profile = useSession((s) => s.profile);
  const updateProfile = useSession((s) => s.updateProfile);
  const [name, setName] = useState(profile?.displayName ?? '');
  const [avatar, setAvatar] = useState(profile?.avatarKey ?? 'sun');
  const [languages, setLanguages] = useState<LanguageCode[]>(profile?.languages ?? []);

  const nameError = name.trim().length < 2 ? t('onboarding.nameError') : null;
  const langError = languages.length === 0 ? t('onboarding.langError') : null;
  const dirty = name !== profile?.displayName || avatar !== profile?.avatarKey || languages.join() !== profile?.languages.join();

  const save = () => {
    if (nameError || langError) return haptic.warning();
    updateProfile({ displayName: name.trim(), avatarKey: avatar, languages });
    haptic.success();
    toast.success(t('editProfile.saved'));
    router.back();
  };

  return (
    <Screen footer={<Button title={t('common.save')} onPress={save} disabled={!dirty || !!nameError || !!langError} />}>
      <Header title={t('editProfile.title')} />
      <View style={styles.preview}>
        <UserAvatar avatarKey={avatar} size={96} />
      </View>
      <TextField label={t('onboarding.displayName')} required value={name} onChangeText={setName} maxLength={24} error={nameError} />
      <SectionTitle title={t('editProfile.avatar')} />
      <AvatarPicker value={avatar} onChange={setAvatar} />
      <SectionTitle title={t('editProfile.languages')} />
      <View style={styles.wrap}>
        {LANGUAGES.map((l) => (
          <Chip key={l.code} label={languageName(t, l.code)} selected={languages.includes(l.code)} onPress={() => setLanguages((cur) => (cur.includes(l.code) ? cur.filter((c) => c !== l.code) : [...cur, l.code]))} />
        ))}
      </View>
      {langError && (
        <AppText variant="caption" color="danger" style={{ marginTop: spacing.sm }}>
          {langError}
        </AppText>
      )}
      <AppText variant="caption" color="textMuted" style={{ marginTop: spacing.xl }}>
        {t('editProfile.fixedFields')}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  preview: { alignItems: 'center', marginVertical: spacing.lg },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
