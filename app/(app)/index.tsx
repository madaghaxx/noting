import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Animated, FlatList, Pressable, View } from "react-native";
import { router } from "expo-router";

import NoteCard from "@/src/components/NoteCard";
import AppText from "@/src/components/ui/AppText";
import Icon from "@/src/components/ui/Icon";
import Screen from "@/src/components/ui/Screen";
import Spinner from "@/src/components/ui/Spinner";
import StateView from "@/src/components/ui/StateView";
import { useStaggeredEntrance } from "@/src/hooks/use-entrance";
import { useAuthStore } from "@/src/store/auth-store";
import { useNotesStore } from "@/src/store/notes-store";
import { useTheme, type Theme } from "@/src/theme";
import { TOUCH_TARGET } from "@/src/theme/tokens";
import type { Note } from "@/src/types/note";
import { greeting } from "@/src/utils/format";

/** How long the card's exit animation needs before the row can leave the list. */
const EXIT_DURATION = 190;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function NewNoteButton({ theme, onPress }: { theme: Theme; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;

  const animate = (toValue: number, spring: typeof theme.springs.press) =>
    Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      ...spring,
    }).start();

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => animate(0.96, theme.springs.press)}
      onPressOut={() => animate(1, theme.springs.settle)}
      accessibilityRole="button"
      accessibilityLabel="New note"
      style={[
        {
          position: "absolute",
          right: theme.spacing.xl,
          bottom: theme.spacing.xl,
          flexDirection: "row",
          alignItems: "center",
          gap: theme.spacing.sm,
          height: 54,
          paddingHorizontal: theme.spacing.xl,
          borderRadius: theme.radius.lg,
          backgroundColor: theme.colors.accent,
          transform: [{ scale }],
        },
        theme.elevation(3),
      ]}
    >
      <Icon name="plus" size={19} color={theme.colors.onAccent} />

      <AppText variant="label" style={{ color: theme.colors.onAccent }}>
        New note
      </AppText>
    </AnimatedPressable>
  );
}

export default function NotesScreen() {
  const theme = useTheme();

  const notes = useNotesStore((state) => state.notes);
  const status = useNotesStore((state) => state.status);
  const error = useNotesStore((state) => state.error);
  const load = useNotesStore((state) => state.load);
  const remove = useNotesStore((state) => state.remove);
  const toggleFavorite = useNotesStore((state) => state.toggleFavorite);
  const clearError = useNotesStore((state) => state.clearError);
  const resetNotes = useNotesStore((state) => state.reset);

  const lock = useAuthStore((state) => state.lock);

  const [exitingId, setExitingId] = useState<string | null>(null);
  const entrance = useStaggeredEntrance(2);

  // The guard unmounts this group on lock, so this runs again on every unlock —
  // which is what refills the list that `reset()` emptied.
  useEffect(() => {
    load();
  }, [load]);

  const handleOpen = useCallback((note: Note) => {
    router.push({ pathname: "/note/[id]", params: { id: note.id } });
  }, []);

  const handleToggleFavorite = useCallback(
    (note: Note) => toggleFavorite(note.id),
    [toggleFavorite],
  );

  const handleDelete = useCallback(
    (note: Note) => {
      const label = note.title.trim();

      Alert.alert(
        "Delete note?",
        label
          ? `“${label}” will be permanently deleted.`
          : "This note will be permanently deleted.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => {
              // Mark it exiting, then drop it once the animation has played.
              // Removing immediately would make the row vanish mid-fade.
              setExitingId(note.id);

              setTimeout(() => {
                remove(note.id);
                setExitingId(null);
              }, EXIT_DURATION);
            },
          },
        ],
      );
    },
    [remove],
  );

  const handleLock = useCallback(() => {
    // Clear note contents from memory before the unlock screen appears.
    resetNotes();
    lock();
  }, [resetNotes, lock]);

  const favourites = notes.filter((note) => note.isFavorite).length;

  const subtitle =
    notes.length === 0
      ? "Nothing written yet"
      : [
          `${notes.length} ${notes.length === 1 ? "note" : "notes"}`,
          favourites > 0 ? `${favourites} favourite` : null,
        ]
          .filter(Boolean)
          .join("  ·  ");

  const isFirstLoad = status === "loading" && notes.length === 0;
  const failedOutright = status === "error" && notes.length === 0;

  return (
    <Screen>
      <Animated.View
        style={[
          entrance[0],
          {
            flexDirection: "row",
            alignItems: "flex-start",
            justifyContent: "space-between",
            paddingHorizontal: theme.spacing.xl,
            paddingTop: theme.spacing.md,
            paddingBottom: theme.spacing.lg,
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          <AppText variant="title">{greeting()}</AppText>

          <AppText
            variant="body"
            tone="tertiary"
            style={{ marginTop: theme.spacing.xxs }}
          >
            {subtitle}
          </AppText>
        </View>

        <Pressable
          onPress={handleLock}
          hitSlop={theme.spacing.sm}
          accessibilityRole="button"
          accessibilityLabel="Lock Noting"
          style={{
            width: TOUCH_TARGET,
            height: TOUCH_TARGET,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: theme.radius.full,
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.border,
          }}
        >
          <Icon name="lock" size={19} color={theme.colors.textSecondary} />
        </Pressable>
      </Animated.View>

      {/* A write failed while notes are still on screen. Surfaced without
          discarding the list the user can still read. */}
      {error && notes.length > 0 && (
        <Pressable
          onPress={clearError}
          accessibilityRole="button"
          accessibilityLabel="Dismiss error"
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: theme.spacing.md,
            marginHorizontal: theme.spacing.xl,
            marginBottom: theme.spacing.md,
            padding: theme.spacing.md,
            borderRadius: theme.radius.lg,
            backgroundColor: theme.colors.dangerSubtle,
          }}
        >
          <Icon name="alert" size={18} color={theme.colors.danger} />

          <AppText
            variant="caption"
            tone="danger"
            numberOfLines={2}
            style={{ flex: 1 }}
          >
            {error}
          </AppText>
        </Pressable>
      )}

      <Animated.View style={[entrance[1], { flex: 1 }]}>
        {isFirstLoad ? (
          <View
            style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
          >
            <Spinner size={24} />
          </View>
        ) : failedOutright ? (
          <StateView
            icon="alert"
            tone="danger"
            title="Could not open your notes"
            body={error ?? undefined}
            action={{ label: "Try again", onPress: load }}
          />
        ) : notes.length === 0 ? (
          <StateView
            icon="lock"
            title="Your notebook is empty"
            body="Everything you write stays on this device, behind your fingerprint."
          />
        ) : (
          <FlatList
            data={notes}
            keyExtractor={(note) => note.id}
            renderItem={({ item }) => (
              <NoteCard
                note={item}
                exiting={item.id === exitingId}
                onPress={handleOpen}
                onToggleFavorite={handleToggleFavorite}
                onLongPress={handleDelete}
              />
            )}
            ItemSeparatorComponent={() => (
              <View style={{ height: theme.spacing.md }} />
            )}
            contentContainerStyle={{
              paddingHorizontal: theme.spacing.xl,
              paddingTop: theme.spacing.xs,
              // Clears the New note button so the last card stays reachable.
              paddingBottom: theme.spacing.huge + theme.spacing.xxl,
            }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </Animated.View>

      <NewNoteButton
        theme={theme}
        onPress={() =>
          router.push({ pathname: "/note/[id]", params: { id: "new" } })
        }
      />
    </Screen>
  );
}
