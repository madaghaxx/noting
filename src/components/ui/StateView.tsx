import { View } from "react-native";

import { useTheme } from "@/src/theme";

import AppText from "./AppText";
import Button from "./Button";
import Icon, { type IconName } from "./Icon";

type Props = {
  icon: IconName;
  title: string;
  body?: string;
  action?: {
    label: string;
    onPress: () => void;
    icon?: IconName;
  };
  tone?: "neutral" | "danger";
};

/**
 * The shared shape for empty, error and not-found screens.
 *
 * One component for all three keeps them visually identical, which matters:
 * "nothing here yet" and "something broke" should feel like the same app
 * speaking, differing only in wording and tone.
 */
export default function StateView({
  icon,
  title,
  body,
  action,
  tone = "neutral",
}: Props) {
  const theme = useTheme();

  const accent = tone === "danger" ? theme.colors.danger : theme.colors.accent;
  const halo =
    tone === "danger" ? theme.colors.dangerSubtle : theme.colors.accentSubtle;

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: theme.spacing.xxl,
        paddingBottom: theme.spacing.xxxl,
      }}
    >
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: theme.radius.full,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: halo,
          marginBottom: theme.spacing.xl,
        }}
      >
        <Icon name={icon} size={30} color={accent} />
      </View>

      <AppText variant="heading" center>
        {title}
      </AppText>

      {body && (
        <AppText
          variant="body"
          tone="secondary"
          center
          style={{ marginTop: theme.spacing.sm }}
        >
          {body}
        </AppText>
      )}

      {action && (
        <Button
          label={action.label}
          icon={action.icon}
          variant={tone === "danger" ? "secondary" : "primary"}
          onPress={action.onPress}
          style={{ marginTop: theme.spacing.xxl }}
        />
      )}
    </View>
  );
}
