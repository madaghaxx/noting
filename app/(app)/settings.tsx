import { useEffect, type ReactNode } from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { router } from "expo-router";

import ScreenHeader from "@/src/components/ScreenHeader";
import AppText from "@/src/components/ui/AppText";
import Icon, { type IconName } from "@/src/components/ui/Icon";
import Screen from "@/src/components/ui/Screen";
import { useStaggeredEntrance } from "@/src/hooks/use-entrance";
import { describeMethod, methodIcon } from "@/src/services/auth-service";
import { useAuthStore } from "@/src/store/auth-store";
import { useNotesStore } from "@/src/store/notes-store";
import { useSidebarStore } from "@/src/store/sidebar-store";
import { useTheme } from "@/src/theme";
import { TOUCH_TARGET } from "@/src/theme/tokens";

function Section({
  title,
  children,
  footer,
}: {
  title: string;
  children: ReactNode;
  footer?: string;
}) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <AppText
        variant="overline"
        tone="tertiary"
        style={{ paddingHorizontal: theme.spacing.xs }}
      >
        {title.toUpperCase()}
      </AppText>

      <View
        style={{
          borderRadius: theme.radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
          overflow: "hidden",
        }}
      >
        {children}
      </View>

      {footer && (
        <AppText
          variant="caption"
          tone="tertiary"
          style={{ paddingHorizontal: theme.spacing.xs }}
        >
          {footer}
        </AppText>
      )}
    </View>
  );
}

function Line({
  icon,
  label,
  value,
  first = false,
  onPress,
  tone = "tertiary",
}: {
  icon: IconName;
  label: string;
  value?: string;
  first?: boolean;
  onPress?: () => void;
  tone?: "tertiary" | "accent" | "danger";
}) {
  const theme = useTheme();

  const body = (pressed: boolean) => (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.lg,
        minHeight: TOUCH_TARGET,
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.md,
        borderTopWidth: first ? 0 : StyleSheet.hairlineWidth,
        borderTopColor: theme.colors.border,
        backgroundColor: pressed ? theme.colors.surfacePressed : "transparent",
      }}
    >
      <Icon name={icon} size={19} color={theme.colors.textSecondary} />

      <AppText variant="label" style={{ flex: 1 }}>
        {label}
      </AppText>

      {value && (
        <AppText variant="caption" tone={tone}>
          {value}
        </AppText>
      )}

      {onPress && (
        <Icon name="chevronRight" size={16} color={theme.colors.textTertiary} />
      )}
    </View>
  );

  if (!onPress) return body(false);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
    >
      {({ pressed }) => body(pressed)}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const theme = useTheme();

  const notes = useNotesStore((state) => state.notes);
  const deleted = useNotesStore((state) => state.deleted);
  const loadDeleted = useNotesStore((state) => state.loadDeleted);

  const capability = useAuthStore((state) => state.capability);
  const hasPasscode = useAuthStore((state) => state.hasPasscode);
  const refreshPasscode = useAuthStore((state) => state.refreshPasscode);

  const openSidebar = useSidebarStore((state) => state.open);
  const entrance = useStaggeredEntrance(2);

  // Both counts are read on arrival: the trash may have been emptied on another
  // screen, and the passcode may have been changed and this screen kept mounted.
  useEffect(() => {
    loadDeleted();
    refreshPasscode();
  }, [loadDeleted, refreshPasscode]);

  const pinned = notes.filter((note) => note.isPinned).length;

  const method = capability?.primary ?? null;
  const methodName = describeMethod(method, Platform.OS);

  /**
   * Says what this device can actually do, in its own words.
   *
   * A method the hardware does not have is never named as though it were an
   * option — "Face ID" appears here only on a phone that has it.
   */
  const biometricStatus = !capability
    ? "Not checked yet"
    : !capability.hasHardware
      ? "No sensor on this device"
      : !capability.isEnrolled
        ? "None enrolled"
        : `${methodName.charAt(0).toUpperCase()}${methodName.slice(1)}`;

  return (
    <Screen>
      <Animated.View style={entrance[0]}>
        <ScreenHeader
          title="Settings"
          leading={{
            icon: "menu",
            onPress: openSidebar,
            label: "Open navigation",
          }}
        />
      </Animated.View>

      <Animated.View style={[entrance[1], { flex: 1 }]}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.xl,
            paddingBottom: theme.spacing.xxxl,
            gap: theme.spacing.xxl,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Section
            title="Unlocking"
            footer={
              hasPasscode
                ? "Either one opens Noting. The passcode is what gets you in when the sensor won't read, or is locked out."
                : "A passcode is optional, and works alongside biometrics rather than replacing them."
            }
          >
            <Line
              icon={methodIcon(method)}
              label="Biometrics"
              value={biometricStatus}
              tone={capability?.isEnrolled ? "accent" : "tertiary"}
              first
            />

            <Line
              icon="key"
              label="Passcode"
              value={hasPasscode ? "On" : "Not set"}
              tone={hasPasscode ? "accent" : "tertiary"}
              onPress={() => router.push("/passcode")}
            />
          </Section>

          <Section title="Notebook">
            <Line icon="notes" label="Notes" value={`${notes.length}`} first />
            <Line icon="pin" label="Pinned" value={`${pinned}`} />
            <Line
              icon="trash"
              label="Recently deleted"
              value={`${deleted.length}`}
              onPress={() => router.navigate("/trash")}
            />
          </Section>

          <Section
            title="Storage"
            footer="Noting keeps every note in a database on this device. Nothing is sent anywhere, and there is no account to sign in to."
          >
            <Line
              icon="lock"
              label="Kept on this device"
              value="Never uploaded"
              first
            />
          </Section>
        </ScrollView>
      </Animated.View>
    </Screen>
  );
}
