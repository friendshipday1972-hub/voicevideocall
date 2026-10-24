import { useEffect, useRef } from 'react';
import { BackHandler } from 'react-native';

/**
 * Intercepts the Android hardware back button / back gesture.
 * `handler` returns true when it handled the back press (default navigation is skipped).
 */
export function useBackHandler(handler: () => boolean) {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => ref.current());
    return () => sub.remove();
  }, []);
}
