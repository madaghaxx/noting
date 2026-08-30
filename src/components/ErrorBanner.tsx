import { Pressable } from "react-native";

import AppText from "@/src/components/ui/AppText";
import Icon from "@/src/components/ui/Icon";
import { useTheme } from "@/src/theme";

type Props = {
  message: string;
  onDismiss: () => void;
};

/**
 * A write failed while there is still something worth reading on screen.
 *
 * Deliberately not a dialog: the list behind it is intact and usable, and stopping
 * the app to acknowledge "couldn't save that" would be a heavier interruption than
 * the problem warrants. Tapping it dismisses.
 *
 * Shared by every screen that writes, so a database error looks the same wherever
 * it surfaces — and so the same tint means the same thing everywhere.
 */
export default function ErrorBanner({ message, onDismiss }: Props) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onDismiss}
      accessibilityRole="button"
      accessibilityLabel={`${message}. Tap to dismiss.`}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.md,
        marginHorizontal: theme.spacing.xl,
        marginBottom: theme.spacing.md,
        padding: theme.spacing.md,
        borderRadius: theme.radius.lg,
        backgroundColor: theme.colors.dangerSubtle,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Icon name="alert" size={18} color={theme.colors.danger} />

      <AppText
        variant="caption"
        tone="danger"
        numberOfLines={3}
        style={{ flex: 1 }}
      >
        {message}
      </AppText>
    </Pressable>
  );
}
