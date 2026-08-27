/**
 * Every screen transition in Noting, in one place.
 *
 * The app has exactly two kinds of movement, and the distinction is the whole
 * system:
 *
 *   Sideways — one of the sidebar's destinations to another, or locking and
 *   unlocking. Nothing is nested inside anything; the window keeps its place and
 *   changes what it holds. That is a crossfade.
 *
 *   Deeper — opening a note. The list stays conceptually behind the editor, and a
 *   horizontal push is the language every platform uses to say so. It reverses on
 *   the way back, which is what makes Back feel like retracing a step.
 *
 * The rule that was worth writing down: destinations used to slide, and that was
 * the thing that felt wrong. A slide claims hierarchy. Since `navigate` pops back
 * to a destination already in the stack rather than pushing a second copy, half of
 * those slides played in reverse — so choosing a screen from the sidebar looked
 * like backing out of one. A crossfade makes no claim about hierarchy and so can
 * never contradict itself.
 *
 * Durations are the platform's on Android, which is the target: `animation` there
 * is a native window animation and its timing is not ours to set. `animationDuration`
 * applies to fades on iOS, where the 500ms default is slower than anything else in
 * this app moves.
 */
import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";

import { motion } from "@/src/theme/tokens";

/** Same window, different contents. */
export const LATERAL: NativeStackNavigationOptions = {
  animation: "fade",
  animationDuration: motion.base,
};

/** Into something, and back out of it. */
export const DEEPER: NativeStackNavigationOptions = {
  animation: "slide_from_right",
};
