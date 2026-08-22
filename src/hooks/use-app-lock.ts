import { useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { decideForAppState } from "@/src/services/lifecycle";
import { useAuthStore } from "@/src/store/auth-store";
import { lockEverything } from "@/src/store/lock";

/**
 * Relocks Noting when it leaves the foreground, and covers the screen while it is
 * on its way out.
 *
 * Returns whether the content should currently be hidden. The caller renders the
 * shield — this hook only decides.
 */
export function useAppLock(): boolean {
  const [shielded, setShielded] = useState(false);

  // Read through refs inside the listener rather than through the hook, so the
  // subscription is made once and never resubscribes on an unrelated state change.
  const isUnlocked = useAuthStore((state) => state.isUnlocked);
  const status = useAuthStore((state) => state.status);

  const context = useRef({ isUnlocked, isAuthenticating: false });

  context.current = {
    isUnlocked,
    isAuthenticating: status === "authenticating",
  };

  useEffect(() => {
    const handle = (next: AppStateStatus) => {
      switch (decideForAppState(next, context.current)) {
        case "lock":
          setShielded(true);
          lockEverything();
          return;

        case "shield":
          setShielded(true);
          return;

        case "reveal":
          setShielded(false);
          return;

        case "ignore":
          return;
      }
    };

    const subscription = AppState.addEventListener("change", handle);

    return () => subscription.remove();
  }, []);

  return shielded;
}
