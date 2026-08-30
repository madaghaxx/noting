/**
 * The confirmation queue behind `ConfirmDialog`.
 *
 * Worth testing rather than eyeballing, because the promise is the part that can
 * strand a caller: a question that is replaced, or dropped on lock, must still
 * resolve — and it must resolve to `false`, since every confirmation in the app
 * guards something destructive.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { confirm, useConfirmStore } from "@/src/store/confirm-store";

const store = () => useConfirmStore.getState();

const OPTIONS = {
  title: "Delete forever?",
  message: "This cannot be undone.",
  confirmLabel: "Delete forever",
};

test("asking opens a dialog with the options it was given", () => {
  const answer = confirm(OPTIONS);

  const request = store().request;

  assert.ok(request, "no dialog was opened");
  assert.equal(request.title, OPTIONS.title);
  assert.equal(request.message, OPTIONS.message);
  assert.equal(request.confirmLabel, OPTIONS.confirmLabel);

  // Tidy up, and prove the promise is live.
  request.onCancel();
  store().dismiss();

  return answer;
});

test("confirming resolves true", async () => {
  const answer = confirm(OPTIONS);

  store().request.onConfirm();
  store().dismiss();

  assert.equal(await answer, true);
  assert.equal(store().request, null);
});

test("cancelling resolves false", async () => {
  const answer = confirm(OPTIONS);

  store().request.onCancel();
  store().dismiss();

  assert.equal(await answer, false);
});

test("a question asked while one is open answers the first with no", async () => {
  const first = confirm({ ...OPTIONS, title: "First" });
  const second = confirm({ ...OPTIONS, title: "Second" });

  // The first caller must not be left awaiting a promise that never settles.
  assert.equal(await first, false);

  assert.equal(store().request.title, "Second");

  store().request.onConfirm();
  store().dismiss();

  assert.equal(await second, true);
});

test("cancelPending answers an open question and closes it", async () => {
  const answer = confirm(OPTIONS);

  store().cancelPending();

  assert.equal(await answer, false, "locking stranded the caller");
  assert.equal(store().request, null);
});

test("cancelPending with nothing open is a no-op", () => {
  store().cancelPending();

  assert.equal(store().request, null);
});

test("locking closes any open dialog", async () => {
  // A dialog renders in its own window, above the React tree, so the privacy
  // shield cannot cover it — and the message may be quoting a note's title.
  const { lockEverything } = await import("@/src/store/lock");

  const answer = confirm({ ...OPTIONS, message: "“Private note” will be gone." });

  lockEverything();

  assert.equal(await answer, false);
  assert.equal(store().request, null, "a note title stayed on screen after lock");
});
