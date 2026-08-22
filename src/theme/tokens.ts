/**
 * Design tokens: everything about the app's rhythm, type and motion that is
 * independent of light/dark. Colors live in `palette.ts` because they are the
 * only tokens that change with the theme.
 */

/** 4pt base scale. Named by role rather than size so usage stays consistent. */
export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
  huge: 56,
} as const;

/**
 * Deliberately moderate. Fully rounded shapes are reserved for genuinely
 * circular things (the avatar dot, the biometric ring) rather than used on
 * buttons, which keeps the app from looking like a pill collection.
 */
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  xxl: 28,
  full: 999,
} as const;

/**
 * Type scale. Large sizes carry negative tracking — at display sizes the
 * default spacing reads loose and slightly cheap.
 */
export const typography = {
  display: {
    fontSize: 36,
    lineHeight: 42,
    fontWeight: "700",
    letterSpacing: -1,
  },
  title: {
    fontSize: 27,
    lineHeight: 33,
    fontWeight: "700",
    letterSpacing: -0.6,
  },
  heading: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "500",
    letterSpacing: -0.1,
  },
  bodyLarge: {
    fontSize: 17,
    lineHeight: 27,
    fontWeight: "400",
    letterSpacing: 0,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "400",
    letterSpacing: 0,
  },
  label: {
    fontSize: 14.5,
    lineHeight: 20,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  caption: {
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: "500",
    letterSpacing: 0.1,
  },
  overline: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600",
    letterSpacing: 0.8,
  },
} as const;

export type TypographyVariant = keyof typeof typography;

/**
 * Motion. Short by design — these durations are meant to feel like the UI is
 * keeping up with the user, not performing for them.
 */
export const motion = {
  instant: 90,
  fast: 150,
  base: 220,
  slow: 340,
  /** Entrance choreography: each element waits this much longer than the last. */
  stagger: 55,
} as const;

/** Press feedback shared by every tappable surface. */
export const springs = {
  press: { stiffness: 420, damping: 26, mass: 0.7 },
  settle: { stiffness: 260, damping: 22, mass: 0.9 },
} as const;

/**
 * Either spring. `as const` gives each one its own literal type, so a helper
 * that takes "a spring" has to name the union or it only ever accepts the first
 * one it was written against.
 */
export type SpringConfig = (typeof springs)[keyof typeof springs];

/** Android's minimum comfortable touch target. */
export const TOUCH_TARGET = 48;
