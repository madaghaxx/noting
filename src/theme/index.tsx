import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useColorScheme, type ViewStyle } from "react-native";

import { darkPalette, lightPalette, type Palette } from "./palette";
import {
  motion,
  radius,
  spacing,
  springs,
  typography,
  TOUCH_TARGET,
} from "./tokens";

export type ThemeMode = "light" | "dark";

export type Theme = {
  mode: ThemeMode;
  colors: Palette;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  motion: typeof motion;
  springs: typeof springs;
  /** Depth for a surface, expressed the way the current mode expresses depth. */
  elevation: (level: 1 | 2 | 3) => ViewStyle;
};

const SHADOWS = {
  1: { opacity: 0.05, blur: 6, y: 2 },
  2: { opacity: 0.07, blur: 14, y: 5 },
  3: { opacity: 0.1, blur: 26, y: 10 },
} as const;

function buildElevation(mode: ThemeMode, colors: Palette) {
  return (level: 1 | 2 | 3): ViewStyle => {
    // A drop shadow against a near-black background is invisible, so dark mode
    // conveys depth by lightening the surface instead (see `surfaceRaised`).
    // Only Android's elevation is kept, to preserve correct draw order.
    if (mode === "dark") {
      return { elevation: level };
    }

    const shadow = SHADOWS[level];

    return {
      elevation: level * 3,
      shadowColor: colors.shadow,
      shadowOpacity: shadow.opacity,
      shadowRadius: shadow.blur,
      shadowOffset: { width: 0, height: shadow.y },
    };
  };
}

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();

  // Dark-first: an unresolved scheme resolves to dark rather than light.
  const mode: ThemeMode = scheme === "light" ? "light" : "dark";

  const theme = useMemo<Theme>(() => {
    const colors = mode === "dark" ? darkPalette : lightPalette;

    return {
      mode,
      colors,
      spacing,
      radius,
      typography,
      motion,
      springs,
      elevation: buildElevation(mode, colors),
    };
  }, [mode]);

  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);

  if (!theme) {
    throw new Error("useTheme must be used inside a <ThemeProvider />.");
  }

  return theme;
}

/**
 * Builds themed styles once per theme rather than once per render.
 *
 * Define the factory at module scope — an inline arrow is a new function on
 * every render and would defeat the memo.
 */
export function useThemedStyles<T>(factory: (theme: Theme) => T): T {
  const theme = useTheme();

  return useMemo(() => factory(theme), [factory, theme]);
}

export { motion, radius, spacing, springs, typography, TOUCH_TARGET };
export type { Palette };
