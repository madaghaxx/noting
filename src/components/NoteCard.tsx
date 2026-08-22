import { memo, useEffect, useRef } from "react";
import { Animated, Easing, Pressable, View } from "react-native";

import Card from "@/src/components/ui/Card";
import AppText from "@/src/components/ui/AppText";
import Icon from "@/src/components/ui/Icon";
import { toPlainText } from "@/src/markdown/plain";
import { useTheme } from "@/src/theme";
import { motion, TOUCH_TARGET } from "@/src/theme/tokens";
import type { Note } from "@/src/types/note";
import { formatRelativeTime } from "@/src/utils/format";

type Props = {
  note: Note;
  /** Plays the removal animation; the row is dropped from state once it ends. */
  exiting?: boolean;
  onPress: (note: Note) => void;
  onTogglePin: (note: Note) => void;
  onLongPress: (note: Note) => void;
};

function NoteCard({
  note,
  exiting = false,
  onPress,
  onTogglePin,
  onLongPress,
}: Props) {
  const theme = useTheme();
  const presence = useRef(new Animated.Value(0)).current;
  const pinScale = useRef(new Animated.Value(1)).current;
  const wasPinned = useRef(note.isPinned);

  useEffect(() => {
    Animated.timing(presence, {
      toValue: exiting ? 0 : 1,
      duration: exiting ? 180 : motion.fast,
      easing: exiting ? Easing.in(Easing.quad) : Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [exiting, presence]);

  /**
   * Pinning moves the row to the other section, so the pin itself needs to
   * acknowledge the tap before the list re-sorts under the finger.
   *
   * Gated on an actual change rather than on `isPinned` alone: every card
   * re-renders when any note changes, and without the guard the whole list would
   * pulse on first paint.
   */
  useEffect(() => {
    if (wasPinned.current === note.isPinned) return;

    wasPinned.current = note.isPinned;

    Animated.sequence([
      Animated.timing(pinScale, {
        toValue: 1.3,
        duration: motion.instant,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(pinScale, {
        toValue: 1,
        useNativeDriver: true,
        ...theme.springs.settle,
      }),
    ]).start();
  }, [note.isPinned, pinScale, theme.springs.settle]);

  // Through the Markdown parser rather than a regex: what the card shows is then
  // exactly the words the rendered note shows, minus the syntax.
  const preview = toPlainText(note.content);
  const hasTitle = note.title.length > 0;

  return (
    <Animated.View
      style={{
        opacity: presence,
        transform: [
          {
            scale: presence.interpolate({
              inputRange: [0, 1],
              outputRange: [0.96, 1],
            }),
          },
        ],
      }}
    >
      <Card
        onPress={() => onPress(note)}
        onLongPress={() => onLongPress(note)}
        accessibilityLabel={hasTitle ? note.title : "Untitled note"}
        accessibilityHint="Opens the note. Long press to delete."
        padded={false}
        style={{ flexDirection: "row", alignItems: "flex-start" }}
      >
        <View
          style={{
            flex: 1,
            paddingLeft: theme.spacing.lg,
            paddingVertical: theme.spacing.lg,
            gap: theme.spacing.xs,
          }}
        >
          <AppText
            variant="subtitle"
            tone={hasTitle ? "primary" : "tertiary"}
            numberOfLines={1}
          >
            {hasTitle ? note.title : "Untitled"}
          </AppText>

          {preview.length > 0 && (
            <AppText variant="body" tone="secondary" numberOfLines={2}>
              {preview}
            </AppText>
          )}

          <AppText
            variant="caption"
            tone="tertiary"
            style={{ marginTop: theme.spacing.xxs }}
          >
            {formatRelativeTime(note.updatedAt)}
          </AppText>
        </View>

        {/* Nested pressable: tapping the pin must not open the note. */}
        <Pressable
          onPress={() => onTogglePin(note)}
          hitSlop={theme.spacing.xs}
          accessibilityRole="button"
          accessibilityState={{ selected: note.isPinned }}
          accessibilityLabel={note.isPinned ? "Unpin note" : "Pin note"}
          accessibilityHint={
            note.isPinned
              ? "Moves the note back in with the unpinned notes."
              : "Keeps the note above the unpinned notes."
          }
          style={{
            width: TOUCH_TARGET,
            height: TOUCH_TARGET,
            alignItems: "center",
            justifyContent: "center",
            marginTop: theme.spacing.xs,
            marginRight: theme.spacing.xs,
          }}
        >
          <Animated.View style={{ transform: [{ scale: pinScale }] }}>
            <Icon
              name="pin"
              size={20}
              filled={note.isPinned}
              color={
                note.isPinned ? theme.colors.pin : theme.colors.textTertiary
              }
            />
          </Animated.View>
        </Pressable>
      </Card>
    </Animated.View>
  );
}

/**
 * Memoised: the list re-renders whenever any note changes, and pinning one row
 * should not repaint the rest.
 */
export default memo(NoteCard);
