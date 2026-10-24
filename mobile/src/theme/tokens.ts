import { Easing } from 'react-native-reanimated';

/**
 * Design tokens. Components read colors through `useTheme()`, never raw hex.
 * Palette: vibrant rose + engagement blue (ui-ux-pro-max "Vibrant & Block-based").
 */

const palette = {
  rose50: '#FFF1F2',
  rose100: '#FFE4E6',
  rose200: '#FECDD3',
  rose400: '#FB7185',
  rose500: '#F43F5E',
  rose600: '#E11D48',
  rose700: '#BE123C',
  rose900: '#881337',
  violet500: '#8B5CF6',
  violet600: '#7C3AED',
  blue600: '#2563EB',
  amber400: '#FBBF24',
  amber500: '#F59E0B',
  green500: '#22C55E',
  green600: '#16A34A',
  red600: '#DC2626',
  slate400: '#94A3B8',
  slate500: '#64748B',
  slate600: '#475569',
  slate900: '#0F172A',
  ink950: '#0B0710',
  ink900: '#140D1A',
  ink800: '#1E1526',
  ink700: '#2A1F33',
  ink600: '#3A2C45',
  white: '#FFFFFF',
} as const;

export const lightColors = {
  primary: palette.rose600,
  onPrimary: palette.white,
  primarySoft: palette.rose100,
  secondary: palette.rose400,
  accent: palette.violet600,
  onAccent: palette.white,
  background: '#FFF7F8',
  surface: palette.white,
  surfaceAlt: palette.rose50,
  text: '#2B0A16',
  textSecondary: palette.slate600,
  textMuted: palette.slate500,
  border: palette.rose200,
  divider: '#F3E1E5',
  success: palette.green600,
  warning: palette.amber500,
  danger: palette.red600,
  online: palette.green500,
  busy: palette.amber500,
  offline: palette.slate400,
  coin: palette.amber500,
  scrim: 'rgba(15, 5, 10, 0.55)',
  tabBar: 'rgba(255,255,255,0.96)',
  gradientPrimary: [palette.rose500, palette.rose600, palette.violet600] as const,
  gradientHero: ['#FFE4E6', '#FCE7F3', '#EDE9FE'] as const,
  gradientCall: ['#2A0A1A', '#1E1030', '#0B0710'] as const,
  gradientCoin: [palette.amber400, palette.amber500] as const,
};

export type ThemeColors = { [K in keyof typeof lightColors]: (typeof lightColors)[K] extends readonly string[] ? readonly [string, string, ...string[]] : string };

export const darkColors: ThemeColors = {
  primary: palette.rose500,
  onPrimary: palette.white,
  primarySoft: '#3B1222',
  secondary: palette.rose400,
  accent: palette.violet500,
  onAccent: palette.white,
  background: palette.ink950,
  surface: palette.ink900,
  surfaceAlt: palette.ink800,
  text: '#FCEFF3',
  textSecondary: '#C9B8C4',
  textMuted: '#9C8B98',
  border: palette.ink600,
  divider: palette.ink700,
  success: palette.green500,
  warning: palette.amber400,
  danger: '#F87171',
  online: palette.green500,
  busy: palette.amber400,
  offline: palette.slate500,
  coin: palette.amber400,
  scrim: 'rgba(0, 0, 0, 0.6)',
  tabBar: 'rgba(20,13,26,0.96)',
  gradientPrimary: [palette.rose500, palette.rose600, palette.violet600],
  gradientHero: ['#2A0F1E', '#1E1230', '#0B0710'],
  gradientCall: ['#2A0A1A', '#1E1030', '#0B0710'],
  gradientCoin: [palette.amber400, palette.amber500],
};

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;

export const fonts = {
  heading: 'SpaceGrotesk_700Bold',
  headingMedium: 'SpaceGrotesk_600SemiBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
} as const;

export const type = {
  display: { fontFamily: fonts.heading, fontSize: 32, lineHeight: 38 },
  h1: { fontFamily: fonts.heading, fontSize: 26, lineHeight: 32 },
  h2: { fontFamily: fonts.heading, fontSize: 20, lineHeight: 26 },
  h3: { fontFamily: fonts.headingMedium, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  bodyMedium: { fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: fonts.bodySemi, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 16 },
} as const;

/**
 * Motion: eased timing only, no springs, so nothing overshoots or bounces.
 * `ease` decelerates into place (enter), `easeIn` accelerates away (exit).
 */
export const motion = {
  fast: 150,
  base: 240,
  slow: 320,
  ease: Easing.bezier(0.2, 0, 0, 1),
  easeIn: Easing.bezier(0.3, 0, 1, 1),
} as const;

/** Host level badge colors; white text passes 4.5:1 on each. */
export const levelColors: Record<number, string> = { 1: '#475569', 2: '#0369A1', 3: '#7C3AED', 4: '#BE123C' };

export const iconSize = { sm: 16, md: 20, lg: 24, xl: 32 } as const;
