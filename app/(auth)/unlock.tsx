import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Platform, View } from "react-native";

import BiometricBadge, {
  type BadgeState,
} from "@/src/components/BiometricBadge";
import Keypad from "@/src/components/Keypad";
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
import { MAX_LENGTH, MIN_LENGTH } from "@/src/services/passcode-service";
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
  const hasPasscode = useAuthStore((state) => state.hasPasscode);
  const checkingPasscode = useAuthStore((state) => state.checkingPasscode);
  const probe = useAuthStore((state) => state.probe);
  const authenticate = useAuthStore((state) => state.authenticate);
  const submitPasscode = useAuthStore((state) => state.submitPasscode);

  const entrance = useStaggeredEntrance(6);

  /** The passcode keypad replaces the badge and buttons while it is open. */
  const [entering, setEntering] = useState(false);
  const [code, setCode] = useState("");
  const [rejectedAt, setRejectedAt] = useState<number | null>(null);

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
  const hasDevicePin = capability?.hasDeviceCredential ?? false;

  /**
   * Offer biometrics only where they can actually work.
   *
   * The device-credential fallback lives inside the system prompt, so the button
   * still leads somewhere useful when the sensor is locked out — but on a device
   * with no sensor and no screen lock at all, it leads nowhere and is not shown.
   */
  const offerBiometrics = hasBiometrics || (hasDevicePin && !biometricsBlocked);

  // Try the sensor as soon as the screen settles. Nobody opens a locked notebook
  // in order to look at the lock.
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current || entering) return;
    if (status !== "locked" || !hasBiometrics) return;

    attempted.current = true;
    authenticate();
  }, [status, hasBiometrics, entering, authenticate]);

  const handleSubmit = useCallback(async () => {
    const accepted = await submitPasscode(code);

    if (!accepted) {
      setRejectedAt(Date.now());
      setCode("");
    }
  }, [code, submitPasscode]);

  const badgeState: BadgeState = isAuthenticating
    ? "busy"
    : isDone
      ? "success"
      : status === "failed" || status === "lockedOut"
        ? "error"
        : "idle";

  const statusText = (() => {
    if (isDone) return "Unlocked.";

    if (entering) {
      return message ?? "Enter your passcode.";
    }

    switch (status) {
      case "probing":
        return "Checking this device…";
      case "locked":
        return hasBiometrics
          ? "Ready when you are."
          : hasPasscode
            ? "Enter your passcode to continue."
            : "Ready when you are.";
      case "authenticating":
        return `Waiting for your ${methodName}…`;
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

          {!entering && (
            <AppText
              variant="bodyLarge"
              tone="secondary"
              center
              style={{ marginTop: theme.spacing.xs }}
            >
              Your thoughts. Private by design.
            </AppText>
          )}
        </Animated.View>

        {entering ? (
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              paddingTop: theme.spacing.xl,
            }}
          >
            <Animated.View
              style={[entrance[3], { minHeight: 46, justifyContent: "center" }]}
            >
              <StatusLine text={statusText} tone={statusTone} />
            </Animated.View>

            <View style={{ marginTop: theme.spacing.xl }}>
              <Keypad
                value={code}
                onChange={setCode}
                onSubmit={handleSubmit}
                minLength={MIN_LENGTH}
                maxLength={MAX_LENGTH}
                busy={checkingPasscode}
                errorAt={rejectedAt}
                disabled={isDone}
              />
            </View>

            <View
              style={{
                gap: theme.spacing.sm,
                marginTop: theme.spacing.xxl,
              }}
            >
              {/* Only shown once the code is long enough to be worth checking —
                  a fixed-length code submits itself on the last digit. */}
              {code.length >= MIN_LENGTH && code.length < MAX_LENGTH && (
                <Button
                  label="Unlock"
                  size="lg"
                  fullWidth
                  loading={checkingPasscode}
                  disabled={isDone}
                  onPress={handleSubmit}
                />
              )}

              {offerBiometrics && (
                <Button
                  label={`Use ${methodName} instead`}
                  icon={methodIcon(method)}
                  variant="ghost"
                  size="sm"
                  fullWidth
                  disabled={isDone || checkingPasscode}
                  onPress={() => {
                    setCode("");
                    setEntering(false);
                    authenticate();
                  }}
                />
              )}
            </View>
          </View>
        ) : (
          <>
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
              {/* The device decides which sensor its prompt uses, so the button
                  names the one this device leads with rather than promising a
                  choice the app cannot make. */}
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

              {hasPasscode ? (
                <Button
                  label="Use passcode"
                  icon="key"
                  variant={offerBiometrics ? "ghost" : "primary"}
                  size={offerBiometrics ? "sm" : "lg"}
                  fullWidth
                  disabled={isDone || isProbing}
                  onPress={() => {
                    void cancelPending();
                    setCode("");
                    setRejectedAt(null);
                    setEntering(true);
                  }}
                />
              ) : (
                // Nothing else to offer: re-probing is the only useful action when
                // the device's own security settings may have changed.
                !offerBiometrics && (
                  <Button
                    label="Check again"
                    variant="ghost"
                    size="sm"
                    fullWidth
                    disabled={isProbing}
                    onPress={() => probe(Platform.OS)}
                  />
                )
              )}
            </Animated.View>
          </>
        )}

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
