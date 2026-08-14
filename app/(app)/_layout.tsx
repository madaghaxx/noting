import { Stack } from "expo-router";
import AuthGate from "@/src/components/AuthGate";

export default function RootLayout() {
  return (
    <>
      <AuthGate />

      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
