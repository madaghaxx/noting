import { Button, Text, View } from "react-native";
import { router } from "expo-router";
import { useAuthStore } from "@/src/store/auth-store";

export default function HomeScreen() {
  const lock = useAuthStore((state) => state.lock);

  const handleLock = () => {
    lock();
    router.replace("/(auth)/unlock");
  };

  return (
    <View>
      <Text>Noting</Text>
      <Button title="Lock" onPress={handleLock} />
    </View>
  );
}
