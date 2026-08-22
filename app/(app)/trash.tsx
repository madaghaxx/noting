import { useCallback, useEffect } from "react";
import { Alert, Animated, FlatList, Pressable, View } from "react-native";

import ScreenHeader from "@/src/components/ScreenHeader";
import SwipeableRow from "@/src/components/SwipeableRow";
import AppText from "@/src/components/ui/AppText";
import Card from "@/src/components/ui/Card";
import Icon from "@/src/components/ui/Icon";
import Screen from "@/src/components/ui/Screen";
import StateView from "@/src/components/ui/StateView";
import { useStaggeredEntrance } from "@/src/hooks/use-entrance";
import { useNotesStore } from "@/src/store/notes-store";
import { useSidebarStore } from "@/src/store/sidebar-store";
import { useTheme, type Theme } from "@/src/theme";
import { TOUCH_TARGET } from "@/src/theme/tokens";
import type { Note } from "@/src/types/note";
import { formatRelativeTime } from "@/src/utils/format";
import { toPlainText } from "@/src/markdown/plain";

function DeletedRow({
  note,
  theme,
  onRestore,
}: {
  note: Note;
  theme: Theme;
  onRestore: () => void;
}) {
  const preview = toPlainText(note.content);
  const hasTitle = note.title.length > 0;

  return (
    <Card padded={false} style={{ flexDirection: "row", alignItems: "center" }}>
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
          <AppText variant="body" tone="secondary" numberOfLines={1}>
            {preview}
          </AppText>
        )}

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: theme.spacing.xs,
            marginTop: theme.spacing.xxs,
          }}
        >
          <Icon name="trash" size={13} color={theme.colors.textTertiary} />

          <AppText variant="caption" tone="tertiary">
            {note.deletedAt === null
              ? "Deleted"
              : `Deleted ${formatRelativeTime(note.deletedAt)}`}
          </AppText>

          {note.isPinned && (
            <>
              <AppText variant="caption" tone="tertiary">
                ·
              </AppText>

              <Icon name="pin" size={12} filled color={theme.colors.pin} />

              <AppText variant="caption" tone="tertiary">
                was pinned
              </AppText>
            </>
          )}
        </View>
      </View>

      <Pressable
        onPress={onRestore}
        hitSlop={theme.spacing.xs}
        accessibilityRole="button"
        accessibilityLabel={`Restore ${hasTitle ? note.title : "untitled note"}`}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: theme.spacing.sm,
          minHeight: TOUCH_TARGET - theme.spacing.md,
          marginRight: theme.spacing.md,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radius.md,
          backgroundColor: pressed
            ? theme.colors.accentSubtle
            : theme.colors.surfaceSubtle,
        })}
      >
        <Icon name="restore" size={16} color={theme.colors.accent} />

        <AppText variant="caption" tone="accent">
          Restore
        </AppText>
      </Pressable>
    </Card>
  );
}

export default function TrashScreen() {
  const theme = useTheme();

  const deleted = useNotesStore((state) => state.deleted);
  const error = useNotesStore((state) => state.error);
  const loadDeleted = useNotesStore((state) => state.loadDeleted);
  const restore = useNotesStore((state) => state.restore);
  const purge = useNotesStore((state) => state.purge);
  const purgeAll = useNotesStore((state) => state.purgeAll);
  const clearError = useNotesStore((state) => state.clearError);

  const openSidebar = useSidebarStore((state) => state.open);
  const entrance = useStaggeredEntrance(2);

  useEffect(() => {
    loadDeleted();
  }, [loadDeleted]);

  /**
   * Both permanent actions confirm, and both name what is about to be lost.
   *
   * The swipe on these rows is reveal-only, so nothing here can be destroyed by a
   * gesture — reaching this dialog always takes a deliberate tap.
   */
  const confirmPurge = useCallback(
    (note: Note) => {
      const label = note.title.trim();

      Alert.alert(
        "Delete forever?",
        label
          ? `“${label}” will be gone for good. This cannot be undone.`
          : "This note will be gone for good. This cannot be undone.",
        [
          { text: "Keep", style: "cancel" },
          {
            text: "Delete forever",
            style: "destructive",
            onPress: () => purge(note.id),
          },
        ],
      );
    },
    [purge],
  );

  const confirmPurgeAll = useCallback(() => {
    Alert.alert(
      "Empty Recently Deleted?",
      `${deleted.length} ${deleted.length === 1 ? "note" : "notes"} will be gone for good. This cannot be undone.`,
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Delete all",
          style: "destructive",
          onPress: () => purgeAll(),
        },
      ],
    );
  }, [deleted.length, purgeAll]);

  return (
    <Screen>
      <Animated.View style={entrance[0]}>
        <ScreenHeader
          title="Recently Deleted"
          subtitle={
            deleted.length === 0
              ? "Nothing here"
              : `${deleted.length} ${deleted.length === 1 ? "note" : "notes"} recoverable`
          }
          leading={{
            icon: "menu",
            onPress: openSidebar,
            label: "Open navigation",
          }}
        >
          {deleted.length > 0 && (
            <Pressable
              onPress={confirmPurgeAll}
              hitSlop={theme.spacing.sm}
              accessibilityRole="button"
              accessibilityLabel="Empty Recently Deleted"
              style={({ pressed }) => ({
                minHeight: TOUCH_TARGET - theme.spacing.md,
                paddingHorizontal: theme.spacing.md,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: theme.radius.md,
                backgroundColor: pressed
                  ? theme.colors.dangerSubtle
                  : "transparent",
              })}
            >
              <AppText variant="caption" tone="danger">
                Empty
              </AppText>
            </Pressable>
          )}
        </ScreenHeader>
      </Animated.View>

      {error && (
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

          <AppText variant="caption" tone="danger" style={{ flex: 1 }}>
            {error}
          </AppText>
        </Pressable>
      )}

      <Animated.View style={[entrance[1], { flex: 1 }]}>
        {deleted.length === 0 ? (
          <StateView
            icon="trash"
            title="Nothing recently deleted"
            body="Notes you delete are kept here until you remove them, so a swipe is never the end of anything."
          />
        ) : (
          <>
            <View
              style={{
                flexDirection: "row",
                gap: theme.spacing.sm,
                marginHorizontal: theme.spacing.xl,
                marginBottom: theme.spacing.md,
                padding: theme.spacing.md,
                borderRadius: theme.radius.lg,
                backgroundColor: theme.colors.surfaceSubtle,
              }}
            >
              <Icon name="lock" size={15} color={theme.colors.textTertiary} />

              <AppText variant="caption" tone="tertiary" style={{ flex: 1 }}>
                Nothing here is deleted automatically. Notes stay until you empty
                this list.
              </AppText>
            </View>

            <FlatList
              data={deleted}
              keyExtractor={(note) => note.id}
              renderItem={({ item }) => (
                <SwipeableRow
                  label="Delete"
                  mode="reveal"
                  onAction={() => confirmPurge(item)}
                >
                  <DeletedRow
                    note={item}
                    theme={theme}
                    onRestore={() => restore(item.id)}
                  />
                </SwipeableRow>
              )}
              ItemSeparatorComponent={() => (
                <View style={{ height: theme.spacing.md }} />
              )}
              contentContainerStyle={{
                paddingHorizontal: theme.spacing.xl,
                paddingBottom: theme.spacing.xxxl,
              }}
              showsVerticalScrollIndicator={false}
            />
          </>
        )}
      </Animated.View>
    </Screen>
  );
}
