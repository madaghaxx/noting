import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";

import AppText from "@/src/components/ui/AppText";
import Icon, { type IconName } from "@/src/components/ui/Icon";
import { useTheme } from "@/src/theme";
import { motion } from "@/src/theme/tokens";
import { haptics } from "@/src/utils/haptics";

type Props = {
  children: ReactNode;
  /** Runs once the swipe has committed and the row has left the screen. */
  onAction: () => void;
  label: string;
  icon?: IconName;
  /** Rounded to match the card it wraps, so the panel behind lines up. */
  radius?: number;
  enabled?: boolean;
  /**
   * `commit` lets a long swipe act on release — right for a reversible action.
   *
   * `reveal` never acts on the gesture alone: the swipe only parks the row open,
   * and the action has to be tapped. Use it wherever the action is permanent, so
   * a gesture can't be the last word.
   */
  mode?: "commit" | "reveal";
};

/** How far the row rests open, showing the action. */
const REVEAL = 96;

/** Drag past this and releasing commits, without needing the button. */
const COMMIT = 172;

/** A flick commits regardless of distance. */
const COMMIT_VELOCITY = 0.5;

/** Ignore drags shallower than this so the list keeps its vertical scroll. */
const SLOP = 8;

/**
 * Only one row stays open at a time. Held at module scope rather than in a
 * context because it is one function pointer and every list in the app wants the
 * same behaviour — a second open row is never useful.
 */
let closeOpenRow: (() => void) | null = null;

/**
 * Swipe left to reveal a single destructive action.
 *
 * Two stages on purpose. A short swipe parks the row open so the action can be
 * read and tapped; a long swipe commits directly, which is what anyone who
 * already knows the gesture will do. The row also tells you which one you are in:
 * past the commit point the panel deepens and the phone taps back, so releasing
 * is never a surprise.
 *
 * Built on PanResponder and Animated — the same primitives as the rest of the
 * app's motion — so swiping costs no new dependency.
 */
export default function SwipeableRow({
  children,
  onAction,
  label,
  icon = "trash",
  radius,
  enabled = true,
  mode = "commit",
}: Props) {
  const theme = useTheme();
  const { width: screenWidth } = useWindowDimensions();

  const translateX = useRef(new Animated.Value(0)).current;
  const rest = useRef(0);

  // Threshold crossings are the only thing the render needs to know about, so
  // this is state rather than an interpolation: it changes twice per gesture.
  const [armed, setArmed] = useState(false);
  const armedRef = useRef(false);

  const corner = radius ?? theme.radius.xl;

  const settle = useCallback(
    (toValue: number) => {
      rest.current = toValue;

      Animated.spring(translateX, {
        toValue,
        useNativeDriver: true,
        stiffness: 300,
        damping: 28,
        mass: 0.85,
      }).start();
    },
    [translateX],
  );

  const closeRow = useCallback(() => {
    if (closeOpenRow === closeRow) closeOpenRow = null;

    setArmed(false);
    armedRef.current = false;
    settle(0);
  }, [settle]);

  const commit = useCallback(() => {
    if (closeOpenRow === closeRow) closeOpenRow = null;

    haptics.commit();

    // Off the screen first, then out of the list: removing the note while the row
    // is still visible would make it blink out mid-gesture.
    Animated.timing(translateX, {
      toValue: -screenWidth,
      duration: motion.fast,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onAction();
    });
  }, [closeRow, onAction, screenWidth, translateX]);

  // A row that unmounts while open must not leave a dangling closer behind.
  useEffect(
    () => () => {
      if (closeOpenRow === closeRow) closeOpenRow = null;
    },
    [closeRow],
  );

  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) => {
        if (!enabled) return false;

        // Horizontal intent only, and only in the direction that makes sense from
        // where the row currently rests. Anything else belongs to the list.
        const horizontal = Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.4;
        const meaningful =
          rest.current === 0 ? gesture.dx < -SLOP : Math.abs(gesture.dx) > SLOP;

        return horizontal && meaningful;
      },

      onPanResponderGrant: () => {
        if (closeOpenRow && closeOpenRow !== closeRow) closeOpenRow();
      },

      onPanResponderMove: (_event, gesture) => {
        const next = rest.current + gesture.dx;

        // Rightwards past closed is resisted rather than blocked: the row should
        // feel attached, not clamped.
        const clamped = next > 0 ? next * 0.2 : next;

        translateX.setValue(clamped);

        if (mode !== "commit") return;

        const nowArmed = clamped <= -COMMIT;

        if (nowArmed !== armedRef.current) {
          armedRef.current = nowArmed;
          setArmed(nowArmed);

          // Only on the way in. Buzzing again on the way out would make backing
          // off feel like another decision.
          if (nowArmed) haptics.detent();
        }
      },

      onPanResponderRelease: (_event, gesture) => {
        const offset = rest.current + gesture.dx;

        if (
          mode === "commit" &&
          (offset <= -COMMIT || gesture.vx <= -COMMIT_VELOCITY)
        ) {
          commit();
          return;
        }

        setArmed(false);
        armedRef.current = false;

        if (offset <= -REVEAL * 0.4) {
          closeOpenRow = closeRow;
          settle(-REVEAL);
          return;
        }

        closeRow();
      },

      onPanResponderTerminate: () => closeRow(),
    }),
  ).current;

  return (
    <View>
      {/* The action panel sits behind the row, revealed rather than moved. */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: corner,
            backgroundColor: armed
              ? theme.colors.danger
              : theme.colors.dangerSubtle,
            alignItems: "flex-end",
            justifyContent: "center",
            paddingRight: theme.spacing.xl,
            overflow: "hidden",
          },
        ]}
      >
        <Pressable
          onPress={mode === "commit" ? commit : onAction}
          accessibilityRole="button"
          accessibilityLabel={label}
          style={{
            width: REVEAL - theme.spacing.xl,
            alignItems: "center",
            gap: theme.spacing.xxs,
          }}
        >
          <Icon
            name={icon}
            size={21}
            color={armed ? theme.colors.onAccent : theme.colors.danger}
          />

          <AppText
            variant="caption"
            style={{
              color: armed ? theme.colors.onAccent : theme.colors.danger,
            }}
          >
            {label}
          </AppText>
        </Pressable>
      </View>

      <Animated.View
        {...responder.panHandlers}
        style={{ transform: [{ translateX }] }}
      >
        {children}
      </Animated.View>
    </View>
  );
}
