import { useCallback, useRef, type ReactNode } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type AccessibilityActionInfo,
  type ViewStyle,
} from "react-native";

import { useTheme } from "@/src/theme";
import type { SpringConfig } from "@/src/theme/tokens";

type Props = {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Fires when the finger comes off, including when the press is cancelled. */
  onPressOut?: () => void;
  padded?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityActions?: readonly AccessibilityActionInfo[];
  onAccessibilityAction?: (event: AccessibilityActionEvent) => void;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * The app's one container surface. Static when it has no `onPress`, tactile
 * when it does.
 */
export default function Card({
  children,
  onPress,
  onLongPress,
  onPressOut,
  padded = true,
  style,
  accessibilityLabel,
  accessibilityHint,
  accessibilityActions,
  onAccessibilityAction,
}: Props) {
  const theme = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const animate = useCallback(
    (toValue: number, spring: SpringConfig) => {
      Animated.spring(scale, {
        toValue,
        useNativeDriver: true,
        ...spring,
      }).start();
    },
    [scale],
  );

  const surface: ViewStyle = {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.xl,
    padding: padded ? theme.spacing.lg : 0,
  };

  if (!onPress && !onLongPress) {
    return (
      <View style={[styles.base, surface, theme.elevation(1), style]}>
        {children}
      </View>
    );
  }

  return (
    <AnimatedPressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => animate(0.985, theme.springs.press)}
      onPressOut={() => {
        animate(1, theme.springs.settle);
        onPressOut?.();
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityActions={
        accessibilityActions as AccessibilityActionInfo[] | undefined
      }
      onAccessibilityAction={onAccessibilityAction}
      style={[
        styles.base,
        surface,
        theme.elevation(1),
        { transform: [{ scale }] },
        style,
      ]}
    >
      {children}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
});
