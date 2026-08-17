import { Stack } from "expo-router";

import { useTheme } from "@/src/theme";

export default function AuthLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "fade",
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    />
  );
}
