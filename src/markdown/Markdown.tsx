import { Fragment, useMemo } from "react";
import {
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import AppText from "@/src/components/ui/AppText";
import {
  parseMarkdown,
  type Block,
  type Inline,
  type ListItem,
} from "@/src/markdown/parse";
import { useTheme, type Theme } from "@/src/theme";
import type { TypographyVariant } from "@/src/theme/tokens";

/**
 * Android has no named serif/mono family; "monospace" is the one guaranteed alias.
 */
const MONOSPACE = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
});

/** Headings map onto the existing type scale rather than inventing sizes. */
const HEADING_VARIANT: Record<number, TypographyVariant> = {
  1: "title",
  2: "heading",
  3: "subtitle",
  4: "label",
  5: "label",
  6: "label",
};

function openLink(href: string) {
  // Fire-and-forget: a URL the platform refuses (a typo'd scheme, say) should not
  // throw into the render tree. Nothing useful can be said about it in a note.
  Linking.openURL(href).catch(() => {});
}

function InlineNodes({
  nodes,
  theme,
  tone,
}: {
  nodes: Inline[];
  theme: Theme;
  tone?: string;
}) {
  return (
    <>
      {nodes.map((node, index) => {
        switch (node.type) {
          case "text":
            return <Fragment key={index}>{node.value}</Fragment>;

          case "strong":
            return (
              <Text key={index} style={{ fontWeight: "700" }}>
                <InlineNodes nodes={node.children} theme={theme} tone={tone} />
              </Text>
            );

          case "em":
            return (
              <Text key={index} style={{ fontStyle: "italic" }}>
                <InlineNodes nodes={node.children} theme={theme} tone={tone} />
              </Text>
            );

          case "code":
            return (
              <Text
                key={index}
                style={{
                  fontFamily: MONOSPACE,
                  // Slightly down-sized: monospace faces run large next to the
                  // body face, and matching them by number looks mismatched.
                  fontSize: theme.typography.body.fontSize * 0.94,
                  color: theme.colors.textPrimary,
                  backgroundColor: theme.colors.surfaceSubtle,
                }}
              >
                {` ${node.value} `}
              </Text>
            );

          case "link":
            return (
              <Text
                key={index}
                onPress={() => openLink(node.href)}
                suppressHighlighting={false}
                accessibilityRole="link"
                style={{
                  color: theme.colors.accent,
                  textDecorationLine: "underline",
                }}
              >
                <InlineNodes nodes={node.children} theme={theme} tone={tone} />
              </Text>
            );
        }
      })}
    </>
  );
}

function Bullet({ item, theme }: { item: ListItem; theme: Theme }) {
  const label = item.number === null ? "•" : `${item.number}.`;

  return (
    <View
      style={{
        flexDirection: "row",
        gap: theme.spacing.sm,
        paddingLeft: item.depth * theme.spacing.xl,
      }}
    >
      {/* Fixed-width marker column so wrapped lines align under the text, not
          under the bullet. */}
      <AppText
        variant="bodyLarge"
        tone="tertiary"
        style={{ minWidth: item.number === null ? 12 : 22 }}
      >
        {label}
      </AppText>

      <AppText variant="bodyLarge" style={{ flex: 1 }}>
        <InlineNodes nodes={item.children} theme={theme} />
      </AppText>
    </View>
  );
}

function BlockView({ block, theme }: { block: Block; theme: Theme }) {
  switch (block.type) {
    case "heading":
      return (
        <AppText
          variant={HEADING_VARIANT[block.level]}
          tone={block.level >= 4 ? "secondary" : "primary"}
        >
          <InlineNodes nodes={block.children} theme={theme} />
        </AppText>
      );

    case "paragraph":
      return (
        <AppText variant="bodyLarge">
          <InlineNodes nodes={block.children} theme={theme} />
        </AppText>
      );

    case "list":
      return (
        <View style={{ gap: theme.spacing.sm }}>
          {block.items.map((item, index) => (
            <Bullet key={index} item={item} theme={theme} />
          ))}
        </View>
      );

    case "quote":
      return (
        <View
          style={{
            borderLeftWidth: 2,
            borderLeftColor: theme.colors.accent,
            paddingLeft: theme.spacing.lg,
            gap: theme.spacing.md,
          }}
        >
          {block.blocks.map((child, index) => (
            <BlockView key={index} block={child} theme={theme} />
          ))}
        </View>
      );

    case "code":
      return (
        <View
          style={{
            borderRadius: theme.radius.md,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.surfaceSubtle,
          }}
        >
          {block.language && (
            <AppText
              variant="overline"
              tone="tertiary"
              style={{
                paddingHorizontal: theme.spacing.md,
                paddingTop: theme.spacing.sm,
              }}
            >
              {block.language.toUpperCase()}
            </AppText>
          )}

          {/* Code is the one thing that must not be reflowed, so it scrolls
              sideways instead of wrapping. */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ padding: theme.spacing.md }}
          >
            <Text
              style={{
                fontFamily: MONOSPACE,
                fontSize: theme.typography.body.fontSize * 0.94,
                lineHeight: theme.typography.body.lineHeight,
                color: theme.colors.textPrimary,
              }}
            >
              {block.value}
            </Text>
          </ScrollView>
        </View>
      );

    case "rule":
      return (
        <View
          style={{
            height: StyleSheet.hairlineWidth,
            backgroundColor: theme.colors.border,
            marginVertical: theme.spacing.xs,
          }}
        />
      );
  }
}

/**
 * Renders a note's Markdown.
 *
 * Everything it draws comes from the theme — the same type scale, spacing and one
 * accent as the rest of the app — so a rendered note looks like Noting rather than
 * like a rendered document.
 */
export default function Markdown({ source }: { source: string }) {
  const theme = useTheme();

  // Parsing is cheap but not free, and this renders on every keystroke while the
  // preview is open.
  const blocks = useMemo(() => parseMarkdown(source), [source]);

  return (
    <View style={{ gap: theme.spacing.lg }}>
      {blocks.map((block, index) => (
        <BlockView key={index} block={block} theme={theme} />
      ))}
    </View>
  );
}
