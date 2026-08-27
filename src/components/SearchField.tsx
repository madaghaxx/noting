import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import Icon from "@/src/components/ui/Icon";
import { useTheme } from "@/src/theme";
import { motion, TOUCH_TARGET } from "@/src/theme/tokens";

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** Closes the field. Called when the clear button is pressed on empty text. */
  onClose: () => void;
  placeholder?: string;
  /** Announced to screen readers as results change. */
  resultLabel?: string;
};

/**
 * The notes list's search field.
 *
 * Appears in place of the header rather than above it: the header's title and the
 * search field answer the same question ("what am I looking at"), and stacking
 * both would push the list down every time someone searched.
 *
 * Filtering happens on every keystroke with no debounce, which is a deliberate
 * consequence of searching in memory — there is no request to throttle, and a
 * delay would only make an instant thing feel slower.
 */
export default function SearchField({
  value,
  onChange,
  onClose,
  placeholder = "Search notes",
  resultLabel,
}: Props) {
  const theme = useTheme();
  const input = useRef<TextInput>(null);
  const presence = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(presence, {
      toValue: 1,
      duration: motion.fast,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

    // Focused on mount rather than with `autoFocus`, which on Android can fire
    // before the field has been laid out and leave the keyboard closed.
    const timer = setTimeout(() => input.current?.focus(), 60);

    return () => clearTimeout(timer);
  }, [presence]);

  return (
    <Animated.View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.sm,
        paddingHorizontal: theme.spacing.xl,
        paddingTop: theme.spacing.xs,
        paddingBottom: theme.spacing.lg,
        opacity: presence,
        transform: [
          {
            translateY: presence.interpolate({
              inputRange: [0, 1],
              outputRange: [-8, 0],
            }),
          },
        ],
      }}
    >
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          gap: theme.spacing.sm,
          height: 46,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
        }}
      >
        <Icon name="search" size={18} color={theme.colors.textTertiary} />

        <TextInput
          ref={input}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textTertiary}
          selectionColor={theme.colors.accent}
          cursorColor={theme.colors.accent}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          // The field is the label; a screen reader reads the count instead of
          // repeating the placeholder back.
          accessibilityLabel={resultLabel ?? placeholder}
          style={[
            theme.typography.body,
            { flex: 1, color: theme.colors.textPrimary, padding: 0 },
          ]}
        />

        {value.length > 0 && (
          <Pressable
            onPress={() => onChange("")}
            hitSlop={theme.spacing.sm}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Icon name="close" size={15} color={theme.colors.textTertiary} />
          </Pressable>
        )}
      </View>

      <Pressable
        onPress={onClose}
        hitSlop={theme.spacing.xs}
        accessibilityRole="button"
        accessibilityLabel="Close search"
        style={({ pressed }) => ({
          minHeight: TOUCH_TARGET - theme.spacing.md,
          justifyContent: "center",
          paddingHorizontal: theme.spacing.xs,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Animated.Text
          style={[
            theme.typography.label,
            { color: theme.colors.accent },
          ]}
        >
          Done
        </Animated.Text>
      </Pressable>
    </Animated.View>
  );
}
