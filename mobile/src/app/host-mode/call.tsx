import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { UserAvatar } from '@/components/Avatar';
import { GiftBurst } from '@/components/Gifts';
import { IconButton } from '@/components/IconButton';
import { MAX_WIDTH } from '@/components/Layout';
import { ReportSheet } from '@/components/ReportSheet';
import { toast } from '@/components/Toast';
import { appConfig, formatRupees } from '@/config/appConfig';
import { GIFTS, RATING_TAGS, type Gift } from '@/data/mock';
import { useT } from '@/i18n';
import { hostEarningPerMinutePaise } from '@/lib/billing';
import { formatDuration } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { useHost } from '@/stores/host';
import { fonts, radius, spacing, useTheme } from '@/theme';

const FEEDBACK = ['Such a lovely conversation, thank you!', 'Really good listener. Made my day.', 'Fun and respectful. Will call again.', 'Gave me great advice.', ''];

/** Demo stand-in for the caller's post-call rating (mostly positive, like real traffic). */
function simulatedReview(callerName: string, avatarKey: string) {
  const r = Math.random();
  const stars = r < 0.6 ? 5 : r < 0.9 ? 4 : 3;
  const tags = [...RATING_TAGS].sort(() => Math.random() - 0.5).slice(0, stars >= 4 ? 2 : 1);
  return { author: callerName, avatarKey, stars, tags, text: FEEDBACK[Math.floor(Math.random() * FEEDBACK.length)] };
}

const giftPaise = (g: Gift) => Math.floor((g.coins * appConfig.coinValuePaise * appConfig.giftShareBps) / 10_000);

/** Host side of a call: timer + live earnings (credited per started minute, like the caller is billed). */
export default function HostCall() {
  const { colors } = useTheme();
  const t = useT();
  const [reportOpen, setReportOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const { name = '', avatar, type = 'audio' } = useLocalSearchParams<{ name?: string; avatar?: string; type?: 'audio' | 'video' }>();
  const level = useHost((s) => s.level);
  const addEarning = useHost((s) => s.addEarning);
  const addCall = useHost((s) => s.addCall);
  const addReview = useHost((s) => s.addReview);
  const [gift, setGift] = useState<(Gift & { key: number }) | null>(null);
  const [giftTotal, setGiftTotal] = useState(0);
  const clearGift = useCallback(() => setGift(null), []);
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const ended = useRef(false);

  const perMinute = hostEarningPerMinutePaise({ ratePerMin: appConfig.rates[type], coinValuePaise: appConfig.coinValuePaise, hostShareBps: appConfig.hostShareBpsByLevel[level] });
  const minutes = Math.floor(elapsed / 60) + 1;
  const earned = (elapsed < appConfig.refundUnderSeconds ? 0 : minutes * perMinute) + giftTotal;

  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  // Demo: the caller sends a gift about 20 seconds in. With the backend this arrives as a realtime event.
  useEffect(() => {
    const id = setTimeout(() => {
      if (ended.current) return;
      const g = GIFTS[Math.floor(Math.random() * 3)];
      const paise = giftPaise(g);
      addEarning({ paise, reason: 'gift_earning', label: { kind: 'gift', gift: g.id, name } });
      setGiftTotal((t) => t + paise);
      setGift({ ...g, key: Date.now() });
      haptic.success();
    }, 20_000);
    return () => clearTimeout(id);
  }, [addEarning, name]);

  const end = () => {
    if (ended.current) return;
    ended.current = true;
    const sec = Math.floor((Date.now() - startedAt) / 1000);
    const paise = sec < appConfig.refundUnderSeconds ? 0 : (Math.floor(sec / 60) + 1) * perMinute;
    addCall({ callerName: name, avatarKey: avatar ?? 'sun', type, startedAt, durationSec: sec, earnedPaise: paise });
    if (paise > 0) {
      addEarning({ paise, reason: 'call_earning', label: { kind: 'call', type, name } }, Math.ceil(sec / 60));
      toast.success(t('hostCall.earned', { amount: formatRupees(paise), days: appConfig.holdDays }));
    } else {
      toast.info(t('hostCall.tooShort'));
    }
    if (sec >= appConfig.refundUnderSeconds) {
      // The caller's rating arrives a moment after the call, like in the live app.
      const review = simulatedReview(name, avatar ?? 'sun');
      setTimeout(() => {
        addReview(review);
        toast.info(t('hostCall.rated', { name, n: review.stars }));
      }, 3500);
    }
    haptic.tap();
    router.back();
  };

  const confirmEnd = () =>
    Alert.alert(t('call.endConfirm'), undefined, [
      { text: t('common.stay'), style: 'cancel' },
      { text: t('call.endCall'), style: 'destructive', onPress: end },
    ]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      confirmEnd();
      return true;
    });
    return () => sub.remove();
  });

  return (
    <View style={styles.flex}>
      <LinearGradient colors={colors.gradientCall} style={StyleSheet.absoluteFill} />
      <View style={[styles.flex, styles.column, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.center}>
          <UserAvatar avatarKey={avatar} size={128} />
          <AppText variant="h1" style={{ color: '#fff', marginTop: spacing.lg }}>
            {name}
          </AppText>
          <AppText style={{ color: '#fff', fontFamily: fonts.heading, fontSize: 22 }} tabular>
            {formatDuration(elapsed)}
          </AppText>
          <View style={[styles.earn, { backgroundColor: 'rgba(34,197,94,0.18)' }]}>
            <Ionicons name="trending-up" size={18} color={colors.online} />
            <AppText variant="label" style={{ color: '#fff' }} tabular>
              {t('hostCall.earning', { amount: formatRupees(earned), rate: formatRupees(perMinute) })}
            </AppText>
          </View>
          <AppText variant="caption" style={{ color: 'rgba(255,255,255,0.7)' }} align="center">
            {t('hostCall.rules')}
          </AppText>
        </View>

        <View style={styles.controls}>
          <IconButton icon={muted ? 'mic-off' : 'mic'} label={muted ? t('call.unmute') : t('call.mute')} size={60} background={muted ? '#fff' : 'rgba(255,255,255,0.16)'} color={muted ? '#0B0710' : '#fff'} onPress={() => setMuted((m) => !m)} />
          <IconButton icon="call" label={t('call.endCall')} size={72} background={colors.danger} color="#fff" onPress={confirmEnd} iconRotate="135deg" />
          <IconButton icon="flag" label={t('hostCall.reportCaller')} size={60} background="rgba(255,255,255,0.16)" color="#fff" onPress={() => setReportOpen(true)} />
        </View>
      </View>
      {gift && <GiftBurst gift={gift} label={t('hostCall.giftReceived', { name, gift: t(`gifts.${gift.id}`), amount: formatRupees(giftPaise(gift)) })} onDone={clearGift} />}
      <ReportSheet visible={reportOpen} onClose={() => setReportOpen(false)} targetId={`caller:${name}`} targetName={name || t('hostCall.caller')} onReported={(blocked) => blocked && end()} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  column: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', paddingHorizontal: spacing.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  earn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill },
  controls: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' },
});
