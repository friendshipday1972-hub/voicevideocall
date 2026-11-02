import { usePreventScreenCapture } from 'expo-screen-capture';
import { Platform } from 'react-native';

const noop = (_key?: string) => {};

/**
 * Blocks screenshots and screen recording while the screen is open (Android shows a black frame).
 * Used on call screens, so nobody can record a host's video, and on the ID/payout form.
 */
export const usePrivateScreen: (key: string) => void = Platform.OS === 'web' ? noop : usePreventScreenCapture;
