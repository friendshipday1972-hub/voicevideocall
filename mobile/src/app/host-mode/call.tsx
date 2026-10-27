import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { UserAvatar } from '@/components/Avatar';
import { CallMedia } from '@/components/CallMedia';
import { GiftBurst } from '@/components/Gifts';
import { IconButton } from '@/components/IconButton';
import { MAX_WIDTH } from '@/components/Layout';
import { ReportSheet } from '@/components/ReportSheet';
import { toast } from '@/components/Toast';
import { appConfig, formatRupees } from '@/config/appConfig';
import { GIFTS, avatarByKey, type Gift } from '@/data/catalog';
import { useT } from '@/i18n';
import { hostEarningPerMinutePaise } from '@/lib/billing';
import { fetchCall, watchCall, watchGifts, type LiveCall } from '@/lib/calls';
import { formatDuration } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { rpc } from '@/lib/supabase';
import { useHost } from '@/stores/host';
import { fonts, radius, spacing, useTheme } from '@/theme';

const TICK_MS = 15_000;

/** Host side of a call: timer, live earnings from the server, gifts as they arrive. */
export default function HostCall() {
  const { colors } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const [call, setCall] = useState<LiveCall | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [gift, setGift] = useState<(Gift & { key: number; paise: number }) | null>(null);
  const [giftPaise, setGiftPaise] = useState(0);
  const clearGift = useCallback(() => setGift(null), []);
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(true);
  const [cameraOff, setCameraOff] = useState(false);
  const [frontCamera, setFrontCamera] = useState(true);
  const ended = useRef(false);

  useEffect(() => {
    if (!sessionId) return;
    fetchCall(sessionId).then((c) => c && setCall((prev) => (prev ? { ...c, ...prev } : c)));
    const stopCall = watchCall(sessionId, (update) => setCall((prev) => update(prev)));
    const stopGifts = watchGifts(sessionId, (g) => {
      const meta = GIFTS.find((x) => x.id === g.giftId);
      setGiftPaise((p) => p + g.hostEarnedPaise);
      if (meta) setGift({ ...meta, key: Date.now(), paise: g.hostEarnedPaise });
      haptic.success();
    });
    return () => {
      stopCall();
      stopGifts();
    };
  }, [sessionId]);

  const finish = useCallback(
    (summary: { duration: number; earned: number }) => {
      if (ended.current) return;
      ended.current = true;
      if (summary.earned > 0) toast.success(t('hostCall.earned', { amount: formatRupees(summary.earned), days: appConfig.holdDays }));
      else toast.info(t('hostCall.tooShort'));
      useHost.getState().refresh();
      haptic.tap();
      router.back();
    },
    [t],
  );

  // The caller hung up, ran out of coins, or the network dropped: the server ended it.
  useEffect(() => {
    if (call && call.state !== 'active' && call.state !== 'ringing') {
      const duration = call.startedAt && call.endedAt ? Math.round((call.endedAt - call.startedAt) / 1000) : 0;
      if (call.endReason === 'caller_hangup' || call.endReason === 'low_balance') toast.info(t('hostCall.callerLeft', { name: call.callerName }));
      finish({ duration, earned: call.hostEarnedPaise + giftPaise });
    }
    // giftPaise only adds to the closing message
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call?.state, finish]);

  // Heartbeat from her side too, so the call stays alive if the caller's network is patchy.
  useEffect(() => {
    if (!sessionId) return;
    const tick = () => rpc('call_tick', { p_session: sessionId }).catch(() => {});
    const id = setInterval(tick, TICK_MS);
    return () => clearInterval(id);
  }, [sessionId]);

  useEffect(() => {
    if (!call?.startedAt) return;
    const started = call.startedAt;
    const update = () => setElapsed(Math.max(0, Math.floor((Date.now() - started) / 1000)));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [call?.startedAt]);

  const end = async () => {
    if (!sessionId || ended.current) return;
    try {
      const r = await rpc<{ duration_sec: number }>('end_call', { p_session: sessionId });
      const latest = await fetchCall(sessionId);
      finish({ duration: r.duration_sec, earned: (latest?.hostEarnedPaise ?? 0) + giftPaise });
    } catch {
      finish({ duration: elapsed, earned: 0 });
    }
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

  const isVideo = call?.type === 'video';
  const perMinute = call ? hostEarningPerMinutePaise({ ratePerMin: call.rate, coinValuePaise: call.coinValuePaise, hostShareBps: call.hostShareBps }) : 0;
  const earned = (call?.hostEarnedPaise ?? 0) + giftPaise;
  const name = call?.callerName ?? '';

  return (
    <View style={styles.flex}>
      {call?.state === 'active' ? (
        <CallMedia
          sessionId={call.id}
          channel={call.agoraChannel}
          video={isVideo}
          muted={muted}
          speaker={speaker}
          cameraOff={cameraOff}
          frontCamera={frontCamera}
          remoteName={name}
          remoteColors={avatarByKey(call.callerAvatar).colors}
          selfTop={insets.top + 72}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0B0710' }]} />
      )}
      <View style={[styles.flex, styles.column, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.center}>
          {!isVideo && <UserAvatar avatarKey={call?.callerAvatar ?? undefined} size={128} />}
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
          <IconButton icon={muted ? 'mic-off' : 'mic'} label={muted ? t('call.unmute') : t('call.mute')} size={56} background={muted ? '#fff' : 'rgba(255,255,255,0.16)'} color={muted ? '#0B0710' : '#fff'} onPress={() => setMuted((m) => !m)} />
          {isVideo ? (
            <>
              <IconButton icon={cameraOff ? 'videocam-off' : 'videocam'} label={cameraOff ? t('call.cameraOn') : t('call.cameraOff')} size={56} background={cameraOff ? '#fff' : 'rgba(255,255,255,0.16)'} color={cameraOff ? '#0B0710' : '#fff'} onPress={() => setCameraOff((c) => !c)} />
              <IconButton icon="camera-reverse" label={t('call.flip')} size={56} background="rgba(255,255,255,0.16)" color="#fff" onPress={() => setFrontCamera((f) => !f)} />
            </>
          ) : (
            <IconButton icon={speaker ? 'volume-high' : 'volume-medium'} label={t('call.speaker')} size={56} background={speaker ? '#fff' : 'rgba(255,255,255,0.16)'} color={speaker ? '#0B0710' : '#fff'} onPress={() => setSpeaker((s) => !s)} />
          )}
          <IconButton icon="call" label={t('call.endCall')} size={72} background={colors.danger} color="#fff" onPress={confirmEnd} iconRotate="135deg" />
          <IconButton icon="flag" label={t('hostCall.reportCaller')} size={56} background="rgba(255,255,255,0.16)" color="#fff" onPress={() => setReportOpen(true)} />
        </View>
      </View>
      {gift && <GiftBurst gift={gift} label={t('hostCall.giftReceived', { name, gift: t(`gifts.${gift.id}`), amount: formatRupees(gift.paise) })} onDone={clearGift} />}
      {call && (
        <ReportSheet
          visible={reportOpen}
          onClose={() => setReportOpen(false)}
          targetId={call.callerId}
          targetName={name || t('hostCall.caller')}
          sessionId={call.id}
          onReported={(blocked) => {
            if (blocked) rpc('end_call', { p_session: call.id, p_reason: 'moderation' }).finally(() => finish({ duration: elapsed, earned }));
          }}
        />
      )}
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
