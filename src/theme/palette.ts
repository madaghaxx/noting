/**
 * Color palettes.
 *
 * Dark is the primary design target; light is a full peer, not an afterthought.
 * Both are built from a low-chroma neutral ramp plus exactly one accent, so the
 * accent always means "this is the thing to act on".
 */

export type Palette = {
  /** Furthest back. The page itself. */
  background: string;
  /** Cards, inputs, anything sitting on the background. */
  surface: string;
  /** Sheets and surfaces that sit on top of another surface. */
  surfaceRaised: string;
  /** Pressed/hover feedback for surfaces. */
  surfacePressed: string;
  /** Faint fills — tag chips, icon backdrops. */
  surfaceSubtle: string;

  /** Hairline dividers and card edges. */
  border: string;
  /** Focused inputs, deliberate emphasis. */
  borderStrong: string;

  textPrimary: string;
  textSecondary: string;
  textTertiary: string;

  accent: string;
  /** Text/icons placed on top of a filled accent surface. */
  onAccent: string;
  /** Low-opacity accent wash for tinted backdrops. */
  accentSubtle: string;

  success: string;
  successSubtle: string;
  danger: string;
  dangerSubtle: string;
  favorite: string;

  /** Shadow color; effectively invisible in dark mode, where borders carry depth. */
  shadow: string;
};

export const darkPalette: Palette = {
  background: "#0A0A0C",
  surface: "#131316",
  surfaceRaised: "#1A1A1F",
  surfacePressed: "#202027",
  surfaceSubtle: "#17171B",

  border: "#25252B",
  borderStrong: "#35353D",

  textPrimary: "#F3F3F5",
  textSecondary: "#9E9EA9",
  textTertiary: "#66666F",

  accent: "#8E86F5",
  onAccent: "#0A0A0C",
  accentSubtle: "rgba(142, 134, 245, 0.13)",

  success: "#5FCF9E",
  successSubtle: "rgba(95, 207, 158, 0.13)",
  danger: "#F0787D",
  dangerSubtle: "rgba(240, 120, 125, 0.13)",
  favorite: "#E5B45C",

  shadow: "#000000",
};

export const lightPalette: Palette = {
  background: "#FAFAFB",
  surface: "#FFFFFF",
  surfaceRaised: "#FFFFFF",
  surfacePressed: "#F0F0F3",
  surfaceSubtle: "#F4F4F6",

  border: "#E7E7EB",
  borderStrong: "#D2D2D9",

  textPrimary: "#131316",
  textSecondary: "#5C5C66",
  textTertiary: "#90909B",

  accent: "#5B51D8",
  onAccent: "#FFFFFF",
  accentSubtle: "rgba(91, 81, 216, 0.09)",

  success: "#1C9A6A",
  successSubtle: "rgba(28, 154, 106, 0.10)",
  danger: "#D23A44",
  dangerSubtle: "rgba(210, 58, 68, 0.09)",
  favorite: "#C1881A",

  shadow: "#1A1A2E",
};
