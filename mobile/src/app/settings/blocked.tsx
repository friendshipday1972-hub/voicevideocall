import { View } from 'react-native';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { HostAvatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Card, EmptyState, Header, Screen } from '@/components/Layout';
import { toast } from '@/components/Toast';
import { HOSTS } from '@/data/mock';
import { useT } from '@/i18n';
import { useSocial } from '@/stores/social';
import { spacing } from '@/theme';

export default function Blocked() {
  const t = useT();
  const blocked = useSocial((s) => s.blocked);
  const unblock = useSocial((s) => s.unblock);
  const hosts = HOSTS.filter((h) => blocked.includes(h.id));

  return (
    <Screen>
      <Header title={t('blocked.title')} />
      {hosts.length === 0 ? (
        <EmptyState icon="happy-outline" title={t('blocked.emptyTitle')} body={t('blocked.emptyBody')} />
      ) : (
        <View style={{ gap: spacing.md }}>
          {hosts.map((h) => (
            <Animated.View key={h.id} exiting={FadeOut} layout={LinearTransition}>
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md }}>
                <HostAvatar host={h} size={44} />
                <AppText variant="h3" style={{ flex: 1 }}>
                  {h.name}
                </AppText>
                <Button
                  title={t('blocked.unblock')}
                  variant="secondary"
                  size="md"
                  onPress={() => {
                    unblock(h.id);
                    toast.success(t('blocked.unblocked', { name: h.name }));
                  }}
                />
              </Card>
            </Animated.View>
          ))}
        </View>
      )}
    </Screen>
  );
}
