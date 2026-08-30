import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

import Icon, { type IconName } from "@/src/components/ui/Icon";
import { useTheme } from "@/src/theme";

export type BadgeState = "idle" | "busy" | "success" | "error";

type Props = {
  state: BadgeState;
  /**
   * The modality this device will actually use. A fingerprint drawn on a Face ID
   * phone is a small lie that the user notices immediately.
   */
  icon?: IconName;
};

const OUTER = 148;
const INNER = 88;
const PULSE_DURATION = 1500;
const PULSE_GAP = 750;

/**
 * The unlock screen's focal point: a quiet glass-like disc that responds to
 * authentication rather than reporting on it.
 *
 * Deliberately restrained — concentric rings breathing outward while the sensor
 * waits, a settle on success, a short shake on failure. No progress bars, no
 * scanning grid, nothing that would make a private notebook look like a
 * security console.
 */
export default function BiometricBadge({
  state,
  icon = "fingerprint",
}: Props) {
  const theme = useTheme();

  const pulseA = useRef(new Animated.Value(0)).current;
  const pulseB = useRef(new Animated.Value(0)).current;
  const settle = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;

  // Two rings on the same period, half a cycle apart, so the disc always has
  // exactly one ring leaving it.
  useEffect(() => {
    if (state !== "busy") {
      pulseA.setValue(0);
      pulseB.setValue(0);
      return;
    }

    const ring = (value: Animated.Value, lead: number, trail: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(lead),
          Animated.timing(value, {
            toValue: 1,
            duration: PULSE_DURATION,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.delay(trail),
        ]),
      );

    const first = ring(pulseA, 0, PULSE_GAP);
    const second = ring(pulseB, PULSE_GAP, 0);

    first.start();
    second.start();

    return () => {
      first.stop();
      second.stop();
      pulseA.setValue(0);
      pulseB.setValue(0);
    };
  }, [state, pulseA, pulseB]);

  useEffect(() => {
    Animated.spring(settle, {
      toValue: state === "success" ? 1 : 0,
      useNativeDriver: true,
      ...theme.springs.settle,
    }).start();
  }, [state, settle, theme.springs.settle]);

  useEffect(() => {
    if (state !== "error") return;

    // Short and small. A long shake reads as punishment for a fingerprint that
    // simply didn't read cleanly.
    Animated.sequence([
      Animated.timing(shake, {
        toValue: 1,
        duration: 55,
        useNativeDriver: true,
      }),
      Animated.timing(shake, {
        toValue: -1,
        duration: 55,
        useNativeDriver: true,
      }),
      Animated.timing(shake, {
        toValue: 0.5,
        duration: 55,
        useNativeDriver: true,
      }),
      Animated.timing(shake, {
        toValue: 0,
        duration: 55,
        useNativeDriver: true,
      }),
    ]).start();
  }, [state, shake]);

  const tint =
    state === "success"
      ? theme.colors.success
      : state === "error"
        ? theme.colors.danger
        : theme.colors.accent;

  const halo =
    state === "success"
      ? theme.colors.successSubtle
      : state === "error"
        ? theme.colors.dangerSubtle
        : theme.colors.accentSubtle;

  const ringStyle = (value: Animated.Value) => ({
    opacity: value.interpolate({
      inputRange: [0, 0.12, 1],
      outputRange: [0, 0.4, 0],
    }),
    transform: [
      {
        scale: value.interpolate({
          inputRange: [0, 1],
          outputRange: [0.92, 1.55],
        }),
      },
    ],
  });

  return (
    <Animated.View
      style={[
        styles.root,
        {
          transform: [
            {
              translateX: shake.interpolate({
                inputRange: [-1, 1],
                outputRange: [-7, 7],
              }),
            },
            {
              scale: settle.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.04],
              }),
            },
          ],
        },
      ]}
    >
      {state === "busy" && (
        <>
          <Animated.View
            style={[
              styles.ring,
              { borderColor: tint },
              ringStyle(pulseA),
            ]}
          />
          <Animated.View
            style={[
              styles.ring,
              { borderColor: tint },
              ringStyle(pulseB),
            ]}
          />
        </>
      )}

      <View style={[styles.disc, { backgroundColor: halo }]}>
        <View
          style={[
            styles.core,
            {
              backgroundColor: theme.colors.surfaceRaised,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Icon
            name={state === "success" ? "check" : icon}
            size={state === "success" ? 40 : 38}
            color={tint}
          />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: OUTER,
    height: OUTER,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    width: OUTER,
    height: OUTER,
    borderRadius: OUTER,
    borderWidth: 1,
  },
  disc: {
    width: OUTER,
    height: OUTER,
    borderRadius: OUTER,
    alignItems: "center",
    justifyContent: "center",
  },
  core: {
    width: INNER,
    height: INNER,
    borderRadius: INNER,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
});
