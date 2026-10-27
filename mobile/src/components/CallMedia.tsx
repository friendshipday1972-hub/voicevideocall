import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform, StyleSheet, View } from 'react-native';

import { useT } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { radius, spacing, useTheme } from '@/theme';

import { AppText } from './AppText';
import { RemoteVideo, SelfView } from './CallVisuals';

type Agora = typeof import('react-native-agora');

/**
 * The Agora SDK is native code: it exists in the installed app (EAS build) but not in Expo Go,
 * where importing it throws. Load it once, defensively, so Expo Go still runs the full call flow
 * (ringing, billing, gifts) without audio/video.
 */
const agora: Agora | null = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-agora') as Agora;
  } catch {
    return null;
  }
})();

export const mediaAvailable = agora !== null;

type Props = {
  sessionId: string;
  channel: string;
  video: boolean;
  muted: boolean;
  speaker: boolean;
  cameraOff: boolean;
  frontCamera: boolean;
  remoteName: string;
  remoteColors: readonly [string, string];
  selfAvatarKey?: string;
  /** Where the small self-view sits (below the top bar). */
  selfTop: number;
};

async function askPermissions(video: boolean) {
  if (Platform.OS !== 'android') return;
  const wanted = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, ...(video ? [PermissionsAndroid.PERMISSIONS.CAMERA] : [])];
  await PermissionsAndroid.requestMultiple(wanted);
}

/** Live audio/video for an active call, drawn behind the call controls. */
export function CallMedia(props: Props) {
  const { colors } = useTheme();
  if (!agora) return <Fallback {...props} gradient={colors.gradientCall} />;
  return <AgoraMedia {...props} sdk={agora} gradient={colors.gradientCall} />;
}

function Fallback({ video, remoteName, remoteColors, selfAvatarKey, cameraOff, selfTop, gradient }: Props & { gradient: readonly [string, string, ...string[]] }) {
  const t = useT();
  return (
    <View style={StyleSheet.absoluteFill}>
      {video ? <RemoteVideo name={remoteName} colors={remoteColors} /> : <LinearGradient colors={gradient} style={StyleSheet.absoluteFill} />}
      {video && (
        <View style={[styles.self, { top: selfTop }]}>
          <SelfView avatarKey={selfAvatarKey} cameraOff={cameraOff} />
        </View>
      )}
      <View style={[styles.note, { top: selfTop - 28 }]} pointerEvents="none">
        <AppText variant="caption" style={{ color: 'rgba(255,255,255,0.8)' }}>
          {t('call.mediaInApp')}
        </AppText>
      </View>
    </View>
  );
}

function AgoraMedia({ sdk, sessionId, channel, video, muted, speaker, cameraOff, frontCamera, remoteName, remoteColors, selfAvatarKey, selfTop, gradient }: Props & { sdk: Agora; gradient: readonly [string, string, ...string[]] }) {
  const engine = useRef<ReturnType<Agora['createAgoraRtcEngine']> | null>(null);
  const [joined, setJoined] = useState(false);
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [remoteVideoOn, setRemoteVideoOn] = useState(true);
  const lastFront = useRef(true);

  useEffect(() => {
    let alive = true;
    const rtc = sdk.createAgoraRtcEngine();
    engine.current = rtc;
    const handler = {
      onJoinChannelSuccess: () => alive && setJoined(true),
      onUserJoined: (_c: unknown, uid: number) => alive && setRemoteUid(uid),
      onUserOffline: () => alive && setRemoteUid(null),
      onRemoteVideoStateChanged: (_c: unknown, _uid: number, state: number) => alive && setRemoteVideoOn(state !== 0),
    };
    (async () => {
      await askPermissions(video);
      const { data, error } = await supabase.functions.invoke<{ appId: string; token: string; uid: number }>('agora-token', { body: { sessionId } });
      if (!alive || error || !data) return;
      rtc.initialize({ appId: data.appId, channelProfile: sdk.ChannelProfileType.ChannelProfileCommunication });
      rtc.registerEventHandler(handler);
      rtc.enableAudio();
      if (video) {
        rtc.enableVideo();
        rtc.startPreview();
      }
      rtc.setDefaultAudioRouteToSpeakerphone(video);
      rtc.joinChannel(data.token, channel, data.uid, {
        clientRoleType: sdk.ClientRoleType.ClientRoleBroadcaster,
        publishMicrophoneTrack: true,
        publishCameraTrack: video,
        autoSubscribeAudio: true,
        autoSubscribeVideo: video,
      });
    })();
    return () => {
      alive = false;
      rtc.unregisterEventHandler(handler);
      rtc.leaveChannel();
      rtc.release();
      engine.current = null;
    };
  }, [sdk, sessionId, channel, video]);

  useEffect(() => {
    engine.current?.muteLocalAudioStream(muted);
  }, [muted, joined]);

  useEffect(() => {
    if (joined) engine.current?.setEnableSpeakerphone(speaker);
  }, [speaker, joined]);

  useEffect(() => {
    if (!video) return;
    engine.current?.muteLocalVideoStream(cameraOff);
    engine.current?.enableLocalVideo(!cameraOff);
  }, [cameraOff, video, joined]);

  useEffect(() => {
    if (!video || frontCamera === lastFront.current) return;
    lastFront.current = frontCamera;
    engine.current?.switchCamera();
  }, [frontCamera, video]);

  if (!video) return <LinearGradient colors={gradient} style={StyleSheet.absoluteFill} />;

  const { RtcSurfaceView } = sdk;
  return (
    <View style={StyleSheet.absoluteFill}>
      {remoteUid !== null && remoteVideoOn ? <RtcSurfaceView style={StyleSheet.absoluteFill} canvas={{ uid: remoteUid }} /> : <RemoteVideo name={remoteName} colors={remoteColors} />}
      <View style={[styles.self, { top: selfTop }]}>
        {joined && !cameraOff ? (
          <View style={styles.selfVideo}>
            <RtcSurfaceView style={StyleSheet.absoluteFill} canvas={{ uid: 0 }} zOrderMediaOverlay />
          </View>
        ) : (
          <SelfView avatarKey={selfAvatarKey} cameraOff={cameraOff} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  self: { position: 'absolute', right: spacing.lg },
  selfVideo: { width: 104, height: 148, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#000' },
  note: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
});
