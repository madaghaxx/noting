import { useCallback, useRef, type ReactNode } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";

import { useTheme } from "@/src/theme";
import type { SpringConfig } from "@/src/theme/tokens";

type Props = {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Sits on another surface rather than on the background. */
  raised?: boolean;
  padded?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
  accessibilityHint?: string;
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
  raised = false,
  padded = true,
  style,
  accessibilityLabel,
  accessibilityHint,
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
    backgroundColor: raised ? theme.colors.surfaceRaised : theme.colors.surface,
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
      onPressOut={() => animate(1, theme.springs.settle)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
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
