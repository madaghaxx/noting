import { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";

import { useTheme } from "@/src/theme";

type Props = {
  size?: number;
  color?: string;
};

/**
 * An open ring that spins.
 *
 * Preferred over `ActivityIndicator` because it inherits the accent color and
 * stroke weight of everything around it — the platform spinner always looks
 * borrowed from another app.
 */
export default function Spinner({ size = 20, color }: Props) {
  const theme = useTheme();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 780,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    animation.start();

    return () => animation.stop();
  }, [progress]);

  const rotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <Animated.View
      accessibilityRole="progressbar"
      style={{
        width: size,
        height: size,
        borderRadius: size,
        borderWidth: Math.max(2, size * 0.11),
        borderColor: color ?? theme.colors.accent,
        // The gap is what makes rotation legible on a circle.
        borderTopColor: "transparent",
        transform: [{ rotate }],
      }}
    />
  );
}
