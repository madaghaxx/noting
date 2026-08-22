import { StyleSheet, View } from "react-native";

import LogoMark from "@/src/components/LogoMark";
import AppText from "@/src/components/ui/AppText";
import { useTheme } from "@/src/theme";

/**
 * Covers the screen while the app is on its way out of the foreground.
 *
 * This is what the app switcher's thumbnail should show instead of someone's
 * notes. It is deliberately not animated: a fade would be a race against the
 * screenshot the platform is taking at that exact moment, and losing that race is
 * the whole failure being avoided.
 *
 * Worth stating plainly what this is not. The platforms have a real mechanism for
 * excluding a window from screenshots and recordings — FLAG_SECURE on Android — and
 * reaching it needs a native module the project does not have (expo-screen-capture).
 * This covers the app-switcher thumbnail, which is the exposure a person actually
 * encounters; it does not stop a deliberate screenshot. Adding that module is the
 * next step if the threat model calls for it.
 */
export default function PrivacyShield({ visible }: { visible: boolean }) {
  const theme = useTheme();

  if (!visible) return null;

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: theme.colors.background,
          alignItems: "center",
          justifyContent: "center",
          gap: theme.spacing.lg,
        },
      ]}
      // Nothing behind this is reachable, and a screen reader should not read a
      // covered note out either.
      pointerEvents="auto"
      accessibilityViewIsModal
      accessibilityLabel="Noting is locked"
    >
      <LogoMark size={54} />

      <AppText variant="heading">Noting</AppText>

      <AppText variant="caption" tone="tertiary">
        Locked
      </AppText>
    </View>
  );
}
