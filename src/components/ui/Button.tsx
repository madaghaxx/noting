import { useCallback, useRef } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type ViewStyle,
} from "react-native";

import { useTheme } from "@/src/theme";
import { TOUCH_TARGET } from "@/src/theme/tokens";

import AppText from "./AppText";
import Icon, { type IconName } from "./Icon";
import Spinner from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

type Props = Omit<PressableProps, "style" | "children"> & {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function Button({
  label,
  variant = "primary",
  size = "md",
  icon,
  loading = false,
  fullWidth = false,
  disabled = false,
  style,
  ...rest
}: Props) {
  const theme = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const isInert = disabled || loading;

  const animate = useCallback(
    (toValue: number, spring: typeof theme.springs.press) => {
      Animated.spring(scale, {
        toValue,
        useNativeDriver: true,
        ...spring,
      }).start();
    },
    [scale],
  );

  const skins: Record<
    ButtonVariant,
    { background: string; foreground: string; border: string }
  > = {
    primary: {
      background: theme.colors.accent,
      foreground: theme.colors.onAccent,
      border: "transparent",
    },
    secondary: {
      background: theme.colors.surface,
      foreground: theme.colors.textPrimary,
      border: theme.colors.border,
    },
    ghost: {
      background: "transparent",
      foreground: theme.colors.textSecondary,
      border: "transparent",
    },
    danger: {
      background: theme.colors.dangerSubtle,
      foreground: theme.colors.danger,
      border: "transparent",
    },
  };

  const sizes = {
    sm: { height: 40, padding: theme.spacing.lg, radius: theme.radius.md },
    md: { height: 50, padding: theme.spacing.xl, radius: theme.radius.lg },
    lg: { height: 58, padding: theme.spacing.xxl, radius: theme.radius.lg },
  } as const;

  const skin = skins[variant];
  const metrics = sizes[size];

  return (
    <AnimatedPressable
      disabled={isInert}
      onPressIn={() => animate(0.97, theme.springs.press)}
      onPressOut={() => animate(1, theme.springs.settle)}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isInert, busy: loading }}
      style={[
        styles.base,
        {
          minHeight: Math.max(metrics.height, TOUCH_TARGET),
          paddingHorizontal: metrics.padding,
          borderRadius: metrics.radius,
          backgroundColor: skin.background,
          borderColor: skin.border,
          transform: [{ scale }],
        },
        fullWidth && styles.fullWidth,
        // Dimmed rather than restyled: a disabled button should read as the same
        // button, just unavailable.
        isInert && styles.inert,
        variant === "primary" && !isInert && theme.elevation(1),
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <Spinner size={18} color={skin.foreground} />
      ) : (
        <View style={[styles.content, { gap: theme.spacing.sm }]}>
          {icon && <Icon name={icon} size={19} color={skin.foreground} />}

          <AppText
            variant={size === "lg" ? "subtitle" : "label"}
            style={{ color: skin.foreground }}
          >
            {label}
          </AppText>
        </View>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
  },
  fullWidth: {
    alignSelf: "stretch",
  },
  inert: {
    opacity: 0.45,
  },
});
