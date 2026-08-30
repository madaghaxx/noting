import { useEffect } from "react";
import { View } from "react-native";
import { router, Stack } from "expo-router";

import ConfirmDialog from "@/src/components/ConfirmDialog";
import PrivacyShield from "@/src/components/PrivacyShield";
import { useAppLock } from "@/src/hooks/use-app-lock";
import { LATERAL } from "@/src/navigation/transitions";
import { useAuthStore } from "@/src/store/auth-store";
import { useConfirmStore } from "@/src/store/confirm-store";
import { ThemeProvider, useTheme } from "@/src/theme";

/**
 * Split from `RootLayout` because a layout cannot consume a provider it renders
 * itself — the navigator needs the theme, so it has to be a child.
 */
function RootNavigator() {
  const theme = useTheme();
  const isUnlocked = useAuthStore((state) => state.isUnlocked);

  const confirmRequest = useConfirmStore((state) => state.request);
  const dismissConfirm = useConfirmStore((state) => state.dismiss);

  // The protected group is recreated after every unlock. Make its entry point
  // explicit rather than inheriting whichever protected route existed before
  // locking (or a dynamic editor route chosen during navigator restoration).
  useEffect(() => {
    if (isUnlocked) router.replace("/");
  }, [isUnlocked]);

  // Owns relocking: mounted above the guard, so the listener survives every
  // navigation and both halves of the app.
  const shielded = useAppLock();

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Stack
        initialRouteName="(auth)"
        screenOptions={{
          headerShown: false,
          // Locking and unlocking are not pushes. See `navigation/transitions`.
          ...LATERAL,
          // Without an explicit background the navigator paints its default white
          // behind screens, which flashes on every transition in dark mode.
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Protected guard={!isUnlocked}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>

        <Stack.Protected guard={isUnlocked}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
      </Stack>

      {/* Above the navigator so one dialog serves every screen, and so it cannot
          be clipped by the sidebar or a screen mid-transition. */}
      <ConfirmDialog request={confirmRequest} onDismiss={dismissConfirm} />

      {/* Outside the navigator, so it covers whatever is on screen — including a
          screen mid-transition, and including an open dialog. */}
      <PrivacyShield visible={shielded} />
    </View>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootNavigator />
    </ThemeProvider>
  );
}
