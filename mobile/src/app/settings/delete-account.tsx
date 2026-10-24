import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card, Header, Screen } from '@/components/Layout';
import { TextField } from '@/components/TextField';
import { useT } from '@/i18n';
import { signOutAndReset } from '@/lib/account';
import { useSession } from '@/stores/session';
import { useWallet } from '@/stores/wallet';
import { spacing, useTheme } from '@/theme';

const CONFIRM_WORD = 'DELETE';

export default function DeleteAccount() {
  const { colors } = useTheme();
  const t = useT();
  const balance = useWallet((s) => s.balance);
  const isHost = useSession((s) => s.profile?.role === 'host');
  const [confirm, setConfirm] = useState('');

  const doDelete = () =>
    Alert.alert(t('deleteAccount.confirmTitle'), t('deleteAccount.confirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('deleteAccount.confirm'),
        style: 'destructive',
        onPress: () => {
          signOutAndReset();
        },
      },
    ]);

  return (
    <Screen footer={<Button title={t('deleteAccount.button')} variant="danger" icon="trash" disabled={confirm.trim().toUpperCase() !== CONFIRM_WORD} onPress={doDelete} />}>
      <Header title={t('deleteAccount.title')} />
      <Card style={{ gap: spacing.md }}>
        <View style={styles.row}>
          <Ionicons name="warning" size={22} color={colors.danger} />
          <AppText variant="h3" style={{ flex: 1 }}>
            {t('deleteAccount.what')}
          </AppText>
        </View>
        {[
          t('deleteAccount.p1'),
          isHost ? t('deleteAccount.p2Host') : t('deleteAccount.p2Caller', { n: balance }),
          t('deleteAccount.p3'),
          t('deleteAccount.p4'),
        ].map((t) => (
          <View key={t} style={styles.row}>
            <AppText color="textSecondary">•</AppText>
            <AppText color="textSecondary" style={{ flex: 1 }}>
              {t}
            </AppText>
          </View>
        ))}
      </Card>
      <View style={{ marginTop: spacing.xl }}>
        <TextField label={t('deleteAccount.confirmLabel', { word: CONFIRM_WORD })} value={confirm} onChangeText={setConfirm} autoCapitalize="characters" autoCorrect={false} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' } });
