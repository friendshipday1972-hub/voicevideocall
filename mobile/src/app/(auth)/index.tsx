import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { MAX_WIDTH } from '@/components/Layout';
import { APP_NAME } from '@/config/appConfig';
import { LANGUAGES } from '@/data/catalog';
import { useT } from '@/i18n';
import { useSession } from '@/stores/session';
import { radius, spacing, useTheme } from '@/theme';

function FloatingBubble({ icon, size, top, left, delay, colors }: { icon: 'call' | 'videocam' | 'heart' | 'chatbubbles'; size: number; top: `${number}%`; left: `${number}%`; delay: number; colors: readonly [string, string] }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withDelay(delay, withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true)));
  }, [t, delay]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: -10 * t.value }, { rotate: `${-6 + 12 * t.value}deg` }] }));
  return (
    <Animated.View style={[{ position: 'absolute', top, left }, style]}>
      <LinearGradient colors={colors} style={{ width: size, height: size, borderRadius: size / 2.6, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={size * 0.45} color="#fff" />
      </LinearGradient>
    </Animated.View>
  );
}

export default function Welcome() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const uiLanguage = useSession((s) => s.uiLanguage);
  const setUiLanguage = useSession((s) => s.setUiLanguage);
  const t = useT();

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <LinearGradient colors={colors.gradientHero} style={[styles.hero, { paddingTop: insets.top }]}>
        <FloatingBubble icon="videocam" size={72} top="22%" left="12%" delay={0} colors={['#FB7185', '#E11D48']} />
        <FloatingBubble icon="call" size={56} top="16%" left="66%" delay={400} colors={['#A78BFA', '#7C3AED']} />
        <FloatingBubble icon="chatbubbles" size={48} top="52%" left="74%" delay={800} colors={['#FBBF24', '#F97316']} />
        <FloatingBubble icon="heart" size={44} top="56%" left="20%" delay={1200} colors={['#F472B6', '#DB2777']} />
        <Animated.View entering={FadeInDown.duration(500)} style={styles.brand}>
          <LinearGradient colors={colors.gradientPrimary} style={styles.logo}>
            <Ionicons name="chatbubble-ellipses" size={34} color="#fff" />
          </LinearGradient>
          <AppText variant="display">{APP_NAME}</AppText>
          <AppText color="textSecondary" align="center">
            {t('welcome.tagline')}
          </AppText>
        </Animated.View>
      </LinearGradient>

      <Animated.View entering={FadeInDown.delay(150).duration(450)} style={[styles.panel, { paddingBottom: insets.bottom + spacing.lg }]}>
        <AppText variant="h3">{t('language.pick')}</AppText>
        <View style={styles.langs}>
          {LANGUAGES.map((l) => (
            <Chip key={l.code} label={l.native} selected={uiLanguage === l.code} onPress={() => setUiLanguage(l.code)} />
          ))}
        </View>
        <View style={styles.trust}>
          {[
            { icon: 'shield-checkmark' as const, text: t('welcome.verifiedHosts') },
            { icon: 'lock-closed' as const, text: t('welcome.privateCalls') },
            { icon: 'person-circle' as const, text: t('welcome.adultsOnly') },
          ].map((t) => (
            <View key={t.text} style={styles.trustItem}>
              <Ionicons name={t.icon} size={16} color={colors.primary} />
              <AppText variant="caption" color="textSecondary">
                {t.text}
              </AppText>
            </View>
          ))}
        </View>
        <Button title={t('common.continue')} icon="arrow-forward" onPress={() => router.push('/phone')} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { flex: 1, minHeight: 300, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: spacing.xl, overflow: 'hidden' },
  brand: { alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl, maxWidth: 420 },
  logo: { width: 72, height: 72, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  panel: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.xl, gap: spacing.lg },
  langs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  trust: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
