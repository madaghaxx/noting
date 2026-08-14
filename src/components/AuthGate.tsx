import { Redirect, useSegments } from "expo-router";
import { useAuthStore } from "@/src/store/auth-store";

export default function AuthGate() {
  const isUnlocked = useAuthStore((state) => state.isUnlocked);
  const segments = useSegments();

  const inAuthGroup = segments[0] === "(auth)";

  if (!isUnlocked && !inAuthGroup) {
    return <Redirect href="/(auth)/unlock" />;
  }

  if (isUnlocked && inAuthGroup) {
    return <Redirect href="/(app)" />;
  }

  return null;
}
