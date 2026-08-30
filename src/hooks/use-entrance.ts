import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing } from "react-native";

import { motion } from "@/src/theme/tokens";

/**
 * Fades and lifts a set of elements into place, one shortly after the next.
 *
 * Returns one animated style per element, in order — spread it onto an
 * `Animated.View`. Runs on first paint only: the point is to give a screen the
 * sense of assembling itself rather than snapping into existence. At ~55ms apart
 * it reads as a single gesture, not as items arriving separately.
 */
export function useStaggeredEntrance(count: number) {
  const values = useRef(
    Array.from({ length: count }, () => new Animated.Value(0)),
  ).current;

  useEffect(() => {
    const animation = Animated.stagger(
      motion.stagger,
      values.map((value) =>
        Animated.timing(value, {
          toValue: 1,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ),
    );

    animation.start();

    return () => animation.stop();
  }, [values]);

  return useMemo(
    () =>
      values.map((value) => ({
        opacity: value,
        transform: [
          {
            translateY: value.interpolate({
              inputRange: [0, 1],
              outputRange: [14, 0],
            }),
          },
        ],
      })),
    [values],
  );
}
