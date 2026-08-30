/**
 * Pinning, run against the app's real store, real repository and real migrations
 * on a real (in-memory) SQLite database.
 *
 * Covers what the pin feature promises: pinned notes sort above unpinned ones,
 * and manual order survives both within a section and across a pin/unpin round
 * trip. The tests share one notebook and run in order, so they read as a single
 * session rather than a set of isolated cases — the ordering bugs worth catching
 * only show up in sequences.
 */
import assert from "node:assert/strict";
import test from "node:test";

import * as repo from "@/src/db/repositories/notes-repository";
import { useNotesStore } from "@/src/store/notes-store";

const store = () => useNotesStore.getState();
const shown = (notes) => notes.map((note) => note.title);

/** What a cold reload would show — the order the in-memory list must agree with. */
const persisted = async () => shown(await repo.listNotes());

const byTitle = (title) => {
  const note = store().notes.find((candidate) => candidate.title === title);

  assert.ok(note, `no note titled ${title}`);

  return note;
};

const pin = (title) => store().togglePin(byTitle(title).id);

await store().load();

test("starts empty and ready", () => {
  assert.equal(store().status, "ready");
  assert.deepEqual(store().notes, []);
});

test("new notes land at the top of the unpinned section", async () => {
  for (const title of ["A", "B", "C"]) {
    assert.ok(await store().create({ title, content: `${title} body` }));
  }

  assert.deepEqual(shown(store().notes), ["C", "B", "A"]);
  assert.deepEqual(await persisted(), ["C", "B", "A"]);
});

test("pinning lifts a note above the unpinned notes", async () => {
  await pin("B");

  assert.equal(byTitle("B").isPinned, true);
  assert.deepEqual(shown(store().notes), ["B", "C", "A"]);
  assert.deepEqual(await persisted(), shown(store().notes));
});

test("pinning is not an edit, so it leaves updatedAt alone", async () => {
  const before = byTitle("A").updatedAt;

  await pin("A");
  await pin("A");

  assert.equal(byTitle("A").updatedAt, before);
});

test("pinned notes keep their manual order among themselves", async () => {
  // A sat below B while both were unpinned; pinning both must not reshuffle them.
  await pin("A");

  assert.deepEqual(shown(store().notes), ["B", "A", "C"]);
  assert.deepEqual(await persisted(), ["B", "A", "C"]);
});

test("unpinning drops a note back into its old place", async () => {
  await pin("B");

  // B belongs after C again — where it sat before it was ever pinned.
  assert.deepEqual(shown(store().notes), ["A", "C", "B"]);
  assert.deepEqual(await persisted(), ["A", "C", "B"]);
});

test("a pin/unpin round trip restores the original order exactly", async () => {
  await pin("A");

  const before = shown(store().notes);

  for (const title of before) await pin(title);
  for (const title of before) await pin(title);

  assert.deepEqual(shown(store().notes), before);
  assert.deepEqual(await persisted(), before);
});

test("reordering within a section persists", async () => {
  assert.deepEqual(shown(store().notes), ["C", "B", "A"]);

  await store().reorder(2, 0);

  assert.deepEqual(shown(store().notes), ["A", "C", "B"]);
  assert.deepEqual(await persisted(), ["A", "C", "B"]);
});

test("a drag that would cross the pin boundary is refused", async () => {
  await pin("C");

  const before = shown(store().notes);
  assert.deepEqual(before, ["C", "A", "B"]);

  // Index 0 is pinned, index 2 is not. Crossing is the pin button's job.
  await store().reorder(0, 2);

  assert.deepEqual(shown(store().notes), before);
  assert.deepEqual(await persisted(), before);
});

test("a drag survives a later pin", async () => {
  // Regression: `reorder` wrote the new position to SQLite but left the note in
  // memory carrying its old one, so the next local re-sort — pinning anything —
  // silently undid the drag on screen while the database disagreed.
  await store().load();

  for (const note of store().notes.filter((note) => note.isPinned)) {
    await store().togglePin(note.id);
  }

  await store().load();

  const [first, second, third] = shown(store().notes);

  await store().reorder(2, 0);
  assert.deepEqual(shown(store().notes), [third, first, second]);

  await pin(second);

  assert.deepEqual(shown(store().notes), [second, third, first]);
  assert.deepEqual(await persisted(), [second, third, first]);
});

test("an exhausted position gap renumbers only its own section", async () => {
  await store().load();

  const pinned = store().notes.filter((note) => note.isPinned).length;
  assert.equal(pinned, 1, "expected exactly one pinned note here");

  // Halve the same gap until the floats run out of room: always drop the last
  // unpinned note between the two above it.
  let exhausted = false;

  for (let attempt = 0; attempt < 40 && !exhausted; attempt++) {
    const unpinned = (await repo.listNotes()).filter((note) => !note.isPinned);

    ({ exhausted } = await repo.moveNote(
      unpinned[unpinned.length - 1].id,
      unpinned[0],
      unpinned[1],
    ));
  }

  assert.equal(exhausted, true, "the gap never reported exhaustion");

  const order = await persisted();

  await repo.rebalanceSection(false);

  assert.deepEqual(await persisted(), order, "renumbering changed the order");

  const positions = (await repo.listNotes())
    .filter((note) => !note.isPinned)
    .map((note) => note.position);

  assert.deepEqual(positions, [0, 1], "positions were not renumbered");
});

test("reset clears note contents from memory", () => {
  store().reset();

  assert.deepEqual(store().notes, []);
  assert.equal(store().status, "idle");
});
