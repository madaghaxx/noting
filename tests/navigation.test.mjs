/**
 * The sidebar's contents and its notion of "where am I".
 *
 * Both are plain data in `src/navigation/destinations.ts` precisely so they can be
 * checked without a renderer — these assertions are the spec for what the panel
 * must offer and which row lights up.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  activeDestination,
  DESTINATIONS,
} from "@/src/navigation/destinations";

test("the sidebar offers every required destination, in order", () => {
  assert.deepEqual(
    DESTINATIONS.map((destination) => destination.key),
    ["all", "pinned", "trash", "images", "settings"],
  );

  assert.deepEqual(
    DESTINATIONS.map((destination) => destination.label),
    [
      "All Notes",
      "Pinned",
      "Recently Deleted",
      "Favorite Images",
      "Settings",
    ],
  );
});

test("each destination is its own route", () => {
  const paths = DESTINATIONS.map((destination) => destination.pathname);

  assert.equal(
    new Set(paths).size,
    paths.length,
    "two rows navigate to the same place",
  );
});

test("every destination has an icon, and only counted ones have a badge", () => {
  for (const destination of DESTINATIONS) {
    assert.ok(destination.icon, `${destination.key} has no icon`);

    if (destination.badge) {
      assert.ok(
        ["notes", "pinned", "deleted"].includes(destination.badge),
        `${destination.key} counts something the sidebar cannot read`,
      );
    }
  }

  // Images has nothing to count yet, and Settings is not a collection.
  assert.equal(
    DESTINATIONS.find((d) => d.key === "images").badge,
    undefined,
  );
  assert.equal(
    DESTINATIONS.find((d) => d.key === "settings").badge,
    undefined,
  );
});

test("the highlighted row follows the route on screen", () => {
  assert.equal(activeDestination("/"), "all");
  assert.equal(activeDestination("/pinned"), "pinned");
  assert.equal(activeDestination("/trash"), "trash");
  assert.equal(activeDestination("/images"), "images");
  assert.equal(activeDestination("/settings"), "settings");
});

test("the editor keeps the notes row highlighted", () => {
  // Opening a note is a push out of the list, not a change of destination. A
  // sidebar with nothing selected reads as though the app lost its place.
  assert.equal(activeDestination("/note/abc123"), "all");
  assert.equal(activeDestination("/note/new"), "all");
});

test("an unknown route falls back to the notes list", () => {
  assert.equal(activeDestination(""), "all");
  assert.equal(activeDestination("/somewhere-else"), "all");
});

test("every destination the sidebar renders can be resolved back", () => {
  // Guards against adding a row whose pathname `activeDestination` cannot map,
  // which would leave that screen with no row highlighted.
  for (const destination of DESTINATIONS) {
    assert.equal(
      activeDestination(destination.pathname),
      destination.key,
      `${destination.pathname} does not resolve to ${destination.key}`,
    );
  }
});
