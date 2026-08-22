import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";

import AppText from "@/src/components/ui/AppText";
import Icon from "@/src/components/ui/Icon";
import { useNotesStore } from "@/src/store/notes-store";
import { useTheme } from "@/src/theme";
import { motion, TOUCH_TARGET } from "@/src/theme/tokens";

/**
 * How long undo stays available.
 *
 * Generous on purpose: the note is in Recently Deleted either way, so this window
 * is a convenience rather than the last chance it would be if deleting were final.
 */
const WINDOW = 6000;

/**
 * Confirms a note was moved to Recently Deleted, and offers to take it back.
 *
 * Rendered once per screen that can delete, above the content. It reads its state
 * from the store rather than taking props, so a delete triggered from a swipe, a
 * long press or the editor all surface the same way.
 */
export default function UndoToast({ bottomInset = 0 }: { bottomInset?: number }) {
  const theme = useTheme();

  const pending = useNotesStore((state) => state.pendingDeletion);
  const undoRemove = useNotesStore((state) => state.undoRemove);
  const dismissDeletion = useNotesStore((state) => state.dismissDeletion);

  const presence = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(presence, {
      toValue: pending ? 1 : 0,
      duration: pending ? motion.base : motion.fast,
      easing: pending ? Easing.out(Easing.back(1.4)) : Easing.in(Easing.quad),
      useNativeDriver: true,
    });

    animation.start();

    return () => animation.stop();
  }, [pending, presence]);

  // The window is per deletion: deleting a second note restarts it rather than
  // inheriting the first one's remaining time.
  useEffect(() => {
    if (!pending) return;

    const timer = setTimeout(dismissDeletion, WINDOW);

    return () => clearTimeout(timer);
  }, [pending, dismissDeletion]);

  if (!pending) return null;

  const title = pending.note.title.trim();

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: theme.spacing.lg,
        right: theme.spacing.lg,
        bottom: bottomInset + theme.spacing.lg,
        opacity: presence,
        transform: [
          {
            translateY: presence.interpolate({
              inputRange: [0, 1],
              outputRange: [24, 0],
            }),
          },
        ],
      }}
    >
      <View
        style={[
          {
            flexDirection: "row",
            alignItems: "center",
            gap: theme.spacing.md,
            paddingLeft: theme.spacing.lg,
            paddingRight: theme.spacing.xs,
            paddingVertical: theme.spacing.xs,
            borderRadius: theme.radius.lg,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.surfaceRaised,
          },
          theme.elevation(3),
        ]}
      >
        <Icon name="trash" size={17} color={theme.colors.textTertiary} />

        <AppText
          variant="caption"
          tone="secondary"
          numberOfLines={1}
          style={{ flex: 1 }}
        >
          {title ? `“${title}” deleted` : "Note deleted"}
        </AppText>

        <Pressable
          onPress={undoRemove}
          accessibilityRole="button"
          accessibilityLabel="Undo delete"
          style={({ pressed }) => ({
            minHeight: TOUCH_TARGET - theme.spacing.md,
            paddingHorizontal: theme.spacing.lg,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: theme.radius.md,
            backgroundColor: pressed ? theme.colors.accentSubtle : "transparent",
          })}
        >
          <AppText variant="label" tone="accent">
            Undo
          </AppText>
        </Pressable>
      </View>
    </Animated.View>
  );
}
