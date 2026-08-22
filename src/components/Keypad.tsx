import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, View } from "react-native";

import AppText from "@/src/components/ui/AppText";
import Icon from "@/src/components/ui/Icon";
import Spinner from "@/src/components/ui/Spinner";
import { useTheme } from "@/src/theme";
import { haptics } from "@/src/utils/haptics";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  maxLength: number;
  minLength: number;
  /** Filled dots for the digits entered so far. */
  busy?: boolean;
  /** Shakes the dots and clears them; set when a code was rejected. */
  errorAt?: number | null;
  disabled?: boolean;
};

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"];

/**
 * A numeric keypad, rather than the system keyboard.
 *
 * The keyboard would work, but it hands the passcode to whatever keyboard app the
 * device happens to use, and it puts an autocorrect bar above a secret. A keypad
 * also lets the dots sit where they can be watched while typing, which is what
 * makes a passcode field feel trustworthy.
 */
export default function Keypad({
  value,
  onChange,
  onSubmit,
  maxLength,
  minLength,
  busy = false,
  errorAt = null,
  disabled = false,
}: Props) {
  const theme = useTheme();
  const shake = useRef(new Animated.Value(0)).current;

  // Keyed on the timestamp of the rejection, so two failures in a row both shake.
  useEffect(() => {
    if (errorAt === null) return;

    haptics.reject();

    Animated.sequence([
      Animated.timing(shake, {
        toValue: 1,
        duration: 60,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(shake, {
        toValue: -1,
        duration: 110,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(shake, {
        toValue: 0,
        duration: 90,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [errorAt, shake]);

  const press = (key: string) => {
    if (disabled || busy) return;

    if (key === "back") {
      haptics.detent();
      onChange(value.slice(0, -1));
      return;
    }

    if (value.length >= maxLength) return;

    const next = value + key;
    haptics.detent();
    onChange(next);

    // A fixed-length passcode submits itself at the last digit; a shorter one
    // waits for the confirm button, since there is no way to know it is finished.
    if (next.length === maxLength) onSubmit();
  };

  return (
    <View style={{ gap: theme.spacing.xxl, alignItems: "center" }}>
      <Animated.View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: theme.spacing.md,
          height: 24,
          transform: [
            {
              translateX: shake.interpolate({
                inputRange: [-1, 1],
                outputRange: [-9, 9],
              }),
            },
          ],
        }}
      >
        {busy ? (
          <Spinner size={20} />
        ) : (
          Array.from({ length: Math.max(minLength, value.length) }).map(
            (_, index) => {
              const filled = index < value.length;

              return (
                <View
                  key={index}
                  style={{
                    width: filled ? 12 : 10,
                    height: filled ? 12 : 10,
                    borderRadius: theme.radius.full,
                    backgroundColor: filled
                      ? theme.colors.accent
                      : "transparent",
                    borderWidth: filled ? 0 : 1.5,
                    borderColor: theme.colors.borderStrong,
                  }}
                />
              );
            },
          )
        )}
      </Animated.View>

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "center",
          width: 264,
          gap: theme.spacing.md,
        }}
      >
        {KEYS.map((key, index) => {
          if (key === "") return <View key={index} style={{ width: 76 }} />;

          const isBackspace = key === "back";
          const inert = disabled || busy || (isBackspace && value.length === 0);

          return (
            <Pressable
              key={index}
              onPress={() => press(key)}
              disabled={inert}
              accessibilityRole="button"
              accessibilityLabel={isBackspace ? "Delete" : key}
              style={({ pressed }) => ({
                width: 76,
                height: 62,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: theme.radius.lg,
                opacity: inert ? 0.35 : 1,
                backgroundColor: pressed
                  ? theme.colors.surfacePressed
                  : isBackspace
                    ? "transparent"
                    : theme.colors.surface,
                borderWidth: isBackspace ? 0 : 1,
                borderColor: theme.colors.border,
              })}
            >
              {isBackspace ? (
                <Icon
                  name="chevronLeft"
                  size={22}
                  color={theme.colors.textSecondary}
                />
              ) : (
                <AppText variant="heading" tone="primary">
                  {key}
                </AppText>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
