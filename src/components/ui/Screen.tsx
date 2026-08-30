import type { ReactNode } from "react";
import { StyleSheet, type ViewStyle } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "@/src/theme";

type Edge = "top" | "right" | "bottom" | "left";

type Props = {
  children: ReactNode;
  edges?: readonly Edge[];
  style?: ViewStyle;
};

/**
 * Every screen's outermost element. Owns the background color, the safe-area
 * insets and the status bar style, so no screen has to remember to.
 */
export default function Screen({
  children,
  edges = ["top", "bottom"],
  style,
}: Props) {
  const theme = useTheme();

  return (
    <SafeAreaView
      edges={edges}
      style={[styles.base, { backgroundColor: theme.colors.background }, style]}
    >
      {/* Status bar icons have to invert with the theme or they vanish. */}
      <StatusBar style={theme.mode === "dark" ? "light" : "dark"} />

      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
  },
});
