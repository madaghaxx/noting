import { useState } from "react";
import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";

import { useTheme } from "@/src/theme";
import type { TypographyVariant } from "@/src/theme/tokens";

import AppText from "./AppText";

type Props = TextInputProps & {
  label?: string;
  /** `field` is a bordered input; `plain` is a bare writing surface. */
  variant?: "field" | "plain";
  textVariant?: TypographyVariant;
  invalid?: boolean;
};

export default function Input({
  label,
  variant = "field",
  textVariant = "body",
  invalid = false,
  style,
  onFocus,
  onBlur,
  ...rest
}: Props) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  // Border color can't be driven natively, so focus is plain state — it changes
  // once per interaction, which is not a render cost worth optimising.
  const borderColor = invalid
    ? theme.colors.danger
    : focused
      ? theme.colors.borderStrong
      : theme.colors.border;

  return (
    <View style={styles.wrapper}>
      {label && (
        <AppText variant="caption" tone="secondary">
          {label}
        </AppText>
      )}

      <TextInput
        placeholderTextColor={theme.colors.textTertiary}
        // Android draws its own selection tint; align it with the accent.
        selectionColor={theme.colors.accent}
        cursorColor={theme.colors.accent}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          theme.typography[textVariant],
          { color: theme.colors.textPrimary },
          variant === "field" && {
            backgroundColor: theme.colors.surface,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor,
            borderRadius: theme.radius.lg,
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.md,
          },
          style,
        ]}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
});
