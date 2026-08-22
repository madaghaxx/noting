import { useCallback, useEffect, useState } from "react";
import { Alert, Animated, View } from "react-native";
import { router } from "expo-router";

import Keypad from "@/src/components/Keypad";
import ScreenHeader from "@/src/components/ScreenHeader";
import AppText from "@/src/components/ui/AppText";
import Button from "@/src/components/ui/Button";
import Icon from "@/src/components/ui/Icon";
import Screen from "@/src/components/ui/Screen";
import { useStaggeredEntrance } from "@/src/hooks/use-entrance";
import {
  clearPasscode,
  hasPasscode as readHasPasscode,
  MAX_LENGTH,
  MIN_LENGTH,
  setPasscode,
  verifyPasscode,
} from "@/src/services/passcode-service";
import { useAuthStore } from "@/src/store/auth-store";
import { useTheme } from "@/src/theme";

/**
 * Creating, changing and removing the passcode.
 *
 * Three states in one screen, because they are one task: prove the old code if
 * there is one, choose a new one, then type it again. Each step only ever asks for
 * one thing, and the code being typed lives in this component's state for exactly
 * as long as the step it belongs to.
 */
type Step = "current" | "create" | "confirm";

export default function PasscodeScreen() {
  const theme = useTheme();

  const refreshPasscode = useAuthStore((state) => state.refreshPasscode);

  const [existing, setExisting] = useState<boolean | null>(null);
  const [step, setStep] = useState<Step>("create");
  const [code, setCode] = useState("");
  const [first, setFirst] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectedAt, setRejectedAt] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    readHasPasscode().then((value) => {
      if (!active) return;

      setExisting(value);
      setStep(value ? "current" : "create");
    });

    return () => {
      active = false;
    };
  }, []);

  const reject = useCallback((reason: string) => {
    setError(reason);
    setRejectedAt(Date.now());
    setCode("");
  }, []);

  const finish = useCallback(
    async (next: string) => {
      setBusy(true);

      try {
        await setPasscode(next);
        await refreshPasscode();

        setBusy(false);
        router.back();
      } catch {
        setBusy(false);
        // The message never repeats the code back.
        reject("That passcode could not be saved. Try a different one.");
        setStep("create");
        setFirst("");
      }
    },
    [refreshPasscode, reject],
  );

  const handleSubmit = useCallback(async () => {
    if (busy) return;

    if (step === "current") {
      setBusy(true);
      const accepted = await verifyPasscode(code);
      setBusy(false);

      if (!accepted) {
        reject("That isn’t your current passcode.");
        return;
      }

      setError(null);
      setCode("");
      setStep("create");
      return;
    }

    if (step === "create") {
      if (code.length < MIN_LENGTH) {
        reject(`A passcode needs at least ${MIN_LENGTH} digits.`);
        return;
      }

      setError(null);
      setFirst(code);
      setCode("");
      setStep("confirm");
      return;
    }

    if (code !== first) {
      reject("Those didn’t match. Start again.");
      setFirst("");
      setStep("create");
      return;
    }

    await finish(code);
  }, [busy, code, finish, first, reject, step]);

  const handleRemove = useCallback(() => {
    Alert.alert(
      "Remove passcode?",
      "Your notes will be protected by biometrics alone. If your device's sensor stops working, there will be no other way in.",
      [
        { text: "Keep passcode", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            await clearPasscode();
            await refreshPasscode();
            router.back();
          },
        },
      ],
    );
  }, [refreshPasscode]);

  const entrance = useStaggeredEntrance(2);

  const heading =
    step === "current"
      ? "Enter your current passcode"
      : step === "create"
        ? existing
          ? "Choose a new passcode"
          : "Choose a passcode"
        : "Enter it again";

  const detail =
    step === "confirm"
      ? "Both entries have to match."
      : `${MIN_LENGTH} to ${MAX_LENGTH} digits. It works alongside biometrics, not instead of them.`;

  return (
    <Screen>
      <Animated.View style={entrance[0]}>
        <ScreenHeader
          title={existing ? "Change passcode" : "Set a passcode"}
          leading={{
            icon: "chevronLeft",
            onPress: () => router.back(),
            label: "Back",
          }}
        />
      </Animated.View>

      <Animated.View
        style={[
          entrance[1],
          { flex: 1, justifyContent: "center", paddingBottom: theme.spacing.xl },
        ]}
      >
        <View
          style={{
            alignItems: "center",
            gap: theme.spacing.sm,
            paddingHorizontal: theme.spacing.xxl,
            marginBottom: theme.spacing.xxl,
          }}
        >
          <Icon name="key" size={26} color={theme.colors.accent} />

          <AppText variant="heading" center>
            {heading}
          </AppText>

          <AppText variant="body" tone={error ? "danger" : "tertiary"} center>
            {error ?? detail}
          </AppText>
        </View>

        <Keypad
          value={code}
          onChange={(next) => {
            setError(null);
            setCode(next);
          }}
          onSubmit={handleSubmit}
          minLength={MIN_LENGTH}
          maxLength={MAX_LENGTH}
          busy={busy}
          errorAt={rejectedAt}
        />

        <View
          style={{
            gap: theme.spacing.sm,
            paddingHorizontal: theme.spacing.xxl,
            marginTop: theme.spacing.xxl,
          }}
        >
          {code.length >= MIN_LENGTH && code.length < MAX_LENGTH && (
            <Button
              label={step === "confirm" ? "Save passcode" : "Continue"}
              size="lg"
              fullWidth
              loading={busy}
              onPress={handleSubmit}
            />
          )}

          {/* Only after the current code has been proved: removing the passcode is
              a change to how the app locks, so it needs the same evidence as
              setting one. */}
          {existing && step === "create" && (
            <Button
              label="Remove passcode instead"
              variant="danger"
              size="sm"
              fullWidth
              onPress={handleRemove}
            />
          )}
        </View>
      </Animated.View>
    </Screen>
  );
}
