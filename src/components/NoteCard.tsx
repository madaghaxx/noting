import { memo, useEffect, useRef } from "react";
import { Animated, Easing, Pressable, View } from "react-native";

import HighlightedText from "@/src/components/HighlightedText";
import AppText from "@/src/components/ui/AppText";
import Card from "@/src/components/ui/Card";
import Icon from "@/src/components/ui/Icon";
import { toPlainText } from "@/src/markdown/plain";
import { useTheme } from "@/src/theme";
import { motion, TOUCH_TARGET } from "@/src/theme/tokens";
import type { Note } from "@/src/types/note";
import { formatRelativeTime } from "@/src/utils/format";
import { previewAround } from "@/src/utils/search";

type Props = {
  note: Note;
  /**
   * The note's body with Markdown stripped.
   *
   * Passed in when the caller already has it — the notes list strips every note
   * once to search over, and stripping it again per row would parse the whole
   * notebook twice on every keystroke.
   */
  preview?: string;
  /** Emphasised in the title and preview, and used to keep a late match visible. */
  query?: string;
  /** True while this card is being dragged, so it can read as picked up. */
  lifted?: boolean;
  onPress: (note: Note) => void;
  onTogglePin: (note: Note) => void;
  /** Picks the card up to reorder it. Omitted where reordering is meaningless. */
  onLift?: (note: Note) => void;
  /**
   * Moves the note one place within its section.
   *
   * The keyboard-and-screen-reader equivalent of the drag: a long press and a pan
   * are unavailable to someone using TalkBack or VoiceOver, and reordering is not
   * a feature they should simply be locked out of.
   */
  onMove?: (note: Note, direction: -1 | 1) => void;
  /** The finger came off the card, whether or not a drag happened. */
  onRelease?: () => void;
};

function NoteCard({
  note,
  preview: providedPreview,
  query = "",
  lifted = false,
  onPress,
  onTogglePin,
  onLift,
  onMove,
  onRelease,
}: Props) {
  const theme = useTheme();
  const presence = useRef(new Animated.Value(0)).current;
  const pinScale = useRef(new Animated.Value(1)).current;
  const wasPinned = useRef(note.isPinned);

  useEffect(() => {
    Animated.timing(presence, {
      toValue: 1,
      duration: motion.fast,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [presence]);

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
  const plain = providedPreview ?? toPlainText(note.content);

  // A match late in a long note would otherwise sit past the end of the preview,
  // making the row look like a false positive.
  const preview = previewAround(plain, query);
  const hasTitle = note.title.length > 0;

  const name = hasTitle ? note.title : "Untitled note";

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
        onLongPress={onLift ? () => onLift(note) : undefined}
        onPressOut={onRelease}
        accessibilityLabel={name}
        accessibilityHint={
          onLift
            ? "Opens the note. Long press to pick it up and reorder."
            : "Opens the note."
        }
        accessibilityActions={
          onMove
            ? [
                { name: "moveUp", label: "Move up" },
                { name: "moveDown", label: "Move down" },
              ]
            : undefined
        }
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === "moveUp") onMove?.(note, -1);
          if (event.nativeEvent.actionName === "moveDown") onMove?.(note, 1);
        }}
        padded={false}
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          // Picked up: brighter surface and a real shadow, so it reads as being
          // held above the list rather than as a selected row.
          ...(lifted
            ? {
                backgroundColor: theme.colors.surfaceRaised,
                borderColor: theme.colors.borderStrong,
              }
            : null),
        }}
      >
        <View
          style={{
            flex: 1,
            paddingLeft: theme.spacing.lg,
            paddingVertical: theme.spacing.lg,
            gap: theme.spacing.xs,
          }}
        >
          <HighlightedText
            text={hasTitle ? note.title : "Untitled"}
            query={hasTitle ? query : ""}
            variant="subtitle"
            tone={hasTitle ? "primary" : "tertiary"}
            numberOfLines={1}
          />

          {preview.length > 0 && (
            <HighlightedText
              text={preview}
              query={query}
              variant="body"
              tone="secondary"
              numberOfLines={2}
            />
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
