import { useEffect, useRef } from "react";
import { Animated, View } from "react-native";

import BiometricBadge, {
  type BadgeState,
} from "@/src/components/BiometricBadge";
import LogoMark from "@/src/components/LogoMark";
import AppText from "@/src/components/ui/AppText";
import Button from "@/src/components/ui/Button";
import Screen from "@/src/components/ui/Screen";
import { useStaggeredEntrance } from "@/src/hooks/use-entrance";
import { cancelPending, describeKind } from "@/src/services/auth-service";
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
    probe();
  }, [probe]);

  // If this screen goes away mid-prompt, dismiss the system dialog rather than
  // leaving it orphaned on top of the app.
  useEffect(() => () => void cancelPending(), []);

  const biometric = describeKind(capability?.primary ?? null);
  const hasDevicePin = capability?.hasDeviceCredential ?? false;

  const isProbing = status === "probing";
  const isAuthenticating = status === "authenticating";
  const isDone = status === "unlocked";
  const isBlocked =
    status === "lockedOut" ||
    status === "notEnrolled" ||
    status === "unavailable";

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
        return `Waiting for your ${biometric}…`;
      case "unlocked":
        return "Unlocked.";
      default:
        return message ?? "Something needs your attention.";
    }
  })();

  const statusTone: StatusTone = isDone
    ? "success"
    : status === "failed" || isBlocked
      ? "danger"
      : "secondary";

  // Both actions open the same prompt. Because device-credential fallback stays
  // enabled inside it, unlocking still works when biometrics are unenrolled or
  // locked out — so the button is only truly dead with no screen lock at all.
  const canAttempt = hasDevicePin || !isBlocked;

  return (
    <Screen>
      <View style={{ flex: 1, paddingHorizontal: theme.spacing.xxl }}>
        <Animated.View
          style={[
            entrance[0],
            { alignItems: "center", paddingTop: theme.spacing.xxl },
          ]}
        >
          <LogoMark />
        </Animated.View>

        <Animated.View
          style={[
            entrance[1],
            { alignItems: "center", marginTop: theme.spacing.xl },
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
          <BiometricBadge state={badgeState} />
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
          <Button
            label="Unlock Noting"
            icon="fingerprint"
            size="lg"
            fullWidth
            loading={isAuthenticating}
            disabled={isDone || isProbing || !canAttempt}
            onPress={authenticate}
          />

          {/* Never more than a ghost button — the primary action should always
              look like the intended one. */}
          {isBlocked && !hasDevicePin ? (
            <Button
              label="Check again"
              variant="ghost"
              size="sm"
              fullWidth
              disabled={isProbing}
              onPress={probe}
            />
          ) : (
            <Button
              label="Use passcode"
              variant="ghost"
              size="sm"
              fullWidth
              disabled={isDone || isProbing || isAuthenticating}
              onPress={authenticate}
            />
          )}
        </Animated.View>

        <Animated.View
          style={[
            entrance[5],
            {
              alignItems: "center",
              paddingTop: theme.spacing.xl,
              paddingBottom: theme.spacing.lg,
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
