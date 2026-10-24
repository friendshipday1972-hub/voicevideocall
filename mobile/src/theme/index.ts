import { useColorScheme } from '@/hooks/use-color-scheme';

import { darkColors, lightColors, type ThemeColors } from './tokens';

export * from './tokens';

export function useTheme(): { colors: ThemeColors; isDark: boolean } {
  const isDark = useColorScheme() === 'dark';
  return { colors: isDark ? darkColors : lightColors, isDark };
}
