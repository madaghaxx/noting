import { Button, Text, View } from "react-native";
import { router } from "expo-router";
import { useAuthStore } from "@/src/store/auth-store";

export default function UnlockScreen() {
  const unlock = useAuthStore((state) => state.unlock);

  const handleUnlock = () => {
    unlock();
    router.replace("/(app)");
  };

  return (
    <View>
      <Text>Noting is locked</Text>
      <Button title="Unlock" onPress={handleUnlock} />
    </View>
  );
}
