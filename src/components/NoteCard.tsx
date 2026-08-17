import { memo, useEffect, useRef } from "react";
import { Animated, Easing, Pressable, View } from "react-native";

import Card from "@/src/components/ui/Card";
import AppText from "@/src/components/ui/AppText";
import Icon from "@/src/components/ui/Icon";
import { useTheme } from "@/src/theme";
import { motion, TOUCH_TARGET } from "@/src/theme/tokens";
import type { Note } from "@/src/types/note";
import { formatRelativeTime, toPreview } from "@/src/utils/format";

type Props = {
  note: Note;
  /** Plays the removal animation; the row is dropped from state once it ends. */
  exiting?: boolean;
  onPress: (note: Note) => void;
  onToggleFavorite: (note: Note) => void;
  onLongPress: (note: Note) => void;
};

function NoteCard({
  note,
  exiting = false,
  onPress,
  onToggleFavorite,
  onLongPress,
}: Props) {
  const theme = useTheme();
  const presence = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(presence, {
      toValue: exiting ? 0 : 1,
      duration: exiting ? 180 : motion.fast,
      easing: exiting ? Easing.in(Easing.quad) : Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [exiting, presence]);

  const preview = toPreview(note.content);
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

        {/* Nested pressable: tapping the star must not open the note. */}
        <Pressable
          onPress={() => onToggleFavorite(note)}
          hitSlop={theme.spacing.xs}
          accessibilityRole="button"
          accessibilityState={{ selected: note.isFavorite }}
          accessibilityLabel={
            note.isFavorite ? "Remove from favourites" : "Add to favourites"
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
          <Icon
            name="star"
            size={20}
            filled={note.isFavorite}
            color={
              note.isFavorite
                ? theme.colors.favorite
                : theme.colors.textTertiary
            }
          />
        </Pressable>
      </Card>
    </Animated.View>
  );
}

/**
 * Memoised: the list re-renders whenever any note changes, and starring one row
 * should not repaint the rest.
 */
export default memo(NoteCard);
