import { Platform, Vibration } from "react-native";

/**
 * Small tactile confirmations for actions whose result is not immediately
 * visible — a swipe crossing the point of no return, a note leaving the list.
 *
 * Built on React Native's own `Vibration` rather than expo-haptics: this is the
 * only tactile feedback the app needs, and it does not justify a native module.
 * The trade-off is honest — these are short buzzes, not iOS's impact engine — so
 * they are used sparingly, where the buzz stands in for a physical detent.
 *
 * Never used to signal something the screen already says clearly.
 */

/** Durations chosen to read as taps rather than alerts. */
const PATTERNS = {
  /** A gesture passed a threshold and will commit when released. */
  detent: 10,
  /** Something was destroyed or moved out of the list. */
  commit: 18,
  /** Two beats: an action was refused. */
  reject: [0, 14, 60, 14],
} as const;

function fire(pattern: number | readonly number[]) {
  // iOS ignores duration entirely and always plays the same ~400ms buzz, which is
  // far too heavy for a swipe. Better nothing than the wrong thing.
  if (Platform.OS !== "android") return;

  try {
    Vibration.vibrate(pattern as number | number[]);
  } catch {
    // No vibrator, or the permission is missing on this build. Feedback is an
    // enhancement — never let its absence break the interaction it accompanies.
  }
}

export const haptics = {
  detent: () => fire(PATTERNS.detent),
  commit: () => fire(PATTERNS.commit),
  reject: () => fire(PATTERNS.reject),
};
