import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import AppText from "@/src/components/ui/AppText";
import Button from "@/src/components/ui/Button";
import Icon from "@/src/components/ui/Icon";
import Input from "@/src/components/ui/Input";
import Screen from "@/src/components/ui/Screen";
import StateView from "@/src/components/ui/StateView";
import { useNotesStore } from "@/src/store/notes-store";
import { useTheme } from "@/src/theme";
import { TOUCH_TARGET } from "@/src/theme/tokens";
import { formatRelativeTime } from "@/src/utils/format";

/** Sentinel id meaning "composing a note that doesn't exist yet". */
const NEW_NOTE = "new";

export default function NoteEditorScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === NEW_NOTE;

  const notes = useNotesStore((state) => state.notes);
  const status = useNotesStore((state) => state.status);
  const create = useNotesStore((state) => state.create);
  const update = useNotesStore((state) => state.update);
  const remove = useNotesStore((state) => state.remove);

  const existing = useMemo(
    () => (isNew ? undefined : notes.find((note) => note.id === id)),
    [isNew, notes, id],
  );

  const [title, setTitle] = useState(existing?.title ?? "");
  const [content, setContent] = useState(existing?.content ?? "");
  const [saving, setSaving] = useState(false);

  const hydrated = useRef(existing !== undefined);

  // Covers mounting before the store has loaded — a cold deep link, say.
  // Guarded so it can only ever fill empty fields, never overwrite typing.
  useEffect(() => {
    if (!hydrated.current && existing) {
      setTitle(existing.title);
      setContent(existing.content);
      hydrated.current = true;
    }
  }, [existing]);

  const isDirty =
    title !== (existing?.title ?? "") || content !== (existing?.content ?? "");

  const isBlank = title.trim().length === 0 && content.trim().length === 0;

  // Store is loaded and this id isn't in it — deleted from elsewhere.
  const isMissing = !isNew && !existing && status === "ready";

  const close = () => router.back();

  const handleSave = async () => {
    if (saving) return;

    if (isBlank) {
      // An empty new note is simply abandoned. Blanking an existing note is
      // really a delete, so say so rather than silently emptying it.
      if (isNew) {
        close();
        return;
      }

      Alert.alert(
        "Empty note",
        "A note needs a title or some text. Delete it instead?",
        [
          { text: "Keep editing", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              await remove(id);
              close();
            },
          },
        ],
      );
      return;
    }

    setSaving(true);

    if (isNew) {
      await create({ title, content });
    } else {
      await update(id, { title, content });
    }

    setSaving(false);
    close();
  };

  const handleBack = () => {
    if (!isDirty) {
      close();
      return;
    }

    Alert.alert("Discard changes?", "Your edits to this note will be lost.", [
      { text: "Keep editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: close },
    ]);
  };

  const handleDelete = () => {
    Alert.alert("Delete note?", "This note will be permanently deleted.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await remove(id);
          close();
        },
      },
    ]);
  };

  if (isMissing) {
    return (
      <Screen>
        <StateView
          icon="alert"
          tone="danger"
          title="This note is gone"
          body="It was deleted, so there is nothing left to edit."
          action={{ label: "Back to notes", onPress: close }}
        />
      </Screen>
    );
  }

  const saveDisabled = saving || (!isNew && !isDirty);

  return (
    <Screen>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingLeft: theme.spacing.xs,
          paddingRight: theme.spacing.lg,
          paddingBottom: theme.spacing.sm,
        }}
      >
        <Pressable
          onPress={handleBack}
          hitSlop={theme.spacing.sm}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={{
            width: TOUCH_TARGET,
            height: TOUCH_TARGET,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon
            name="chevronLeft"
            size={22}
            color={theme.colors.textSecondary}
          />
        </Pressable>

        <AppText variant="caption" tone="tertiary">
          {isNew ? "New note" : "Editing"}
        </AppText>

        <Button
          label="Save"
          size="sm"
          loading={saving}
          disabled={saveDisabled}
          onPress={handleSave}
        />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.xl,
          paddingTop: theme.spacing.md,
          paddingBottom: theme.spacing.xxxl,
          gap: theme.spacing.md,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Input
          variant="plain"
          textVariant="title"
          value={title}
          onChangeText={setTitle}
          placeholder="Title"
          autoFocus={isNew}
          maxLength={120}
          accessibilityLabel="Note title"
        />

        {/* scrollEnabled off so the ScrollView owns scrolling — the field grows
            with its content instead of becoming a nested scroller. */}
        <Input
          variant="plain"
          textVariant="bodyLarge"
          value={content}
          onChangeText={setContent}
          placeholder="Start writing…"
          multiline
          textAlignVertical="top"
          scrollEnabled={false}
          style={{ minHeight: 260 }}
          accessibilityLabel="Note body"
        />
      </ScrollView>

      {existing && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: theme.spacing.xl,
            paddingVertical: theme.spacing.md,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: theme.colors.border,
          }}
        >
          <AppText variant="caption" tone="tertiary">
            Edited {formatRelativeTime(existing.updatedAt)}
          </AppText>

          <Button
            label="Delete"
            variant="danger"
            size="sm"
            onPress={handleDelete}
          />
        </View>
      )}
    </Screen>
  );
}
