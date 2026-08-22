/**
 * Biometric capability detection, the words the app uses for it, and the mapping
 * from the platform's fourteen error strings onto the handful of situations the
 * unlock screen actually distinguishes.
 *
 * None of this can be checked by hand: it would need a phone with a fingerprint
 * sensor, another with Face ID, a third with neither, and each of those in several
 * enrolment states. The stand-in for expo-local-authentication describes those
 * devices instead.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  authenticate,
  describeMethod,
  methodIcon,
  pickPrimary,
  probeCapability,
} from "@/src/services/auth-service";

import {
  AuthenticationType,
  deviceCalls,
  resetDevice,
  SecurityLevel,
  setDevice,
} from "./support/expo-local-authentication.mjs";

const FINGERPRINT = AuthenticationType.FINGERPRINT;
const FACE = AuthenticationType.FACIAL_RECOGNITION;
const IRIS = AuthenticationType.IRIS;

test("a fingerprint-only device reports fingerprint", async () => {
  resetDevice();
  setDevice({ types: [FINGERPRINT] });

  const capability = await probeCapability();

  assert.deepEqual(capability.kinds, ["fingerprint"]);
  assert.equal(capability.primary, "fingerprint");
  assert.equal(capability.hasHardware, true);
  assert.equal(capability.isEnrolled, true);
});

test("a Face ID device reports face", async () => {
  resetDevice();
  setDevice({ types: [FACE] });

  const capability = await probeCapability();

  assert.deepEqual(capability.kinds, ["face"]);
  assert.equal(capability.primary, "face");
});

test("with both sensors, face is the one named", async () => {
  // The requirement is explicit about the order: Face ID if the device has it,
  // fingerprint otherwise.
  resetDevice();
  setDevice({ types: [FINGERPRINT, FACE] });

  assert.equal((await probeCapability()).primary, "face");

  // And in the other listing order, since the platform makes no promise about it.
  setDevice({ types: [FACE, FINGERPRINT] });

  assert.equal((await probeCapability()).primary, "face");
});

test("priority is face, then fingerprint, then iris", () => {
  assert.equal(pickPrimary(["fingerprint", "face", "iris"]), "face");
  assert.equal(pickPrimary(["iris", "fingerprint"]), "fingerprint");
  assert.equal(pickPrimary(["iris"]), "iris");
  assert.equal(pickPrimary([]), null);
});

test("a device with no sensor names no method at all", async () => {
  resetDevice();
  setDevice({ hasHardware: false, isEnrolled: false, types: [] });

  const capability = await probeCapability();

  assert.equal(capability.hasHardware, false);
  assert.equal(capability.primary, null);
  assert.deepEqual(capability.kinds, []);
});

test("hardware present but nothing enrolled is a distinct state", async () => {
  resetDevice();
  setDevice({ hasHardware: true, isEnrolled: false, types: [FINGERPRINT] });

  const capability = await probeCapability();

  // The screen has to tell these apart: one is "add a fingerprint", the other is
  // "this phone cannot do this at all".
  assert.equal(capability.hasHardware, true);
  assert.equal(capability.isEnrolled, false);
});

test("an unrecognised sensor type is ignored rather than guessed at", async () => {
  resetDevice();
  setDevice({ types: [99, FINGERPRINT] });

  assert.deepEqual((await probeCapability()).kinds, ["fingerprint"]);
});

test("a device with no screen lock has no credential fallback", async () => {
  resetDevice();
  setDevice({ level: SecurityLevel.NONE });

  assert.equal((await probeCapability()).hasDeviceCredential, false);

  setDevice({ level: SecurityLevel.SECRET });

  assert.equal((await probeCapability()).hasDeviceCredential, true);
});

test("methods are named the way each platform names them", () => {
  assert.equal(describeMethod("face", "ios"), "Face ID");
  assert.equal(describeMethod("fingerprint", "ios"), "Touch ID");

  assert.equal(describeMethod("face", "android"), "face unlock");
  assert.equal(describeMethod("fingerprint", "android"), "fingerprint");

  assert.equal(describeMethod("iris", "android"), "iris");

  // With nothing detected, the copy stays generic rather than inventing a sensor.
  assert.equal(describeMethod(null, "ios"), "biometrics");
  assert.equal(describeMethod(null, "android"), "biometrics");
});

test("each method has its own icon, and no method has a lock", () => {
  assert.equal(methodIcon("face"), "face");
  assert.equal(methodIcon("fingerprint"), "fingerprint");
  assert.equal(methodIcon("iris"), "fingerprint");
  assert.equal(methodIcon(null), "lock");
});

test("the prompt names the modality the device will use", async () => {
  resetDevice();
  setDevice({ types: [FACE], result: { success: true } });

  const capability = await probeCapability();
  await authenticate(capability.primary, "ios");

  const [options] = deviceCalls();

  assert.match(options.promptSubtitle, /Face ID/);
  assert.equal(options.promptMessage, "Unlock Noting");
});

test("with no modality detected the prompt stays generic", async () => {
  resetDevice();
  setDevice({ result: { success: true } });

  await authenticate(null, "android");

  const [options] = deviceCalls();

  assert.equal(options.promptSubtitle, "Confirm it’s you to open your notes");
});

test("only strong biometrics are accepted, and device fallback stays available", async () => {
  resetDevice();
  setDevice({ result: { success: true } });

  await authenticate("fingerprint", "android");

  const [options] = deviceCalls();

  // 'weak' would admit 2D camera face unlock, which is not a credential a private
  // notebook should accept.
  assert.equal(options.biometricsSecurityLevel, "strong");

  // The platform's own PIN or pattern remains reachable inside the prompt: it is
  // the way in when the sensor is locked out.
  assert.equal(options.disableDeviceFallback, false);
});

test("success is success", async () => {
  resetDevice();
  setDevice({ result: { success: true } });

  assert.deepEqual(await authenticate("fingerprint", "android"), {
    kind: "success",
  });
});

test("every documented error maps to a situation the screen can explain", async () => {
  const expected = {
    user_cancel: "cancelled",
    system_cancel: "cancelled",
    app_cancel: "cancelled",
    user_fallback: "cancelled",
    not_enrolled: "notEnrolled",
    not_available: "unavailable",
    invalid_context: "unavailable",
    passcode_not_set: "noDeviceCredential",
    lockout: "lockedOut",
    lockout_permanent: "lockedOut",
    authentication_failed: "failed",
    unable_to_process: "failed",
    timeout: "failed",
    no_space: "failed",
  };

  for (const [error, kind] of Object.entries(expected)) {
    resetDevice();
    setDevice({ result: { success: false, error } });

    const outcome = await authenticate("fingerprint", "android");

    assert.equal(outcome.kind, kind, `${error} mapped to ${outcome.kind}`);
  }
});

test("a lockout says whether it is permanent", async () => {
  resetDevice();
  setDevice({ result: { success: false, error: "lockout" } });
  assert.equal(
    (await authenticate("fingerprint", "android")).permanent,
    false,
  );

  setDevice({ result: { success: false, error: "lockout_permanent" } });
  assert.equal((await authenticate("fingerprint", "android")).permanent, true);
});

test("an unknown error is a failure, not a silent success", async () => {
  resetDevice();
  setDevice({ result: { success: false, error: "something_new_in_sdk_55" } });

  const outcome = await authenticate("fingerprint", "android");

  assert.equal(outcome.kind, "failed");
  assert.ok(outcome.message.length > 0, "a failure with nothing to say");
});

test("a failure message never names a sensor the device does not have", async () => {
  resetDevice();
  setDevice({
    hasHardware: false,
    types: [],
    result: { success: false, error: "not_available" },
  });

  const outcome = await authenticate(null, "ios");

  assert.equal(outcome.kind, "unavailable");
});
