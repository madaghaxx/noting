import { useEffect, useRef } from "react";
import { Animated, Platform, View } from "react-native";

import BiometricBadge, {
  type BadgeState,
} from "@/src/components/BiometricBadge";
import LogoMark from "@/src/components/LogoMark";
import AppText from "@/src/components/ui/AppText";
import Button from "@/src/components/ui/Button";
import Screen from "@/src/components/ui/Screen";
import { useStaggeredEntrance } from "@/src/hooks/use-entrance";
import {
  cancelPending,
  describeMethod,
  methodIcon,
} from "@/src/services/auth-service";
import { useAuthStore } from "@/src/store/auth-store";
import { useTheme } from "@/src/theme";
import { motion } from "@/src/theme/tokens";

type StatusTone = "secondary" | "danger" | "success";

/**
 * Crossfades whenever its text changes, so moving between authentication states
 * reads as one line rewriting itself rather than content being swapped out.
 */
function StatusLine({ text, tone }: { text: string; tone: StatusTone }) {
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fade.setValue(0);

    Animated.timing(fade, {
      toValue: 1,
      duration: motion.base,
      useNativeDriver: true,
    }).start();
  }, [text, fade]);

  return (
    <Animated.View style={{ opacity: fade }}>
      <AppText variant="body" tone={tone} center>
        {text}
      </AppText>
    </Animated.View>
  );
}

export default function UnlockScreen() {
  const theme = useTheme();

  const status = useAuthStore((state) => state.status);
  const message = useAuthStore((state) => state.message);
  const capability = useAuthStore((state) => state.capability);
  const probe = useAuthStore((state) => state.probe);
  const authenticate = useAuthStore((state) => state.authenticate);

  const entrance = useStaggeredEntrance(6);

  // Find out what this device can do before offering anything, so the screen
  // never advertises a sensor that isn't there.
  useEffect(() => {
    probe(Platform.OS);
  }, [probe]);

  // If this screen goes away mid-prompt, dismiss the system dialog rather than
  // leaving it orphaned on top of the app.
  useEffect(() => () => void cancelPending(), []);

  const isProbing = status === "probing";
  const isAuthenticating = status === "authenticating";
  const isDone = status === "unlocked";

  /** Biometrics cannot be attempted at all in these states. */
  const biometricsBlocked =
    status === "lockedOut" ||
    status === "notEnrolled" ||
    status === "unavailable";

  const hasBiometrics =
    (capability?.hasHardware ?? false) && (capability?.isEnrolled ?? false);

  const method = capability?.primary ?? null;
  const methodName = describeMethod(method, Platform.OS);
  /** Offer the prompt only where enrolled biometrics can actually work. */
  const offerBiometrics = hasBiometrics && !biometricsBlocked;

  // Try the sensor as soon as the screen settles. Nobody opens a locked notebook
  // in order to look at the lock.
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    if (status !== "locked" || !hasBiometrics) return;

    attempted.current = true;
    authenticate();
  }, [status, hasBiometrics, authenticate]);

  const badgeState: BadgeState = isAuthenticating
    ? "busy"
    : isDone
      ? "success"
      : status === "failed" || status === "lockedOut"
        ? "error"
        : "idle";

  const statusText = (() => {
    switch (status) {
      case "probing":
        return "Checking this device…";
      case "locked":
        return "Ready when you are.";
      case "authenticating":
        return `Waiting for your ${methodName}…`;
      case "unlocked":
        return "Unlocked.";
      default:
        return message ?? "Something needs your attention.";
    }
  })();

  const statusTone: StatusTone = isDone
    ? "success"
    : status === "failed" || biometricsBlocked
      ? "danger"
      : "secondary";

  return (
    <Screen>
      <View style={{ flex: 1, paddingHorizontal: theme.spacing.xxl }}>
        <Animated.View
          style={[
            entrance[0],
            { alignItems: "center", paddingTop: theme.spacing.xl },
          ]}
        >
          <LogoMark />
        </Animated.View>

        <Animated.View
          style={[
            entrance[1],
            { alignItems: "center", marginTop: theme.spacing.lg },
          ]}
        >
          <AppText variant="display">Noting</AppText>

          <AppText
            variant="bodyLarge"
            tone="secondary"
            center
            style={{ marginTop: theme.spacing.xs }}
          >
            Your thoughts. Private by design.
          </AppText>
        </Animated.View>

        <Animated.View
          style={[
            entrance[2],
            {
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              minHeight: 180,
            },
          ]}
        >
          <BiometricBadge state={badgeState} icon={methodIcon(method)} />
        </Animated.View>

        {/* Fixed height: the status line rewords constantly, and letting it
            resize would shift every control beneath it. */}
        <Animated.View
          style={[entrance[3], { minHeight: 46, justifyContent: "center" }]}
        >
          <StatusLine text={statusText} tone={statusTone} />
        </Animated.View>

        <Animated.View
          style={[
            entrance[4],
            { gap: theme.spacing.sm, marginTop: theme.spacing.md },
          ]}
        >
          {/* The device decides which sensor its prompt uses, so the button names
              the one this device leads with rather than promising a choice the app
              cannot make. */}
          {offerBiometrics && (
            <Button
              label={`Unlock with ${methodName}`}
              icon={methodIcon(method)}
              size="lg"
              fullWidth
              loading={isAuthenticating}
              disabled={isDone || isProbing}
              onPress={authenticate}
            />
          )}

          {/* Nothing left to offer: re-probing is the only useful action when the
              device's own security settings may have changed since it was checked. */}
          {!offerBiometrics && (
            <Button
              label="Check again"
              variant="ghost"
              size="sm"
              fullWidth
              disabled={isProbing}
              onPress={() => probe(Platform.OS)}
            />
          )}
        </Animated.View>

        <Animated.View
          style={[
            entrance[5],
            {
              alignItems: "center",
              paddingTop: theme.spacing.lg,
              paddingBottom: theme.spacing.md,
            },
          ]}
        >
          <AppText variant="caption" tone="tertiary" center>
            Your notes stay on this device.
          </AppText>
        </Animated.View>
      </View>
    </Screen>
  );
}
