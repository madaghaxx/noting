import { Stack } from "expo-router";

import { LATERAL } from "@/src/navigation/transitions";
import { useTheme } from "@/src/theme";

export default function AuthLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        ...LATERAL,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    />
  );
}
