import { Text, type TextProps } from "react-native";

import { useTheme } from "@/src/theme";
import type { TypographyVariant } from "@/src/theme/tokens";

type Tone =
  | "primary"
  | "secondary"
  | "tertiary"
  | "accent"
  | "danger"
  | "success"
  | "onAccent";

type Props = TextProps & {
  variant?: TypographyVariant;
  tone?: Tone;
  center?: boolean;
};

/**
 * The only text component in the app.
 *
 * Routing every string through here is what keeps the type scale honest — there
 * is no ad-hoc `fontSize: 13` anywhere, so hierarchy stays intentional.
 */
export default function AppText({
  variant = "body",
  tone = "primary",
  center = false,
  style,
  ...rest
}: Props) {
  const theme = useTheme();

  const tones: Record<Tone, string> = {
    primary: theme.colors.textPrimary,
    secondary: theme.colors.textSecondary,
    tertiary: theme.colors.textTertiary,
    accent: theme.colors.accent,
    danger: theme.colors.danger,
    success: theme.colors.success,
    onAccent: theme.colors.onAccent,
  };

  return (
    <Text
      style={[
        theme.typography[variant],
        { color: tones[tone] },
        center && { textAlign: "center" },
        style,
      ]}
      {...rest}
    />
  );
}
