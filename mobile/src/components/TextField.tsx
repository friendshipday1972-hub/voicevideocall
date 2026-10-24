import { forwardRef, useState, type ReactNode } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { fonts, radius, spacing, useTheme } from '@/theme';

import { AppText } from './AppText';

type Props = TextInputProps & {
  label: string;
  error?: string | null;
  helper?: string;
  required?: boolean;
  left?: ReactNode;
};

export const TextField = forwardRef<TextInput, Props>(function TextField({ label, error, helper, required, left, style, onFocus, onBlur, ...rest }, ref) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.danger : focused ? colors.primary : colors.border;

  return (
    <View style={styles.wrap}>
      <AppText variant="label" color="textSecondary">
        {label}
        {required && <AppText color="primary"> *</AppText>}
      </AppText>
      <View style={[styles.box, { borderColor, backgroundColor: colors.surface }, focused && { borderWidth: 2 }]}>
        {left}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={label}
          style={[styles.input, { color: colors.text }, style]}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
      </View>
      {error ? (
        <AppText variant="caption" color="danger" accessibilityLiveRegion="polite" role="alert">
          {error}
        </AppText>
      ) : helper ? (
        <AppText variant="caption" color="textMuted">
          {helper}
        </AppText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs + 2 },
  box: { flexDirection: 'row', alignItems: 'center', minHeight: 52, borderRadius: radius.md, borderWidth: 1.5, paddingHorizontal: spacing.md, gap: spacing.sm },
  input: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 16, paddingVertical: spacing.md },
});
