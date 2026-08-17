import { Stack } from "expo-router";

import { useTheme } from "@/src/theme";

export default function AppLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // Opening a note is a push into detail, so it slides.
        animation: "slide_from_right",
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    />
  );
}
