import { useRef } from "react";
import { PanResponder, View } from "react-native";
import { Stack } from "expo-router";

import Sidebar from "@/src/components/Sidebar";
import { DEEPER, LATERAL } from "@/src/navigation/transitions";
import { useSidebarStore } from "@/src/store/sidebar-store";
import { useTheme } from "@/src/theme";

/** How far in from the left edge a drag has to start to count as opening. */
const EDGE = 28;

/** And how far it has to travel before it does. */
const DISTANCE = 22;

export default function AppLayout() {
  const theme = useTheme();

  /**
   * Opens the sidebar on a drag from the left edge.
   *
   * Attached to the wrapper *around* the navigator rather than to a strip laid on
   * top of it. An ancestor only takes over a touch its children have not claimed,
   * so taps and vertical scrolling reach the notes list untouched; a strip in
   * front would have to intercept everything and hand back what it did not want.
   *
   * The conditions are deliberately narrow — near the edge, clearly sideways, and
   * far enough to be meant — so a diagonal flick while scrolling never triggers it.
   */
  const edgeSwipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (event, gesture) => {
        if (useSidebarStore.getState().isOpen) return false;

        return (
          event.nativeEvent.pageX - gesture.dx < EDGE &&
          gesture.dx > DISTANCE &&
          gesture.dx > Math.abs(gesture.dy) * 1.6
        );
      },

      onPanResponderGrant: () => useSidebarStore.getState().open(),
    }),
  ).current;

  return (
    <View style={{ flex: 1 }} {...edgeSwipe.panHandlers}>
      <Stack
        initialRouteName="index"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
          // The sidebar's destinations are siblings, not a hierarchy. See
          // `navigation/transitions` for why that rules out a slide.
          ...LATERAL,
        }}
      >
        {/* Opening a note *is* going deeper, and it is the one place a slide is
            correct: it leaves the list feeling like it is still there, behind. */}
        <Stack.Screen name="note/[id]" options={DEEPER} />
      </Stack>

      {/* Rendered outside the navigator so it covers whichever screen is on top,
          and so switching destinations does not animate the panel with them. */}
      <Sidebar />
    </View>
  );
}
