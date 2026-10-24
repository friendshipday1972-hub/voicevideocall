import { Text, type TextProps, type TextStyle } from 'react-native';

import { lineHeightScale, useLanguage } from '@/i18n';
import { type, useTheme, type ThemeColors } from '@/theme';

type Variant = keyof typeof type;
type ColorKey = { [K in keyof ThemeColors]: ThemeColors[K] extends string ? K : never }[keyof ThemeColors];

type Props = TextProps & {
  variant?: Variant;
  color?: ColorKey;
  align?: TextStyle['textAlign'];
  tabular?: boolean;
};

export function AppText({ variant = 'body', color = 'text', align, tabular, style, ...rest }: Props) {
  const { colors } = useTheme();
  const base = type[variant];
  const scale = lineHeightScale(useLanguage());
  return (
    <Text
      maxFontSizeMultiplier={1.4}
      style={[base, scale !== 1 && { lineHeight: Math.round(base.lineHeight * scale) }, { color: colors[color] as string, textAlign: align }, tabular && { fontVariant: ['tabular-nums'] }, style]}
      {...rest}
    />
  );
}
