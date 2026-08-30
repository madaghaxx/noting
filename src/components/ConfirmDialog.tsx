import { useEffect, useRef } from "react";
import {
  Animated,
  BackHandler,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";

import AppText from "@/src/components/ui/AppText";
import Button from "@/src/components/ui/Button";
import Icon, { type IconName } from "@/src/components/ui/Icon";
import { useTheme } from "@/src/theme";
import { motion } from "@/src/theme/tokens";

export type ConfirmTone = "danger" | "neutral";

export type ConfirmRequest = {
  title: string;
  message?: string;
  /** The action being confirmed. Labelled with a verb, never "OK". */
  confirmLabel: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  icon?: IconName;
  onConfirm: () => void;
  onCancel?: () => void;
};

type Props = {
  request: ConfirmRequest | null;
  onDismiss: () => void;
};

/**
 * Noting's confirmation dialog.
 *
 * Replaces `Alert.alert`, which draws the platform's own dialog: on Android that
 * is a Material sheet with Material's blues, greys, ripple and corner radii, and
 * on a dark near-black notebook with a single violet accent it arrives like a
 * message from another application — bright, differently-shaped, and painful at
 * night, which is exactly when this app gets used.
 *
 * This one is built from the same tokens as everything else, so a destructive
 * confirmation looks like Noting asking a question rather than the OS interrupting.
 *
 * Rendered through `Modal` so it sits above every screen and the sidebar, and so
 * the platform still owns the hardware back button and the accessibility focus
 * trap — the parts of a native dialog that are worth keeping.
 */
export default function ConfirmDialog({ request, onDismiss }: Props) {
  const theme = useTheme();
  const { width } = useWindowDimensions();

  const presence = useRef(new Animated.Value(0)).current;

  const visible = request !== null;

  useEffect(() => {
    const animation = Animated.timing(presence, {
      toValue: visible ? 1 : 0,
      duration: visible ? motion.base : motion.instant,
      easing: visible ? Easing.out(Easing.back(1.2)) : Easing.in(Easing.quad),
      useNativeDriver: true,
    });

    animation.start();

    return () => animation.stop();
  }, [visible, presence]);

  // Back cancels, which is what a dialog's back button has always meant.
  useEffect(() => {
    if (!visible) return;

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        request?.onCancel?.();
        onDismiss();
        return true;
      },
    );

    return () => subscription.remove();
  }, [visible, request, onDismiss]);

  if (!request) return null;

  const tone = request.tone ?? "danger";
  const isDanger = tone === "danger";

  const accent = isDanger ? theme.colors.danger : theme.colors.accent;
  const halo = isDanger ? theme.colors.dangerSubtle : theme.colors.accentSubtle;

  const cancel = () => {
    request.onCancel?.();
    onDismiss();
  };

  const confirm = () => {
    // Dismiss first: the action may navigate, and a dialog animating out over a
    // screen that has already left reads as a glitch.
    onDismiss();
    request.onConfirm();
  };

  return (
    <Modal
      transparent
      visible
      animationType="none"
      statusBarTranslucent
      onRequestClose={cancel}
    >
      <View style={styles.root}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: "#000",
              opacity: presence.interpolate({
                inputRange: [0, 1],
                outputRange: [0, theme.mode === "dark" ? 0.66 : 0.4],
              }),
            },
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={cancel}
            accessibilityRole="button"
            accessibilityLabel={request.cancelLabel ?? "Cancel"}
          />
        </Animated.View>

        <Animated.View
          accessibilityViewIsModal
          style={[
            {
              width: Math.min(360, width - theme.spacing.xxl * 2),
              padding: theme.spacing.xl,
              gap: theme.spacing.md,
              borderRadius: theme.radius.xxl,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surfaceRaised,
              opacity: presence,
              transform: [
                {
                  scale: presence.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.92, 1],
                  }),
                },
              ],
            },
            theme.elevation(3),
          ]}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: theme.radius.full,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: halo,
            }}
          >
            <Icon name={request.icon ?? "trash"} size={20} color={accent} />
          </View>

          <AppText variant="heading">{request.title}</AppText>

          {request.message && (
            <AppText variant="body" tone="secondary">
              {request.message}
            </AppText>
          )}

          <View
            style={{
              flexDirection: "row",
              gap: theme.spacing.sm,
              marginTop: theme.spacing.sm,
            }}
          >
            {/* The app's own buttons, in the app's own variants — the dialog owns
                no button styling of its own. `danger` is already a tinted skin
                rather than a filled red one, which is what keeps a destructive
                confirmation from being the brightest thing on a dark screen while
                still being unmistakably the dangerous half of the pair. */}
            <Button
              label={request.cancelLabel ?? "Cancel"}
              variant="secondary"
              onPress={cancel}
              style={{ flex: 1 }}
            />

            <Button
              label={request.confirmLabel}
              variant={isDanger ? "danger" : "primary"}
              onPress={confirm}
              style={{ flex: 1 }}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
