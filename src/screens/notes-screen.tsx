import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, BackHandler, Pressable, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ErrorBanner from "@/src/components/ErrorBanner";
import NoteList, { type NoteRow } from "@/src/components/NoteList";
import ScreenHeader from "@/src/components/ScreenHeader";
import SearchField from "@/src/components/SearchField";
import UndoToast from "@/src/components/UndoToast";
import AppText from "@/src/components/ui/AppText";
import Icon from "@/src/components/ui/Icon";
import Screen from "@/src/components/ui/Screen";
import Spinner from "@/src/components/ui/Spinner";
import StateView from "@/src/components/ui/StateView";
import { useStaggeredEntrance } from "@/src/hooks/use-entrance";
import { toPlainText } from "@/src/markdown/plain";
import { lockEverything } from "@/src/store/lock";
import { useNotesStore } from "@/src/store/notes-store";
import { useSidebarStore } from "@/src/store/sidebar-store";
import { useTheme, type Theme } from "@/src/theme";
import { TOUCH_TARGET, type SpringConfig } from "@/src/theme/tokens";
import type { Note } from "@/src/types/note";
import { greeting } from "@/src/utils/format";
import { filterNotes } from "@/src/utils/search";

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
  const reorder = useNotesStore((state) => state.reorder);
  const clearError = useNotesStore((state) => state.clearError);

  // Lives in the store rather than in this component: it is shared by two routes,
  // and it has to be cleared on lock along with everything else about the notes.
  const query = useNotesStore((state) => state.query);
  const setQuery = useNotesStore((state) => state.setQuery);

  const openSidebar = useSidebarStore((state) => state.open);

  const [searchOpen, setSearchOpen] = useState(false);
  const entrance = useStaggeredEntrance(2);

  // The guard unmounts this group on lock, so this runs again on every unlock —
  // which is what refills the list that `reset()` emptied.
  useEffect(() => {
    load();
  }, [load]);

  // Switching between All Notes and Pinned starts a fresh question. Carrying a
  // term across would make the other list look mysteriously short.
  useEffect(() => {
    setSearchOpen(false);
    setQuery("");
  }, [onlyPinned, setQuery]);

  // Back closes the search rather than leaving the notebook: the field is a mode
  // within this screen, and backing out of a mode is what Back means here.
  useEffect(() => {
    if (!searchOpen) return;

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        setQuery("");
        setSearchOpen(false);
        return true;
      },
    );

    return () => subscription.remove();
  }, [searchOpen, setQuery]);

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
   * so interrupting it with a dialog would be the wrong kind of caution. The undo
   * toast is what covers the mistake.
   */
  const handleDelete = useCallback(
    (note: Note) => remove(note.id),
    [remove],
  );

  const handleReorder = useCallback(
    (from: number, to: number) => reorder(from, to),
    [reorder],
  );

  const handleLock = useCallback(() => lockEverything(), []);

  const pinnedCount = notes.filter((note) => note.isPinned).length;

  /**
   * Every note with its Markdown stripped, rebuilt only when the notes change.
   *
   * Search runs over this rather than over the raw body, so it finds what the list
   * *shows*: a note written as `b**old**` should answer to "bold", and should not
   * answer to "b**old**". Doing it here also means the whole notebook is parsed
   * once per change rather than once per row per keystroke.
   */
  const rows = useMemo<NoteRow[]>(
    () =>
      notes.map((note) => ({
        note,
        title: note.title,
        content: toPlainText(note.content),
      })),
    [notes],
  );

  const visible = useMemo(() => {
    const scoped = onlyPinned ? rows.filter((row) => row.note.isPinned) : rows;

    return filterNotes(scoped, query);
  }, [rows, onlyPinned, query]);

  const searching = query.trim().length > 0;
  const scopedTotal = onlyPinned ? pinnedCount : notes.length;

  const subtitle = searching
    ? `${visible.length} of ${scopedTotal} ${scopedTotal === 1 ? "note" : "notes"}`
    : onlyPinned
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

  const closeSearch = useCallback(() => {
    setQuery("");
    setSearchOpen(false);
  }, [setQuery]);

  return (
    <Screen>
      <Animated.View style={entrance[0]}>
        {searchOpen ? (
          <SearchField
            value={query}
            onChange={setQuery}
            onClose={closeSearch}
            placeholder={onlyPinned ? "Search pinned notes" : "Search notes"}
            resultLabel={searching ? subtitle : undefined}
          />
        ) : (
          <ScreenHeader
            title={onlyPinned ? "Pinned" : greeting()}
            subtitle={subtitle}
            leading={{ onPress: openSidebar, label: "Open navigation" }}
          >
            {/* Hidden when there is nothing to search: an empty notebook does not
                need a magnifying glass. */}
            {scopedTotal > 0 && (
              <Pressable
                onPress={() => setSearchOpen(true)}
                hitSlop={theme.spacing.sm}
                accessibilityRole="button"
                accessibilityLabel="Search notes"
                style={{
                  width: TOUCH_TARGET,
                  height: TOUCH_TARGET,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: theme.radius.full,
                }}
              >
                <Icon
                  name="search"
                  size={19}
                  color={theme.colors.textSecondary}
                />
              </Pressable>
            )}

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
        )}
      </Animated.View>

      {/* A write failed while notes are still on screen. Surfaced without
          discarding the list the user can still read. */}
      {error && notes.length > 0 && (
        <ErrorBanner message={error} onDismiss={clearError} />
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
          searching ? (
            <StateView
              icon="search"
              title="No notes match"
              body={`Nothing here contains “${query.trim()}”.`}
              action={{ label: "Clear search", onPress: () => setQuery("") }}
            />
          ) : onlyPinned ? (
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
          <NoteList
            rows={visible}
            query={query}
            // A filtered list's indices are not the notebook's, so there is
            // nothing coherent for a drop to mean while searching.
            reorderable={!searching}
            onOpen={handleOpen}
            onTogglePin={handleTogglePin}
            onDelete={handleDelete}
            onReorder={handleReorder}
            // Clears the New note button so the last card stays reachable.
            paddingBottom={theme.spacing.huge + theme.spacing.xxl}
          />
        )}
      </Animated.View>

      {/* Creating from the Pinned list would drop the new note into a list it is
          not part of, so the action lives where its result is visible. And while
          searching, the keyboard is where the button would be. */}
      {!onlyPinned && !searchOpen && (
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
