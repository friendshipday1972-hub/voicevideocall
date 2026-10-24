import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
import { Alert, BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { PulseAvatar, RemoteVideo, SelfView } from '@/components/CallVisuals';
import { CoinIcon } from '@/components/CoinBadge';
import { GiftBurst, GiftSheet } from '@/components/Gifts';
import { IconButton } from '@/components/IconButton';
import { MAX_WIDTH } from '@/components/Layout';
import { RatingTags, StarRating } from '@/components/RatingView';
import { ReportSheet } from '@/components/ReportSheet';
import { TextField } from '@/components/TextField';
import { toast } from '@/components/Toast';
import { TopUpSheet } from '@/components/TopUpSheet';
import { appConfig, type CallType } from '@/config/appConfig';
import { HOSTS, type Gift } from '@/data/mock';
import { useT } from '@/i18n';
import { languageName } from '@/i18n/labels';
import { applyLedger, secondsUntilCutoff, settleEnd, tick, type BillingSession, type CallEndReason } from '@/lib/billing';
import { formatDuration } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { usePresence } from '@/stores/presence';
import { useSession } from '@/stores/session';
import { useSocial } from '@/stores/social';
import { useWallet } from '@/stores/wallet';
import { fonts, motion, radius, spacing, useTheme } from '@/theme';

type Phase = 'ringing' | 'active' | 'ended';

const RING_MS = 2600;



export default function CallScreen() {
  const { colors } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { hostId, type: typeParam } = useLocalSearchParams<{ hostId: string; type: CallType }>();
  const type: CallType = typeParam === 'video' ? 'video' : 'audio';
  const host = HOSTS.find((h) => h.id === hostId) ?? HOSTS[0];
  const profile = useSession((s) => s.profile);
  const balance = useWallet((s) => s.balance);
  const setPresence = usePresence((s) => s.set);
  const addCall = useSocial((s) => s.addCall);
  const rateCall = useSocial((s) => s.rateCall);

  const [phase, setPhase] = useState<Phase>('ringing');
  const [elapsed, setElapsed] = useState(0);
  const [billing, setBilling] = useState<BillingSession | null>(null);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(type === 'video');
  const [cameraOff, setCameraOff] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [result, setResult] = useState<{ reason: CallEndReason; duration: number; coins: number; refunded: number; id: string } | null>(null);
  const [stars, setStars] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [giftOpen, setGiftOpen] = useState(false);
  const [burst, setBurst] = useState<(Gift & { key: number }) | null>(null);
  const [giftCoins, setGiftCoins] = useState(0);
  const giftsSent = useRef(0);
  const giftCoinsRef = useRef(0);

  const [sessionId] = useState(() => `call_${Date.now()}`);
  const startedAt = useRef(0);
  const sessionRef = useRef<BillingSession | null>(null);
  const warned = useRef<Set<number>>(new Set());
  // Mirrors `phase` for timers/handlers; always updated together with setPhase.
  const phaseRef = useRef<Phase>('ringing');

  const rate = type === 'audio' ? host.audioRate : host.videoRate;

  const end = useCallback(
    (reason: CallEndReason) => {
      if (phaseRef.current === 'ended') return;
      const wasActive = phaseRef.current === 'active';
      phaseRef.current = 'ended';
      setPhase('ended');
      setPresence(host.id, 'online');
      if (!wasActive || !sessionRef.current) {
        router.back();
        return;
      }
      const duration = Math.floor((Date.now() - startedAt.current) / 1000);
      const settled = settleEnd(sessionRef.current, useWallet.getState(), duration, appConfig.refundUnderSeconds);
      useWallet.getState().commit(settled.wallet);
      sessionRef.current = settled.session;
      const coins = settled.session.coinsCharged - settled.refundedCoins;
      addCall({ id: sessionId, hostId: host.id, type, startedAt: startedAt.current, durationSec: duration, coinsCharged: coins, refundedCoins: settled.refundedCoins, endReason: reason, giftCoins: giftCoinsRef.current });
      setResult({ reason, duration, coins, refunded: settled.refundedCoins, id: sessionId });
      if (reason === 'low_balance') haptic.warning();
      else haptic.tap();
    },
    [addCall, host.id, sessionId, setPresence, type],
  );

  // Ringing → host accepts (simulated). Real app: host accepts via push / CallKeep.
  useEffect(() => {
    const id = setTimeout(() => {
      if (phaseRef.current !== 'ringing') return;
      const s: BillingSession = {
        id: sessionId,
        ratePerMin: rate,
        hostShareBps: appConfig.hostShareBpsByLevel[host.level],
        coinValuePaise: appConfig.coinValuePaise,
        billedMinutes: 0,
        coinsCharged: 0,
        hostEarnedPaise: 0,
        refunded: false,
      };
      const r = tick(s, useWallet.getState(), 0);
      if (r.ended) {
        toast.error(t('call.noCoinsToStart'));
        phaseRef.current = 'ended';
        router.back();
        return;
      }
      useWallet.getState().commit(r.wallet);
      sessionRef.current = r.session;
      setBilling(r.session);
      startedAt.current = Date.now();
      setPresence(host.id, 'busy');
      phaseRef.current = 'active';
      setPhase('active');
      haptic.success();
    }, RING_MS);
    return () => clearTimeout(id);
  }, [host.id, host.level, rate, sessionId, setPresence, t]);

  // Heartbeat: every second update the timer and bill any minute that just started.
  useEffect(() => {
    if (phase !== 'active') return;
    const id = setInterval(() => {
      const sec = Math.floor((Date.now() - startedAt.current) / 1000);
      setElapsed(sec);
      const s = sessionRef.current;
      if (!s) return;
      const r = tick(s, useWallet.getState(), sec);
      if (r.session !== s) {
        useWallet.getState().commit(r.wallet);
        sessionRef.current = r.session;
        setBilling(r.session);
      }
      if (r.ended) end('low_balance');
    }, 1000);
    return () => clearInterval(id);
  }, [phase, end]);

  const cutoff = billing && phase === 'active' ? secondsUntilCutoff(billing, balance, elapsed) : null;

  useEffect(() => {
    if (cutoff === null) {
      warned.current.clear();
      return;
    }
    for (const t of appConfig.lowBalanceWarnSeconds) {
      if (cutoff <= t && !warned.current.has(t)) {
        warned.current.add(t);
        haptic.warning();
      }
    }
  }, [cutoff]);

  const clearBurst = useCallback(() => setBurst(null), []);

  // Gifts are charged through the same idempotent ledger as call minutes.
  const sendGift = (gift: Gift) => {
    const n = giftsSent.current + 1;
    const r = applyLedger(useWallet.getState(), { delta: -gift.coins, reason: 'gift', idempotencyKey: `gift:${sessionId}:${n}`, refId: sessionId, note: `${gift.name} for ${host.name}` });
    if (!r.applied) {
      haptic.warning();
      setGiftOpen(false);
      setTopUpOpen(true);
      return;
    }
    giftsSent.current = n;
    giftCoinsRef.current += gift.coins;
    useWallet.getState().commit(r.wallet);
    setGiftCoins(giftCoinsRef.current);
    setGiftOpen(false);
    setBurst({ ...gift, key: n });
    haptic.success();
  };

  const confirmEnd = useCallback(() => {
    if (phaseRef.current === 'ringing') return end('caller_hangup');
    Alert.alert(t('call.endConfirm'), undefined, [
      { text: t('common.stay'), style: 'cancel' },
      { text: t('call.endCall'), style: 'destructive', onPress: () => end('caller_hangup') },
    ]);
  }, [end, t]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (phaseRef.current === 'ended') return false;
      confirmEnd();
      return true;
    });
    return () => sub.remove();
  }, [confirmEnd]);

  const finish = (again = false) => {
    if (result && stars > 0) rateCall(result.id, stars, tags, comment);
    if (stars > 0) toast.success(t('call.thanks'));
    router.back();
    if (again) setTimeout(() => router.push({ pathname: '/host/[id]', params: { id: host.id } }), 350);
  };

  // ───────── Ended: summary + rating ─────────
  if (phase === 'ended' && result) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={[styles.summary, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}>
          <Animated.View entering={FadeInDown.duration(380)} style={{ alignItems: 'center', gap: spacing.md }}>
            <PulseAvatar name={host.name} colors={host.colors} size={96} active={false} />
            <AppText variant="h2" align="center">
              {t(`call.endReason.${result.reason}`)}
            </AppText>
            <View style={[styles.summaryStats, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
              <View style={styles.summaryStat}>
                <AppText variant="h2" tabular>
                  {formatDuration(result.duration)}
                </AppText>
                <AppText variant="caption" color="textMuted">
                  {t('call.duration')}
                </AppText>
              </View>
              <View style={[styles.vr, { backgroundColor: colors.divider }]} />
              <View style={styles.summaryStat}>
                <View style={styles.inline}>
                  <CoinIcon size={18} />
                  <AppText variant="h2" tabular>
                    {result.coins}
                  </AppText>
                </View>
                <AppText variant="caption" color="textMuted">
                  {t('call.coinsUsed')}
                </AppText>
              </View>
            </View>
            {giftCoins > 0 && (
              <View style={[styles.notice, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name="gift" size={20} color={colors.primary} />
                <AppText variant="label" style={{ flex: 1 }}>
                  {t('call.giftsSent', { n: giftCoins, name: host.name })}
                </AppText>
              </View>
            )}
            {result.refunded > 0 && (
              <View style={[styles.notice, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name="refresh-circle" size={20} color={colors.success} />
                <AppText variant="label" style={{ flex: 1 }}>
                  {t('call.refunded', { n: result.refunded })}
                </AppText>
              </View>
            )}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(120).duration(380)} style={{ gap: spacing.lg, width: '100%' }}>
            <AppText variant="h3" align="center">
              {t('call.howWas', { name: host.name })}
            </AppText>
            <StarRating value={stars} onChange={setStars} />
            {stars > 0 && (
              <Animated.View entering={FadeIn}>
                <RatingTags selected={tags} onToggle={(t) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))} />
                <View style={{ marginTop: spacing.lg }}>
                  <TextField label={t('call.commentLabel')} value={comment} onChangeText={setComment} placeholder={t('call.commentPlaceholder', { name: host.name })} multiline maxLength={200} helper={t('call.commentHelp', { name: host.name })} />
                </View>
              </Animated.View>
            )}
          </Animated.View>

          <View style={{ gap: spacing.md, width: '100%', marginTop: 'auto' }}>
            <Button title={stars > 0 ? t('call.submit') : t('common.close')} onPress={() => finish()} />
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <Button title={t('call.callAgain')} variant="secondary" icon="refresh" size="md" style={{ flex: 1 }} onPress={() => finish(true)} />
              <Button title={t('hostProfile.report')} variant="ghost" icon="flag-outline" size="md" style={{ flex: 1 }} onPress={() => setReportOpen(true)} />
            </View>
          </View>
        </ScrollView>
        <ReportSheet visible={reportOpen} onClose={() => setReportOpen(false)} targetId={host.id} targetName={host.name} sessionId={sessionId} />
      </View>
    );
  }

  // ───────── Ringing / active ─────────
  const isVideo = type === 'video';
  const active = phase === 'active';
  const minutesLeft = Math.floor(balance / rate);

  return (
    <View style={[styles.flex, { backgroundColor: '#0B0710' }]}>
      {isVideo && active ? <RemoteVideo name={host.name} colors={host.colors} /> : <LinearGradient colors={colors.gradientCall} style={StyleSheet.absoluteFill} />}

      <View style={[styles.flex, styles.column, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.lg }]}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <View style={[styles.glass, styles.inline]}>
            <Ionicons name="lock-closed" size={12} color="#fff" />
            <AppText variant="caption" style={{ color: '#fff' }}>
              {t('call.private', { type: isVideo ? t('common.video') : t('common.voice') })}
            </AppText>
          </View>
          {active && (
            <IconButton icon="flag" label={t('call.report')} size={40} background="rgba(255,255,255,0.14)" color="#fff" onPress={() => setReportOpen(true)} />
          )}
        </View>

        {/* Center */}
        <View style={styles.center}>
          {(!isVideo || !active) && <PulseAvatar name={host.name} colors={host.colors} active={phase === 'ringing' || !muted} fast={phase === 'ringing'} />}
          <AppText variant="h1" style={{ color: '#fff', marginTop: spacing.xl }}>
            {host.name}
          </AppText>
          <AppText style={{ color: 'rgba(255,255,255,0.75)' }}>{host.languages.map((l) => languageName(t, l)).join(' · ')}</AppText>
          {phase === 'ringing' ? (
            <Animated.View entering={FadeIn} style={{ marginTop: spacing.md }}>
              <AppText variant="label" style={{ color: 'rgba(255,255,255,0.9)' }}>
                {t('call.ringing')}
              </AppText>
            </Animated.View>
          ) : (
            <View style={[styles.glass, styles.inline, { marginTop: spacing.md, gap: spacing.md }]}>
              <AppText style={{ color: '#fff', fontFamily: fonts.heading, fontSize: 18 }} tabular>
                {formatDuration(elapsed)}
              </AppText>
              <View style={styles.inline}>
                <CoinIcon size={16} />
                <AppText variant="label" style={{ color: '#fff' }} tabular>
                  {t('call.usedLeft', { used: billing?.coinsCharged ?? 0, left: balance })}
                </AppText>
              </View>
            </View>
          )}
        </View>

        {isVideo && active && (
          <View style={[styles.selfWrap, { top: insets.top + 72 }]}>
            <SelfView avatarKey={profile?.avatarKey} cameraOff={cameraOff} />
          </View>
        )}

        {/* Low balance banner */}
        {cutoff !== null && (
          <Animated.View entering={FadeInUp.duration(motion.base)} exiting={FadeOut} style={[styles.banner, { backgroundColor: cutoff <= 20 ? colors.danger : colors.warning }]} accessibilityLiveRegion="assertive">
            <Ionicons name="warning" size={20} color="#fff" />
            <AppText variant="label" style={{ color: '#fff', flex: 1 }}>
              {cutoff <= 20 ? t('call.endsIn', { s: cutoff }) : t('call.lowBalance', { s: cutoff })}
            </AppText>
            <Button title={t('call.add')} size="md" variant="secondary" onPress={() => setTopUpOpen(true)} style={{ minWidth: 72 }} />
          </Animated.View>
        )}
        {cutoff === null && active && minutesLeft <= 3 && (
          <AppText variant="caption" align="center" style={{ color: 'rgba(255,255,255,0.75)', marginBottom: spacing.sm }}>
            {t('call.minutesLeft', { n: minutesLeft })}
          </AppText>
        )}

        {/* Controls */}
        <View style={styles.controls}>
          {active && (
            <View style={styles.controlRow}>
              <ControlButton icon={muted ? 'mic-off' : 'mic'} label={muted ? t('call.unmute') : t('call.mute')} active={muted} onPress={() => setMuted((m) => !m)} />
              {isVideo ? (
                <>
                  <ControlButton icon={cameraOff ? 'videocam-off' : 'videocam'} label={cameraOff ? t('call.cameraOn') : t('call.cameraOff')} active={cameraOff} onPress={() => setCameraOff((c) => !c)} />
                  <ControlButton icon="camera-reverse" label={t('call.flip')} onPress={() => toast.info(t('call.flipped'))} />
                </>
              ) : (
                <ControlButton icon={speaker ? 'volume-high' : 'volume-medium'} label={t('call.speaker')} active={speaker} onPress={() => setSpeaker((s) => !s)} />
              )}
              <ControlButton icon="gift" label={t('call.gift')} onPress={() => setGiftOpen(true)} />
              <ControlButton icon="add-circle" label={t('call.addCoins')} onPress={() => setTopUpOpen(true)} />
            </View>
          )}
          <View style={{ alignItems: 'center', gap: spacing.xs }}>
            <IconButton icon="call" label={active ? t('call.endCall') : t('call.cancelCall')} size={72} background={colors.danger} color="#fff" onPress={confirmEnd} iconRotate="135deg" />
            <AppText variant="caption" style={{ color: 'rgba(255,255,255,0.8)' }}>
              {active ? t('call.end') : t('common.cancel')}
            </AppText>
          </View>
        </View>
      </View>

      {burst && <GiftBurst gift={burst} label={t('call.youSent', { gift: t(`gifts.${burst.id}`) })} onDone={clearBurst} />}
      <GiftSheet visible={giftOpen} onClose={() => setGiftOpen(false)} onSend={sendGift} balance={balance} hostName={host.name} />
      <TopUpSheet visible={topUpOpen} onClose={() => setTopUpOpen(false)} reason={t('call.topUpReason')} />
      <ReportSheet
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        targetId={host.id}
        targetName={host.name}
        sessionId={sessionId}
        onReported={(blocked) => blocked && end('moderation')}
      />
    </View>
  );
}

function ControlButton({ icon, label, onPress, active }: { icon: ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; active?: boolean }) {
  return (
    <View style={{ alignItems: 'center', gap: spacing.xs, width: 62 }}>
      <IconButton icon={icon} label={label} size={52} onPress={onPress} background={active ? '#fff' : 'rgba(255,255,255,0.16)'} color={active ? '#0B0710' : '#fff'} />
      <AppText variant="caption" style={{ color: 'rgba(255,255,255,0.85)' }} numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  column: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', paddingHorizontal: spacing.lg },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 },
  glass: { backgroundColor: 'rgba(255,255,255,0.14)', paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  selfWrap: { position: 'absolute', right: spacing.lg },
  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, paddingLeft: spacing.md, borderRadius: radius.lg, marginBottom: spacing.lg },
  controls: { gap: spacing.xl },
  controlRow: { flexDirection: 'row', justifyContent: 'space-evenly' },
  summary: { flexGrow: 1, alignItems: 'center', gap: spacing.xxl, paddingHorizontal: spacing.lg, width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center' },
  summaryStats: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.xl, borderWidth: 1, paddingVertical: spacing.lg, marginTop: spacing.sm, width: '100%' },
  summaryStat: { flex: 1, alignItems: 'center', gap: 2 },
  vr: { width: 1, height: 36 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, width: '100%' },
});
