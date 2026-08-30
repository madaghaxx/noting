import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import AppText from "@/src/components/ui/AppText";
import Icon, { type IconName } from "@/src/components/ui/Icon";
import { useTheme } from "@/src/theme";

/** What the bar can do. The editor decides what each one means for the text. */
export type FormatAction =
  | "heading"
  | "bold"
  | "italic"
  | "code"
  | "list"
  | "quote"
  | "link";

type Button = {
  action: FormatAction;
  /** A letterform where one exists — clearer than any glyph for these. */
  glyph?: string;
  icon?: IconName;
  label: string;
  italic?: boolean;
  bold?: boolean;
};

const BUTTONS: readonly Button[] = [
  { action: "heading", glyph: "H", label: "Heading", bold: true },
  { action: "bold", glyph: "B", label: "Bold", bold: true },
  { action: "italic", glyph: "I", label: "Italic", italic: true },
  { action: "code", glyph: "‹›", label: "Code" },
  { action: "list", icon: "list", label: "Bullet list" },
  { action: "quote", glyph: "“", label: "Quote" },
  { action: "link", glyph: "↗", label: "Link" },
];

/**
 * The formatting bar, shown only while the body has focus.
 *
 * Deliberately one quiet row of marks rather than a toolbar with a background and
 * dividers: the note is the thing on screen, and this is a shelf under it. Every
 * action it offers can also be typed by hand, which is the point of Markdown — the
 * bar is a shortcut, not the interface.
 */
export default function FormatBar({
  onAction,
}: {
  onAction: (action: FormatAction) => void;
}) {
  const theme = useTheme();

  return (
    <View
      style={{
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: theme.colors.border,
        backgroundColor: theme.colors.background,
      }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.xs,
          gap: theme.spacing.xxs,
        }}
      >
        {BUTTONS.map((button) => (
          <Pressable
            key={button.action}
            onPress={() => onAction(button.action)}
            accessibilityRole="button"
            accessibilityLabel={button.label}
            style={({ pressed }) => ({
              minWidth: 44,
              height: 40,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: theme.radius.sm,
              backgroundColor: pressed
                ? theme.colors.surfacePressed
                : "transparent",
            })}
          >
            {button.glyph ? (
              <AppText
                variant="label"
                tone="secondary"
                style={{
                  fontWeight: button.bold ? "700" : "500",
                  fontStyle: button.italic ? "italic" : "normal",
                  fontSize: 16,
                }}
              >
                {button.glyph}
              </AppText>
            ) : (
              <Icon
                name={button.icon ?? "list"}
                size={18}
                color={theme.colors.textSecondary}
              />
            )}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
