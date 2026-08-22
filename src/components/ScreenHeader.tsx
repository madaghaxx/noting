import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import AppText from "@/src/components/ui/AppText";
import Icon, { type IconName } from "@/src/components/ui/Icon";
import { useTheme } from "@/src/theme";
import { TOUCH_TARGET } from "@/src/theme/tokens";

type Props = {
  title: string;
  subtitle?: string;
  /** `menu` opens the sidebar; `back` pops the screen. */
  leading: { icon: Extract<IconName, "menu" | "chevronLeft">; onPress: () => void; label: string };
  /** Optional trailing control — a lock button, a destructive action. */
  children?: ReactNode;
};

/**
 * The header every top-level screen shares.
 *
 * One component so the sidebar button, the title and the trailing action sit in
 * exactly the same place on the notes list, the trash and settings — moving
 * between them should feel like one screen changing its contents.
 */
export default function ScreenHeader({
  title,
  subtitle,
  leading,
  children,
}: Props) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.sm,
        paddingLeft: theme.spacing.sm,
        paddingRight: theme.spacing.xl,
        paddingTop: theme.spacing.xs,
        paddingBottom: theme.spacing.lg,
      }}
    >
      <Pressable
        onPress={leading.onPress}
        hitSlop={theme.spacing.sm}
        accessibilityRole="button"
        accessibilityLabel={leading.label}
        style={({ pressed }) => ({
          width: TOUCH_TARGET,
          height: TOUCH_TARGET,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: theme.radius.full,
          backgroundColor: pressed ? theme.colors.surfacePressed : "transparent",
        })}
      >
        <Icon
          name={leading.icon}
          size={leading.icon === "menu" ? 20 : 22}
          color={theme.colors.textSecondary}
        />
      </Pressable>

      <View style={{ flex: 1 }}>
        <AppText variant="title" numberOfLines={1}>
          {title}
        </AppText>

        {subtitle && (
          <AppText
            variant="body"
            tone="tertiary"
            numberOfLines={1}
            style={{ marginTop: theme.spacing.xxs }}
          >
            {subtitle}
          </AppText>
        )}
      </View>

      {children}
    </View>
  );
}
