import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Animated, FlatList, Pressable, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import NoteCard from "@/src/components/NoteCard";
import ScreenHeader from "@/src/components/ScreenHeader";
import SwipeableRow from "@/src/components/SwipeableRow";
import UndoToast from "@/src/components/UndoToast";
import AppText from "@/src/components/ui/AppText";
import Icon from "@/src/components/ui/Icon";
import Screen from "@/src/components/ui/Screen";
import Spinner from "@/src/components/ui/Spinner";
import StateView from "@/src/components/ui/StateView";
import { useStaggeredEntrance } from "@/src/hooks/use-entrance";
import { lockEverything } from "@/src/store/lock";
import { useNotesStore } from "@/src/store/notes-store";
import { useSidebarStore } from "@/src/store/sidebar-store";
import { useTheme, type Theme } from "@/src/theme";
import { TOUCH_TARGET, type SpringConfig } from "@/src/theme/tokens";
import type { Note } from "@/src/types/note";
import { greeting } from "@/src/utils/format";

/** How long the card's exit animation needs before the row can leave the list. */
const EXIT_DURATION = 190;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function NewNoteButton({
  theme,
  onPress,
}: {
  theme: Theme;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const animate = (toValue: number, spring: SpringConfig) =>
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

type Props = {
  /**
   * Shows only pinned notes. The Pinned destination is the same list with a
   * different question asked of it, so it is the same screen.
   */
  onlyPinned?: boolean;
};

export default function NotesScreen({ onlyPinned = false }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const notes = useNotesStore((state) => state.notes);
  const status = useNotesStore((state) => state.status);
  const error = useNotesStore((state) => state.error);
  const load = useNotesStore((state) => state.load);
  const remove = useNotesStore((state) => state.remove);
  const togglePin = useNotesStore((state) => state.togglePin);
  const clearError = useNotesStore((state) => state.clearError);

  const openSidebar = useSidebarStore((state) => state.open);

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

  const handleTogglePin = useCallback(
    (note: Note) => togglePin(note.id),
    [togglePin],
  );

  /**
   * The swipe has already committed by the time this runs — it is a deliberate,
   * armed gesture, and the note is recoverable from Recently Deleted either way,
   * so interrupting it with a dialog would be the wrong kind of caution.
   */
  const handleSwipeDelete = useCallback(
    (note: Note) => remove(note.id),
    [remove],
  );

  /**
   * Long press is the same destination by a less deliberate route — and the only
   * one available to a screen reader, which cannot swipe. That asymmetry is why
   * this one asks first.
   */
  const handleLongPress = useCallback(
    (note: Note) => {
      const label = note.title.trim();

      Alert.alert(
        "Move to Recently Deleted?",
        label
          ? `“${label}” will be kept in Recently Deleted until you remove it.`
          : "This note will be kept in Recently Deleted until you remove it.",
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

  const handleLock = useCallback(() => lockEverything(), []);

  const pinnedCount = notes.filter((note) => note.isPinned).length;
  const visible = onlyPinned ? notes.filter((note) => note.isPinned) : notes;

  const subtitle = onlyPinned
    ? pinnedCount === 0
      ? "Nothing pinned"
      : `${pinnedCount} ${pinnedCount === 1 ? "note" : "notes"} kept on top`
    : notes.length === 0
      ? "Nothing written yet"
      : [
          `${notes.length} ${notes.length === 1 ? "note" : "notes"}`,
          pinnedCount > 0 ? `${pinnedCount} pinned` : null,
        ]
          .filter(Boolean)
          .join("  ·  ");

  const isFirstLoad = status === "loading" && notes.length === 0;
  const failedOutright = status === "error" && notes.length === 0;

  return (
    <Screen>
      <Animated.View style={entrance[0]}>
        <ScreenHeader
          title={onlyPinned ? "Pinned" : greeting()}
          subtitle={subtitle}
          leading={{
            icon: "menu",
            onPress: openSidebar,
            label: "Open navigation",
          }}
        >
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
        </ScreenHeader>
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
        ) : visible.length === 0 ? (
          onlyPinned ? (
            <StateView
              icon="pin"
              title="Nothing pinned yet"
              body="Pin a note to keep it above everything else, however long the list gets."
              action={{
                label: "Go to All Notes",
                onPress: () => router.navigate("/"),
              }}
            />
          ) : (
            <StateView
              icon="notes"
              title="Your notebook is empty"
              body="Everything you write stays on this device, behind your lock."
            />
          )
        ) : (
          <FlatList
            data={visible}
            keyExtractor={(note) => note.id}
            renderItem={({ item }) => (
              <SwipeableRow
                label="Delete"
                onAction={() => handleSwipeDelete(item)}
              >
                <NoteCard
                  note={item}
                  exiting={item.id === exitingId}
                  onPress={handleOpen}
                  onTogglePin={handleTogglePin}
                  onLongPress={handleLongPress}
                />
              </SwipeableRow>
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

      {/* Creating from the Pinned list would drop the new note into a list it is
          not part of, so the action lives where its result is visible. */}
      {!onlyPinned && (
        <NewNoteButton
          theme={theme}
          onPress={() =>
            router.push({ pathname: "/note/[id]", params: { id: "new" } })
          }
        />
      )}

      <UndoToast bottomInset={insets.bottom} />
    </Screen>
  );
}
