import { View } from "react-native";
import { Stack } from "expo-router";

import PrivacyShield from "@/src/components/PrivacyShield";
import { useAppLock } from "@/src/hooks/use-app-lock";
import { useAuthStore } from "@/src/store/auth-store";
import { ThemeProvider, useTheme } from "@/src/theme";

/**
 * Split from `RootLayout` because a layout cannot consume a provider it renders
 * itself — the navigator needs the theme, so it has to be a child.
 */
function RootNavigator() {
  const theme = useTheme();
  const isUnlocked = useAuthStore((state) => state.isUnlocked);

  // Owns relocking: mounted above the guard, so the listener survives every
  // navigation and both halves of the app.
  const shielded = useAppLock();

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Stack
        screenOptions={{
          headerShown: false,
          // Locking and unlocking are not pushes. A crossfade suits a state
          // change; a slide would imply somewhere to go back to.
          animation: "fade",
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

      {/* Outside the navigator, so it covers whatever is on screen — including a
          screen mid-transition. */}
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
