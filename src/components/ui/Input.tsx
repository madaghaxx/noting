import { TextInput, type TextInputProps } from "react-native";

import { useTheme } from "@/src/theme";
import type { TypographyVariant } from "@/src/theme/tokens";

type Props = TextInputProps & {
  textVariant?: TypographyVariant;
};

/**
 * A bare writing surface: the app's type scale, the app's caret and selection
 * colour, and nothing else.
 *
 * No border, no label, no filled box. Noting has exactly one place where text is
 * entered — the note editor — and there the page *is* the field; a bordered input
 * would draw a box around the note and make writing feel like filling in a form.
 * The search field is deliberately not built on this: it is a control rather than
 * a writing surface, so it carries its own frame.
 */
export default function Input({ textVariant = "body", style, ...rest }: Props) {
  const theme = useTheme();

  return (
    <TextInput
      placeholderTextColor={theme.colors.textTertiary}
      // Android draws its own selection tint; align it with the accent.
      selectionColor={theme.colors.accent}
      cursorColor={theme.colors.accent}
      style={[
        theme.typography[textVariant],
        { color: theme.colors.textPrimary },
        style,
      ]}
      {...rest}
    />
  );
}
