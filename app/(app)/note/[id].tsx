import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import FormatBar, { type FormatAction } from "@/src/components/FormatBar";
import AppText from "@/src/components/ui/AppText";
import Button from "@/src/components/ui/Button";
import Icon from "@/src/components/ui/Icon";
import Input from "@/src/components/ui/Input";
import Screen from "@/src/components/ui/Screen";
import StateView from "@/src/components/ui/StateView";
import Markdown from "@/src/markdown/Markdown";
import {
  insertLink,
  toggleInline,
  toggleLinePrefix,
  type Selection,
} from "@/src/markdown/edit";
import { useNotesStore } from "@/src/store/notes-store";
import { useTheme } from "@/src/theme";
import { TOUCH_TARGET } from "@/src/theme/tokens";
import { describeLength, formatRelativeTime } from "@/src/utils/format";

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

  /**
   * A saved note opens rendered; a new one opens ready to type.
   *
   * Markdown is only worth writing if it is worth reading, and the reading is what
   * you came back for. Getting out of it is one tap on the text itself, so this
   * costs nothing when you did come back to edit.
   */
  const [reading, setReading] = useState(!isNew);

  const [focused, setFocused] = useState(false);
  const selection = useRef<Selection>({ start: 0, end: 0 });

  /**
   * Only set immediately after a formatting button, then released.
   *
   * A permanently controlled selection fights the keyboard on Android — every
   * keystroke would try to put the cursor back where React last knew it.
   */
  const [pendingSelection, setPendingSelection] = useState<
    Selection | undefined
  >(undefined);

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

  const handleFormat = useCallback(
    (action: FormatAction) => {
      const current = selection.current;

      const result = (() => {
        switch (action) {
          case "bold":
            return toggleInline(content, current, "**");
          case "italic":
            return toggleInline(content, current, "*");
          case "code":
            return toggleInline(content, current, "`");
          case "heading":
            return toggleLinePrefix(content, current, "# ");
          case "list":
            return toggleLinePrefix(content, current, "- ");
          case "quote":
            return toggleLinePrefix(content, current, "> ");
          case "link":
            return insertLink(content, current);
        }
      })();

      setContent(result.text);
      selection.current = result.selection;
      setPendingSelection(result.selection);
    },
    [content],
  );

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
    Alert.alert(
      "Move to Recently Deleted?",
      "The note will be kept in Recently Deleted until you remove it.",
      [
        { text: "Cancel", style: "cancel" },
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
  const hasBody = content.trim().length > 0;

  return (
    <Screen>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: theme.spacing.sm,
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

        {/* One control, two states, in the same place — so the toggle reads as a
            switch rather than as two different buttons appearing. */}
        {hasBody || !isNew ? (
          <Pressable
            onPress={() => setReading((value) => !value)}
            accessibilityRole="switch"
            accessibilityState={{ checked: reading }}
            accessibilityLabel={
              reading ? "Edit this note" : "Preview formatting"
            }
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: theme.spacing.xs,
              minHeight: TOUCH_TARGET - theme.spacing.md,
              paddingHorizontal: theme.spacing.md,
              borderRadius: theme.radius.md,
              backgroundColor: pressed
                ? theme.colors.surfacePressed
                : "transparent",
            })}
          >
            <AppText variant="caption" tone={reading ? "accent" : "tertiary"}>
              {reading ? "Reading" : "Writing"}
            </AppText>
          </Pressable>
        ) : (
          <AppText variant="caption" tone="tertiary">
            New note
          </AppText>
        )}

        <Button
          label="Save"
          size="sm"
          loading={saving}
          disabled={saveDisabled}
          onPress={handleSave}
        />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {reading ? (
          // Tapping the rendered note starts editing it, at which point the
          // toggle in the header is a way back rather than the only way in.
          <Pressable
            style={{ flex: 1 }}
            onPress={() => setReading(false)}
            accessibilityRole="button"
            accessibilityLabel="Edit this note"
          >
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{
                paddingHorizontal: theme.spacing.xl,
                paddingTop: theme.spacing.md,
                paddingBottom: theme.spacing.xxxl,
                gap: theme.spacing.lg,
              }}
              showsVerticalScrollIndicator={false}
            >
              {title.trim().length > 0 && (
                <AppText variant="title">{title}</AppText>
              )}

              {hasBody ? (
                <Markdown source={content} />
              ) : (
                <AppText variant="bodyLarge" tone="tertiary">
                  Nothing written yet. Tap to start.
                </AppText>
              )}
            </ScrollView>
          </Pressable>
        ) : (
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
              placeholder="Start writing… Markdown works here."
              multiline
              textAlignVertical="top"
              scrollEnabled={false}
              selection={pendingSelection}
              onSelectionChange={(event) => {
                selection.current = event.nativeEvent.selection;

                // Hand control of the cursor back to the platform as soon as it
                // has taken the position a format button asked for.
                if (pendingSelection) setPendingSelection(undefined);
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              style={{ minHeight: 260 }}
              accessibilityLabel="Note body"
            />
          </ScrollView>
        )}

        {/* Only while the body has focus: the bar is for writing, and it would
            otherwise sit under the note while it is being read. */}
        {!reading && focused && <FormatBar onAction={handleFormat} />}
      </KeyboardAvoidingView>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: theme.spacing.md,
          paddingHorizontal: theme.spacing.xl,
          paddingVertical: theme.spacing.md,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.colors.border,
        }}
      >
        <AppText variant="caption" tone="tertiary" numberOfLines={1}>
          {existing
            ? `Edited ${formatRelativeTime(existing.updatedAt)}`
            : describeLength(content)}
        </AppText>

        {existing && (
          <Button
            label="Delete"
            variant="danger"
            size="sm"
            onPress={handleDelete}
          />
        )}
      </View>
    </Screen>
  );
}
