import { StyleSheet, View } from "react-native";

import { useTheme } from "@/src/theme";

type Props = {
  size?: number;
  /**
   * Sits on a surface rather than on the page. Without this the mark's own
   * surface colour matches the panel behind it and only its border shows.
   */
  raised?: boolean;
};

/**
 * The Noting mark: three stacked rules, the top one accented.
 *
 * An abstract page rather than a padlock — the lock iconography belongs to the
 * biometric badge, and repeating it here would make the screen read as being
 * about security rather than about writing.
 */
export default function LogoMark({ size = 46, raised = false }: Props) {
  const theme = useTheme();

  const rules = [
    { width: size * 0.42, color: theme.colors.accent },
    { width: size * 0.28, color: theme.colors.textTertiary },
    { width: size * 0.35, color: theme.colors.textTertiary },
  ];

  return (
    <View
      style={[
        styles.mark,
        {
          width: size,
          height: size,
          borderRadius: size * 0.3,
          backgroundColor: raised
            ? theme.colors.surfaceRaised
            : theme.colors.surface,
          borderColor: theme.colors.border,
          gap: size * 0.09,
        },
        theme.elevation(1),
      ]}
    >
      {rules.map((rule) => (
        <View
          key={rule.width}
          style={{
            width: rule.width,
            height: Math.max(1.5, size * 0.045),
            borderRadius: size,
            backgroundColor: rule.color,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
});
