import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
import { Alert, BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { CallMedia } from '@/components/CallMedia';
import { PulseAvatar } from '@/components/CallVisuals';
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
import { hostColors, type Gift } from '@/data/catalog';
import { useT } from '@/i18n';
import { languageName } from '@/i18n/labels';
import { secondsUntilCutoff, type BillingSession, type CallEndReason } from '@/lib/billing';
import { callErrorText, fetchCall, watchCall, type LiveCall } from '@/lib/calls';
import { formatDuration } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { errorCode, rpc } from '@/lib/supabase';
import { useHostById } from '@/stores/hosts';
import { useSession } from '@/stores/session';
import { useSocial } from '@/stores/social';
import { useWallet } from '@/stores/wallet';
import { fonts, motion, radius, spacing, useTheme } from '@/theme';

type Phase = 'connecting' | 'ringing' | 'active' | 'ended';
type Summary = { reason: CallEndReason; duration: number; coins: number; refunded: number; giftCoins: number };
type EndResult = { state: string; duration_sec: number; coins_charged: number; refunded_coins: number; gift_coins: number; end_reason: CallEndReason | null };
type TickResult = { state: string; billed_minutes: number; coins_charged: number; balance: number | null; elapsed_sec: number };

const TICK_MS = 15_000;

/**
 * Caller side of a call. The server owns everything that matters: it rings the host, starts
 * billing when she accepts, charges each minute on the heartbeat and ends the call when coins
 * run out. This screen follows the call live and shows it.
 */
export default function CallScreen() {
  const { colors } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { hostId, type: typeParam } = useLocalSearchParams<{ hostId: string; type: CallType }>();
  const type: CallType = typeParam === 'video' ? 'video' : 'audio';
  const host = useHostById(hostId);
  const hostName = host?.name ?? '';
  const gradient = host?.colors ?? hostColors(hostId ?? '');
  const profile = useSession((s) => s.profile);
  const balance = useWallet((s) => s.balance);
  const rateCall = useSocial((s) => s.rateCall);

  const [phase, setPhase] = useState<Phase>('connecting');
  const [call, setCall] = useState<LiveCall | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(type === 'video');
  const [cameraOff, setCameraOff] = useState(false);
  const [frontCamera, setFrontCamera] = useState(true);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [stars, setStars] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [giftOpen, setGiftOpen] = useState(false);
  const [burst, setBurst] = useState<(Gift & { key: number }) | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const sessionId = useRef<string | null>(null);
  const phaseRef = useRef<Phase>('connecting');
  const startedAtRef = useRef<number | null>(null);
  // Server clock minus this phone's clock, so the timer matches what is billed.
  const clockOffset = useRef(0);
  const warned = useRef<Set<number>>(new Set());

  const goTo = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const showSummary = useCallback(
    (r: EndResult) => {
      if (phaseRef.current === 'ended') return;
      goTo('ended');
      useSocial.getState().refreshCalls();
      if (r.state !== 'ended') {
        // Never connected: declined, missed or cancelled. Nothing was charged.
        if (r.state === 'declined') toast.info(t('call.declined', { name: hostName }));
        else if (r.state === 'missed') toast.info(t('call.noAnswer', { name: hostName }));
        router.back();
        return;
      }
      const reason = r.end_reason ?? 'caller_hangup';
      setSummary({ reason, duration: r.duration_sec, coins: r.coins_charged, refunded: r.refunded_coins, giftCoins: r.gift_coins });
      if (reason === 'low_balance') haptic.warning();
      else haptic.tap();
    },
    [hostName, t],
  );

  const end = useCallback(
    async (reason?: 'moderation') => {
      const id = sessionId.current;
      if (phaseRef.current === 'ended') return;
      if (!id) {
        goTo('ended');
        router.back();
        return;
      }
      try {
        showSummary(await rpc<EndResult>('end_call', { p_session: id, p_reason: reason ?? null }));
      } catch {
        // The server ends it anyway once heartbeats stop; leave the screen.
        goTo('ended');
        router.back();
      }
    },
    [showSummary],
  );

  // Start: the server checks balance, blocks and presence, then rings her.
  useEffect(() => {
    let alive = true;
    let unwatch: (() => void) | undefined;
    (async () => {
      try {
        const id = await rpc<string>('start_call', { p_host: hostId, p_type: type });
        if (!alive) {
          rpc('cancel_call', { p_session: id }).catch(() => {});
          return;
        }
        sessionId.current = id;
        unwatch = watchCall(id, (update) => setCall((prev) => update(prev)));
        const row = await fetchCall(id);
        if (alive && row) setCall((prev) => (prev ? { ...row, ...prev, callerName: row.callerName, hostName: row.hostName } : row));
        if (alive && phaseRef.current === 'connecting') goTo('ringing');
      } catch (e) {
        if (!alive) return;
        haptic.warning();
        const code = errorCode(e);
        toast.error(callErrorText(t, code, hostName));
        goTo('ended');
        router.back();
      }
    })();
    return () => {
      alive = false;
      unwatch?.();
    };
    // Starts once per screen; host name only shapes the error text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostId, type]);

  useEffect(() => {
    startedAtRef.current = call?.startedAt ?? null;
  }, [call?.startedAt]);

  // React to the server: she accepted, declined, or the call ended (low balance, her hang-up, network).
  useEffect(() => {
    if (!call || !sessionId.current) return;
    if (call.state === 'active' && phaseRef.current !== 'active' && phaseRef.current !== 'ended') {
      goTo('active');
      haptic.success();
    } else if (call.state !== 'ringing' && call.state !== 'active' && phaseRef.current !== 'ended') {
      const fallback: EndResult = { state: call.state, duration_sec: 0, coins_charged: 0, refunded_coins: 0, gift_coins: 0, end_reason: call.endReason };
      rpc<EndResult>('end_call', { p_session: sessionId.current }).then(showSummary, () => showSummary(fallback));
    }
  }, [call, showSummary]);

  // Ring timeout: she didn't answer.
  useEffect(() => {
    if (phase !== 'ringing') return;
    const id = setTimeout(() => {
      if (phaseRef.current !== 'ringing' || !sessionId.current) return;
      rpc<EndResult>('cancel_call', { p_session: sessionId.current, p_timeout: true }).then(
        (r) => showSummary({ ...r, state: r.state ?? 'missed' }),
        () => {
          goTo('ended');
          router.back();
        },
      );
    }, appConfig.ringTimeoutSeconds * 1000);
    return () => clearTimeout(id);
  }, [phase, showSummary]);

  // Heartbeat: the server bills each minute as it starts and ends the call if coins run out.
  useEffect(() => {
    if (phase !== 'active' || !sessionId.current) return;
    const id = sessionId.current;
    const tick = async () => {
      try {
        const r = await rpc<TickResult>('call_tick', { p_session: id });
        if (r.balance !== null && r.balance !== undefined) useWallet.getState().setBalance(Number(r.balance));
        setCall((prev) => (prev ? { ...prev, billedMinutes: r.billed_minutes ?? prev.billedMinutes, coinsCharged: r.coins_charged ?? prev.coinsCharged } : prev));
        if (startedAtRef.current) clockOffset.current = r.elapsed_sec * 1000 - (Date.now() - startedAtRef.current);
        if (r.state === 'ended') rpc<EndResult>('end_call', { p_session: id }).then(showSummary, () => router.back());
      } catch {
        // A missed tick is fine; the next one (or the server's reaper) catches up.
      }
    };
    tick();
    const timer = setInterval(tick, TICK_MS);
    return () => clearInterval(timer);
  }, [phase, showSummary]);

  // Timer from the server's start time.
  useEffect(() => {
    if (phase !== 'active' || !call?.startedAt) return;
    const started = call.startedAt;
    const update = () => setElapsed(Math.max(0, Math.floor((Date.now() + clockOffset.current - started) / 1000)));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [phase, call?.startedAt]);

  const billing: BillingSession | null =
    call && phase === 'active'
      ? { id: call.id, ratePerMin: call.rate, hostShareBps: call.hostShareBps, coinValuePaise: call.coinValuePaise, billedMinutes: call.billedMinutes, coinsCharged: call.coinsCharged, hostEarnedPaise: 0, refunded: false }
      : null;
  const cutoff = billing ? secondsUntilCutoff(billing, balance, elapsed) : null;

  useEffect(() => {
    if (cutoff === null) {
      warned.current.clear();
      return;
    }
    for (const s of appConfig.lowBalanceWarnSeconds) {
      if (cutoff <= s && !warned.current.has(s)) {
        warned.current.add(s);
        haptic.warning();
      }
    }
  }, [cutoff]);

  const clearBurst = useCallback(() => setBurst(null), []);

  const sendGift = async (gift: Gift) => {
    if (!sessionId.current) return;
    setGiftOpen(false);
    try {
      const r = await rpc<{ balance: number }>('send_gift', { p_session: sessionId.current, p_gift: gift.id, p_nonce: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` });
      useWallet.getState().setBalance(Number(r.balance));
      setBurst({ ...gift, key: Date.now() });
      haptic.success();
    } catch (e) {
      haptic.warning();
      if (errorCode(e) === 'insufficient_coins') setTopUpOpen(true);
      else toast.error(callErrorText(t, errorCode(e), hostName));
    }
  };

  const confirmEnd = useCallback(() => {
    if (phaseRef.current !== 'active') {
      const id = sessionId.current;
      goTo('ended');
      if (id) rpc('cancel_call', { p_session: id }).catch(() => {});
      router.back();
      return;
    }
    Alert.alert(t('call.endConfirm'), undefined, [
      { text: t('common.stay'), style: 'cancel' },
      { text: t('call.endCall'), style: 'destructive', onPress: () => end() },
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

  const finish = async (again = false) => {
    if (sessionId.current && stars > 0) {
      setSubmitting(true);
      try {
        await rateCall(sessionId.current, stars, tags, comment);
        toast.success(t('call.thanks'));
      } catch {
        toast.error(t('errors.network'));
      } finally {
        setSubmitting(false);
      }
    }
    router.back();
    if (again && hostId) setTimeout(() => router.push({ pathname: '/host/[id]', params: { id: hostId } }), 350);
  };

  // ───────── Ended: summary + rating ─────────
  if (phase === 'ended' && summary) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={[styles.summary, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}>
          <Animated.View entering={FadeInDown.duration(380)} style={{ alignItems: 'center', gap: spacing.md }}>
            <PulseAvatar name={hostName} colors={gradient} size={96} active={false} />
            <AppText variant="h2" align="center">
              {t(`call.endReason.${summary.reason}`)}
            </AppText>
            <View style={[styles.summaryStats, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
              <View style={styles.summaryStat}>
                <AppText variant="h2" tabular>
                  {formatDuration(summary.duration)}
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
                    {summary.coins}
                  </AppText>
                </View>
                <AppText variant="caption" color="textMuted">
                  {t('call.coinsUsed')}
                </AppText>
              </View>
            </View>
            {summary.giftCoins > 0 && (
              <View style={[styles.notice, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name="gift" size={20} color={colors.primary} />
                <AppText variant="label" style={{ flex: 1 }}>
                  {t('call.giftsSent', { n: summary.giftCoins, name: hostName })}
                </AppText>
              </View>
            )}
            {summary.refunded > 0 && (
              <View style={[styles.notice, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name="refresh-circle" size={20} color={colors.success} />
                <AppText variant="label" style={{ flex: 1 }}>
                  {t('call.refunded', { n: summary.refunded })}
                </AppText>
              </View>
            )}
          </Animated.View>

          {summary.duration > 0 && (
            <Animated.View entering={FadeInDown.delay(120).duration(380)} style={{ gap: spacing.lg, width: '100%' }}>
              <AppText variant="h3" align="center">
                {t('call.howWas', { name: hostName })}
              </AppText>
              <StarRating value={stars} onChange={setStars} />
              {stars > 0 && (
                <Animated.View entering={FadeIn}>
                  <RatingTags selected={tags} onToggle={(tag) => setTags((cur) => (cur.includes(tag) ? cur.filter((x) => x !== tag) : [...cur, tag]))} />
                  <View style={{ marginTop: spacing.lg }}>
                    <TextField label={t('call.commentLabel')} value={comment} onChangeText={setComment} placeholder={t('call.commentPlaceholder', { name: hostName })} multiline maxLength={200} helper={t('call.commentHelp', { name: hostName })} />
                  </View>
                </Animated.View>
              )}
            </Animated.View>
          )}

          <View style={{ gap: spacing.md, width: '100%', marginTop: 'auto' }}>
            <Button title={stars > 0 ? t('call.submit') : t('common.close')} onPress={() => finish()} loading={submitting} />
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <Button title={t('call.callAgain')} variant="secondary" icon="refresh" size="md" style={{ flex: 1 }} onPress={() => finish(true)} />
              <Button title={t('hostProfile.report')} variant="ghost" icon="flag-outline" size="md" style={{ flex: 1 }} onPress={() => setReportOpen(true)} />
            </View>
          </View>
        </ScrollView>
        {hostId && <ReportSheet visible={reportOpen} onClose={() => setReportOpen(false)} targetId={hostId} targetName={hostName} sessionId={call?.id} />}
      </View>
    );
  }

  // ───────── Connecting / ringing / active ─────────
  const isVideo = type === 'video';
  const active = phase === 'active';
  const rate = call?.rate ?? (isVideo ? (host?.videoRate ?? appConfig.rates.video) : (host?.audioRate ?? appConfig.rates.audio));
  const minutesLeft = Math.floor(balance / rate);

  return (
    <View style={[styles.flex, { backgroundColor: '#0B0710' }]}>
      {active && call ? (
        <CallMedia
          sessionId={call.id}
          channel={call.agoraChannel}
          video={isVideo}
          muted={muted}
          speaker={speaker}
          cameraOff={cameraOff}
          frontCamera={frontCamera}
          remoteName={hostName}
          remoteColors={gradient}
          selfAvatarKey={profile?.avatarKey}
          selfTop={insets.top + 72}
        />
      ) : (
        <LinearGradient colors={colors.gradientCall} style={StyleSheet.absoluteFill} />
      )}

      <View style={[styles.flex, styles.column, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.lg }]}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <View style={[styles.glass, styles.inline]}>
            <Ionicons name="lock-closed" size={12} color="#fff" />
            <AppText variant="caption" style={{ color: '#fff' }}>
              {t('call.private', { type: isVideo ? t('common.video') : t('common.voice') })}
            </AppText>
          </View>
          {active && <IconButton icon="flag" label={t('call.report')} size={40} background="rgba(255,255,255,0.14)" color="#fff" onPress={() => setReportOpen(true)} />}
        </View>

        {/* Center */}
        <View style={styles.center}>
          {(!isVideo || !active) && <PulseAvatar name={hostName} colors={gradient} active={!active || !muted} fast={!active} />}
          <AppText variant="h1" style={{ color: '#fff', marginTop: spacing.xl }}>
            {hostName}
          </AppText>
          {host && <AppText style={{ color: 'rgba(255,255,255,0.75)' }}>{host.languages.map((l) => languageName(t, l)).join(' · ')}</AppText>}
          {!active ? (
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
                  {t('call.usedLeft', { used: call?.coinsCharged ?? 0, left: balance })}
                </AppText>
              </View>
            </View>
          )}
        </View>

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
                  <ControlButton icon="camera-reverse" label={t('call.flip')} onPress={() => setFrontCamera((f) => !f)} />
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
      <GiftSheet visible={giftOpen} onClose={() => setGiftOpen(false)} onSend={sendGift} balance={balance} hostName={hostName} />
      <TopUpSheet visible={topUpOpen} onClose={() => setTopUpOpen(false)} reason={t('call.topUpReason')} />
      {hostId && <ReportSheet visible={reportOpen} onClose={() => setReportOpen(false)} targetId={hostId} targetName={hostName} sessionId={call?.id} onReported={(blocked) => blocked && end('moderation')} />}
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
  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, paddingLeft: spacing.md, borderRadius: radius.lg, marginBottom: spacing.lg },
  controls: { gap: spacing.xl },
  controlRow: { flexDirection: 'row', justifyContent: 'space-evenly' },
  summary: { flexGrow: 1, alignItems: 'center', gap: spacing.xxl, paddingHorizontal: spacing.lg, width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center' },
  summaryStats: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.xl, borderWidth: 1, paddingVertical: spacing.lg, marginTop: spacing.sm, width: '100%' },
  summaryStat: { flex: 1, alignItems: 'center', gap: 2 },
  vr: { width: 1, height: 36 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, width: '100%' },
});
