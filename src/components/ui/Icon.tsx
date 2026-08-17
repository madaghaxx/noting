import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/src/theme";

export type IconName =
  | "fingerprint"
  | "lock"
  | "plus"
  | "check"
  | "chevronLeft"
  | "alert"
  | "star";

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  /** Stroke weight. Scales with `size` by default so icons stay proportional. */
  strokeWidth?: number;
  /** Only meaningful for `star`. */
  filled?: boolean;
};

/**
 * Icons drawn from primitives rather than a font or SVG library.
 *
 * The app has no icon dependency, and these shapes are simple enough that
 * borders and transforms express them exactly — which also means they inherit
 * theme colors and scale without assets.
 */
export default function Icon({
  name,
  size = 24,
  color,
  strokeWidth,
  filled = false,
}: Props) {
  const theme = useTheme();

  const tint = color ?? theme.colors.textPrimary;
  const stroke = strokeWidth ?? Math.max(1.5, size * 0.085);

  const box = { width: size, height: size };

  switch (name) {
    /**
     * Concentric rings with their base removed. The open bottoms read as
     * fingerprint ridges — a complete circle would read as a target instead.
     */
    case "fingerprint": {
      const rings = [1, 0.72, 0.44];

      return (
        <View style={[styles.center, box]}>
          {rings.map((scale) => (
            <View
              key={scale}
              style={{
                position: "absolute",
                width: size * scale,
                height: size * scale,
                borderRadius: size,
                borderWidth: stroke,
                borderColor: tint,
                borderBottomColor: "transparent",
              }}
            />
          ))}

          <View
            style={{
              position: "absolute",
              top: size * 0.46,
              width: stroke,
              height: size * 0.17,
              borderRadius: stroke,
              backgroundColor: tint,
            }}
          />
        </View>
      );
    }

    case "lock":
      return (
        <View style={[styles.center, box]}>
          <View style={styles.center}>
            {/* Shackle: a ring with its lower half dropped. */}
            <View
              style={{
                width: size * 0.46,
                height: size * 0.3,
                borderWidth: stroke,
                borderBottomWidth: 0,
                borderColor: tint,
                borderTopLeftRadius: size,
                borderTopRightRadius: size,
              }}
            />

            <View
              style={{
                width: size * 0.72,
                height: size * 0.46,
                marginTop: -stroke / 2,
                borderRadius: size * 0.14,
                borderWidth: stroke,
                borderColor: tint,
              }}
            />
          </View>
        </View>
      );

    case "plus":
      return (
        <View style={[styles.center, box]}>
          <View
            style={{
              position: "absolute",
              width: size * 0.6,
              height: stroke,
              borderRadius: stroke,
              backgroundColor: tint,
            }}
          />
          <View
            style={{
              position: "absolute",
              width: stroke,
              height: size * 0.6,
              borderRadius: stroke,
              backgroundColor: tint,
            }}
          />
        </View>
      );

    /** Two borders of a box, rotated — the classic two-stroke tick. */
    case "check":
      return (
        <View style={[styles.center, box]}>
          <View
            style={{
              width: size * 0.46,
              height: size * 0.24,
              marginTop: -size * 0.08,
              borderLeftWidth: stroke,
              borderBottomWidth: stroke,
              borderColor: tint,
              transform: [{ rotate: "-45deg" }],
            }}
          />
        </View>
      );

    case "chevronLeft":
      return (
        <View style={[styles.center, box]}>
          <View
            style={{
              width: size * 0.32,
              height: size * 0.32,
              marginLeft: -size * 0.06,
              borderLeftWidth: stroke,
              borderBottomWidth: stroke,
              borderColor: tint,
              transform: [{ rotate: "45deg" }],
            }}
          />
        </View>
      );

    case "alert":
      return (
        <View style={[styles.center, box]}>
          <View
            style={{
              position: "absolute",
              width: size,
              height: size,
              borderRadius: size,
              borderWidth: stroke,
              borderColor: tint,
            }}
          />
          <View
            style={{
              position: "absolute",
              top: size * 0.24,
              width: stroke,
              height: size * 0.3,
              borderRadius: stroke,
              backgroundColor: tint,
            }}
          />
          <View
            style={{
              position: "absolute",
              bottom: size * 0.22,
              width: stroke * 1.2,
              height: stroke * 1.2,
              borderRadius: stroke,
              backgroundColor: tint,
            }}
          />
        </View>
      );

    /**
     * The one glyph icon. A five-pointed star needs curves and angles that
     * borders cannot express, and the typographic form is cleaner than any
     * approximation built from Views.
     */
    case "star":
      return (
        <View style={[styles.center, box]}>
          <Text
            style={{
              fontSize: size * 0.95,
              color: tint,
              includeFontPadding: false,
              textAlign: "center",
            }}
            allowFontScaling={false}
          >
            {filled ? "★" : "☆"}
          </Text>
        </View>
      );
  }
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
});
