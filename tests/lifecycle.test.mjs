/**
 * What a change in app lifecycle does to the lock.
 *
 * The rule that matters most is the one that looks like an omission: the app must
 * *not* react while authentication is in flight. The platform's own PIN screen is a
 * separate activity, so it takes Noting out of the foreground — and an app that
 * locks on that event locks itself out of the unlock it just started, forever.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { decideForAppState } from "@/src/services/lifecycle";

const unlocked = { isUnlocked: true, isAuthenticating: false };
const locked = { isUnlocked: false, isAuthenticating: false };
const authenticating = { isUnlocked: false, isAuthenticating: true };

test("leaving the foreground locks an unlocked app", () => {
  assert.equal(decideForAppState("background", unlocked), "lock");
});

test("the transitional state covers the screen without locking", () => {
  // This is when the app switcher's thumbnail is taken, and it is also what a
  // notification shade or an incoming call produces — which the app may come
  // straight back from.
  assert.equal(decideForAppState("inactive", unlocked), "shield");
});

test("coming back uncovers the screen", () => {
  assert.equal(decideForAppState("active", unlocked), "reveal");
  assert.equal(decideForAppState("active", locked), "reveal");
});

test("nothing happens to the lock while authenticating", () => {
  // Every state, because the platform's credential screen can produce any of them.
  for (const state of ["background", "inactive", "active", "unknown"]) {
    assert.equal(
      decideForAppState(state, authenticating),
      "ignore",
      `${state} interfered with authentication`,
    );
  }
});

test("authenticating takes priority even when the app is unlocked", () => {
  // Re-authenticating from inside the app — a passcode change, say — must not be
  // interrupted either.
  assert.equal(
    decideForAppState("background", { isUnlocked: true, isAuthenticating: true }),
    "ignore",
  );
});

test("an already-locked app has nothing to lock or hide", () => {
  assert.equal(decideForAppState("background", locked), "ignore");
  assert.equal(decideForAppState("inactive", locked), "ignore");
});

test("an unrecognised state is treated as leaving the foreground", () => {
  // Guessing wrong this way costs an unlock. Guessing wrong the other way shows
  // someone's notes in the app switcher.
  assert.equal(decideForAppState("unknown", unlocked), "shield");
  assert.equal(decideForAppState("extension", unlocked), "shield");
});

test("a background-to-active round trip ends up locked and revealed", () => {
  // The sequence a phone actually produces when the user leaves and comes back.
  const sequence = ["inactive", "background", "active"];
  const decisions = [];

  let state = { isUnlocked: true, isAuthenticating: false };

  for (const next of sequence) {
    const decision = decideForAppState(next, state);
    decisions.push(decision);

    if (decision === "lock") state = { ...state, isUnlocked: false };
  }

  assert.deepEqual(decisions, ["shield", "lock", "reveal"]);
  assert.equal(state.isUnlocked, false, "the app came back still unlocked");
});
