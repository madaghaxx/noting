import { Animated } from "react-native";

import ScreenHeader from "@/src/components/ScreenHeader";
import Screen from "@/src/components/ui/Screen";
import StateView from "@/src/components/ui/StateView";
import { useStaggeredEntrance } from "@/src/hooks/use-entrance";
import { useSidebarStore } from "@/src/store/sidebar-store";

/**
 * Favourite Images.
 *
 * Noting stores text only — notes have a title and a body, and there is no way to
 * attach an image to one yet. So this is deliberately an empty room with the
 * lights on rather than a grid of placeholders: the destination exists and is
 * navigable, and it says plainly what will appear here once notes can hold
 * pictures. Inventing sample images would make the app look capable of something
 * it cannot do.
 */
export default function ImagesScreen() {
  const openSidebar = useSidebarStore((state) => state.open);
  const entrance = useStaggeredEntrance(2);

  return (
    <Screen>
      <Animated.View style={entrance[0]}>
        <ScreenHeader
          title="Favorite Images"
          subtitle="Nothing saved yet"
          leading={{
            icon: "menu",
            onPress: openSidebar,
            label: "Open navigation",
          }}
        />
      </Animated.View>

      <Animated.View style={[entrance[1], { flex: 1 }]}>
        <StateView
          icon="image"
          title="No favourite images"
          body="Notes hold text for now. When a note can carry a picture, the ones you mark as favourites will collect here — on this device, behind the same lock as everything else."
        />
      </Animated.View>
    </Screen>
  );
}
