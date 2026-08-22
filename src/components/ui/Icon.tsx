import { StyleSheet, View } from "react-native";

import { useTheme } from "@/src/theme";

export type IconName =
  | "fingerprint"
  | "face"
  | "lock"
  | "plus"
  | "check"
  | "chevronLeft"
  | "chevronRight"
  | "alert"
  | "pin"
  | "menu"
  | "list"
  | "notes"
  | "trash"
  | "image"
  | "sliders"
  | "restore"
  | "close"
  | "key";

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  /** Stroke weight. Scales with `size` by default so icons stay proportional. */
  strokeWidth?: number;
  /** Only meaningful for `pin`, where it marks the pinned state. */
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

    case "chevronRight":
      return (
        <View style={[styles.center, box]}>
          <View
            style={{
              width: size * 0.32,
              height: size * 0.32,
              marginRight: -size * 0.06,
              borderRightWidth: stroke,
              borderTopWidth: stroke,
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
     * A thumbtack seen side-on: a pill cap, a short collar, then a needle that
     * tapers to a point. Upright rather than tilted, so it stays optically
     * aligned with the other icons.
     *
     * `filled` solidifies the cap and changes nothing else, so the two states
     * occupy identical space and the row cannot shift when the state flips.
     *
     * The cap takes a thinner stroke than the rest of the set on purpose: at the
     * 20pt size the list uses, the shared weight is more than half the cap's
     * height, and the outline would fill itself in — leaving pinned and unpinned
     * distinguishable only by colour.
     */
    case "pin": {
      const capHeight = size * 0.26;
      const capStroke = Math.max(1.4, size * 0.075);

      return (
        <View style={[styles.center, box]}>
          <View style={styles.center}>
            <View
              style={{
                width: size * 0.54,
                height: capHeight,
                borderRadius: capHeight,
                borderWidth: filled ? 0 : capStroke,
                borderColor: tint,
                backgroundColor: filled ? tint : "transparent",
              }}
            />

            <View
              style={{
                width: size * 0.17,
                height: size * 0.07,
                backgroundColor: tint,
              }}
            />

            {/* A border-only View: the two transparent sides bevel the coloured
                top edge into a triangle, which no combination of radii can do. */}
            <View
              style={{
                width: 0,
                height: 0,
                borderLeftWidth: size * 0.07,
                borderRightWidth: size * 0.07,
                borderTopWidth: size * 0.3,
                borderLeftColor: "transparent",
                borderRightColor: "transparent",
                borderTopColor: tint,
              }}
            />
          </View>
        </View>
      );
    }

    /**
     * Face unlock: a rounded frame with two eyes and a mouth, deliberately
     * abstract. Drawn as a frame with its middle edges removed, which is the
     * bracket shape both platforms use for face authentication.
     */
    case "face": {
      const corner = size * 0.3;

      return (
        <View style={[styles.center, box]}>
          {[
            { top: 0, left: 0, borderTopWidth: stroke, borderLeftWidth: stroke },
            {
              top: 0,
              right: 0,
              borderTopWidth: stroke,
              borderRightWidth: stroke,
            },
            {
              bottom: 0,
              left: 0,
              borderBottomWidth: stroke,
              borderLeftWidth: stroke,
            },
            {
              bottom: 0,
              right: 0,
              borderBottomWidth: stroke,
              borderRightWidth: stroke,
            },
          ].map((edges, index) => (
            <View
              key={index}
              style={{
                position: "absolute",
                width: corner,
                height: corner,
                borderColor: tint,
                borderRadius: size * 0.12,
                ...edges,
              }}
            />
          ))}

          {/* Eyes. */}
          {[-1, 1].map((side) => (
            <View
              key={side}
              style={{
                position: "absolute",
                top: size * 0.36,
                left: size * 0.5 + side * size * 0.16 - stroke / 2,
                width: stroke,
                height: size * 0.12,
                borderRadius: stroke,
                backgroundColor: tint,
              }}
            />
          ))}

          {/* Mouth. */}
          <View
            style={{
              position: "absolute",
              bottom: size * 0.28,
              width: size * 0.26,
              height: stroke,
              borderRadius: stroke,
              backgroundColor: tint,
            }}
          />
        </View>
      );
    }

    /** Three bars. The one icon whose meaning is entirely conventional. */
    case "menu":
      return (
        <View style={[styles.center, box, { gap: size * 0.17 }]}>
          {[0, 1, 2].map((index) => (
            <View
              key={index}
              style={{
                width: size * 0.66,
                height: stroke,
                borderRadius: stroke,
                backgroundColor: tint,
              }}
            />
          ))}
        </View>
      );

    /** A bulleted list: three rules, each with its own dot. */
    case "list":
      return (
        <View style={[styles.center, box, { gap: size * 0.16 }]}>
          {[0, 1, 2].map((index) => (
            <View
              key={index}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: size * 0.14,
              }}
            >
              <View
                style={{
                  width: stroke * 1.4,
                  height: stroke * 1.4,
                  borderRadius: stroke,
                  backgroundColor: tint,
                }}
              />

              <View
                style={{
                  width: size * 0.54,
                  height: stroke,
                  borderRadius: stroke,
                  backgroundColor: tint,
                }}
              />
            </View>
          ))}
        </View>
      );

    /** A page with ruled lines: the notebook itself. */
    case "notes":
      return (
        <View style={[styles.center, box]}>
          <View
            style={{
              width: size * 0.74,
              height: size * 0.78,
              borderRadius: size * 0.16,
              borderWidth: stroke,
              borderColor: tint,
              paddingHorizontal: size * 0.13,
              justifyContent: "center",
              gap: size * 0.13,
            }}
          >
            {[0.86, 0.86, 0.5].map((width, index) => (
              <View
                key={index}
                style={{
                  width: `${width * 100}%`,
                  height: stroke * 0.85,
                  borderRadius: stroke,
                  backgroundColor: tint,
                }}
              />
            ))}
          </View>
        </View>
      );

    /** A bin: lid, handle, body. The body's lines keep it from reading as a cup. */
    case "trash":
      return (
        <View style={[styles.center, box]}>
          <View style={{ alignItems: "center" }}>
            {/* Handle. */}
            <View
              style={{
                width: size * 0.28,
                height: stroke * 1.6,
                borderTopLeftRadius: stroke,
                borderTopRightRadius: stroke,
                backgroundColor: tint,
              }}
            />

            {/* Lid. */}
            <View
              style={{
                width: size * 0.74,
                height: stroke,
                borderRadius: stroke,
                marginTop: size * 0.04,
                backgroundColor: tint,
              }}
            />

            {/* Body, slightly narrower than the lid so it reads as tapered. */}
            <View
              style={{
                width: size * 0.58,
                height: size * 0.52,
                marginTop: size * 0.04,
                borderWidth: stroke,
                borderTopWidth: 0,
                borderColor: tint,
                borderBottomLeftRadius: size * 0.1,
                borderBottomRightRadius: size * 0.1,
                flexDirection: "row",
                justifyContent: "center",
                gap: size * 0.12,
                paddingTop: size * 0.08,
              }}
            >
              {[0, 1].map((index) => (
                <View
                  key={index}
                  style={{
                    width: stroke * 0.8,
                    height: size * 0.26,
                    borderRadius: stroke,
                    backgroundColor: tint,
                  }}
                />
              ))}
            </View>
          </View>
        </View>
      );

    /** A framed picture: horizon, sun, and a peak breaking the baseline. */
    case "image":
      return (
        <View style={[styles.center, box]}>
          <View
            style={{
              width: size * 0.82,
              height: size * 0.68,
              borderRadius: size * 0.16,
              borderWidth: stroke,
              borderColor: tint,
              overflow: "hidden",
              justifyContent: "flex-end",
            }}
          >
            <View
              style={{
                position: "absolute",
                top: size * 0.1,
                left: size * 0.1,
                width: size * 0.13,
                height: size * 0.13,
                borderRadius: size,
                backgroundColor: tint,
              }}
            />

            <View
              style={{
                alignSelf: "center",
                marginBottom: -stroke,
                width: 0,
                height: 0,
                borderLeftWidth: size * 0.2,
                borderRightWidth: size * 0.2,
                borderBottomWidth: size * 0.26,
                borderLeftColor: "transparent",
                borderRightColor: "transparent",
                borderBottomColor: tint,
              }}
            />
          </View>
        </View>
      );

    /** Sliders. Settings as adjustment rather than as machinery. */
    case "sliders":
      return (
        <View style={[styles.center, box, { gap: size * 0.19 }]}>
          {[0.62, 0.34, 0.5].map((knobAt, index) => (
            <View key={index} style={{ justifyContent: "center" }}>
              <View
                style={{
                  width: size * 0.78,
                  height: stroke,
                  borderRadius: stroke,
                  backgroundColor: tint,
                }}
              />

              <View
                style={{
                  position: "absolute",
                  left: size * 0.78 * knobAt - size * 0.075,
                  width: size * 0.15,
                  height: size * 0.15,
                  borderRadius: size,
                  borderWidth: stroke,
                  borderColor: tint,
                  backgroundColor: theme.colors.background,
                }}
              />
            </View>
          ))}
        </View>
      );

    /** An arrow lifting out of a tray: bring this back. */
    case "restore":
      return (
        <View style={[styles.center, box]}>
          <View style={{ alignItems: "center" }}>
            <View
              style={{
                width: 0,
                height: 0,
                borderLeftWidth: size * 0.19,
                borderRightWidth: size * 0.19,
                borderBottomWidth: size * 0.26,
                borderLeftColor: "transparent",
                borderRightColor: "transparent",
                borderBottomColor: tint,
              }}
            />

            <View
              style={{
                width: stroke * 1.3,
                height: size * 0.2,
                backgroundColor: tint,
              }}
            />

            <View
              style={{
                width: size * 0.7,
                height: size * 0.22,
                marginTop: size * 0.06,
                borderWidth: stroke,
                borderTopWidth: 0,
                borderColor: tint,
                borderBottomLeftRadius: size * 0.1,
                borderBottomRightRadius: size * 0.1,
              }}
            />
          </View>
        </View>
      );

    case "close":
      return (
        <View style={[styles.center, box]}>
          {["45deg", "-45deg"].map((rotate) => (
            <View
              key={rotate}
              style={{
                position: "absolute",
                width: size * 0.62,
                height: stroke,
                borderRadius: stroke,
                backgroundColor: tint,
                transform: [{ rotate }],
              }}
            />
          ))}
        </View>
      );

    /** A key: ring and shaft with two teeth. Stands for the passcode. */
    case "key":
      return (
        <View style={[styles.center, box]}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View
              style={{
                width: size * 0.42,
                height: size * 0.42,
                borderRadius: size,
                borderWidth: stroke,
                borderColor: tint,
              }}
            />

            <View style={{ justifyContent: "center" }}>
              <View
                style={{
                  width: size * 0.42,
                  height: stroke,
                  borderTopRightRadius: stroke,
                  borderBottomRightRadius: stroke,
                  backgroundColor: tint,
                }}
              />

              {[0.12, 0.28].map((left) => (
                <View
                  key={left}
                  style={{
                    position: "absolute",
                    top: stroke,
                    left: size * left,
                    width: stroke,
                    height: size * 0.14,
                    borderRadius: stroke,
                    backgroundColor: tint,
                  }}
                />
              ))}
            </View>
          </View>
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
