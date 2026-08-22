/**
 * Recently Deleted: soft delete, undo, restore and permanent deletion, against
 * the app's real store, repository and migrations on a real in-memory database.
 *
 * The emphasis is on the two things that would hurt if they were wrong — a note
 * coming back somewhere other than where it left, and anything being destroyed
 * without being asked for twice.
 */
import assert from "node:assert/strict";
import test from "node:test";

import * as repo from "@/src/db/repositories/notes-repository";
import { getDatabase } from "@/src/db/database";
import { useNotesStore } from "@/src/store/notes-store";

const store = () => useNotesStore.getState();
const shown = (notes) => notes.map((note) => note.title);

const live = async () => shown(await repo.listNotes());
const trashed = async () => shown(await repo.listDeletedNotes());

const byTitle = (title) => {
  const note = [...store().notes, ...store().deleted].find(
    (candidate) => candidate.title === title,
  );

  assert.ok(note, `no note titled ${title}`);

  return note;
};

async function seed(...titles) {
  for (const title of titles) {
    assert.ok(await store().create({ title, content: `${title} body` }));
  }
}

await store().load();
await seed("A", "B", "C", "D");

test("seeded notes are all live, newest first", async () => {
  assert.deepEqual(shown(store().notes), ["D", "C", "B", "A"]);
  assert.deepEqual(await live(), ["D", "C", "B", "A"]);
  assert.deepEqual(store().deleted, []);
});

test("deleting moves a note to the trash and out of the list", async () => {
  await store().remove(byTitle("C").id);

  assert.deepEqual(shown(store().notes), ["D", "B", "A"]);
  assert.deepEqual(shown(store().deleted), ["C"]);

  assert.deepEqual(await live(), ["D", "B", "A"]);
  assert.deepEqual(await trashed(), ["C"]);
});

test("the deleted note keeps a deletion timestamp", async () => {
  const note = byTitle("C");

  assert.equal(typeof note.deletedAt, "number");
  assert.ok(note.deletedAt <= Date.now());

  // The optimistic timestamp is replaced by the one the write actually stored.
  const [stored] = await repo.listDeletedNotes();
  assert.equal(stored.deletedAt, note.deletedAt);
});

test("nothing was destroyed — the row is still there", async () => {
  const [stored] = await repo.listDeletedNotes();

  assert.equal(stored.id, byTitle("C").id);
  assert.equal(stored.content, "C body");
  assert.equal(stored.createdAt, byTitle("C").createdAt);
});

test("undo puts the note back exactly where it was", async () => {
  await store().undoRemove();

  assert.deepEqual(shown(store().notes), ["D", "C", "B", "A"]);
  assert.deepEqual(await live(), ["D", "C", "B", "A"]);
  assert.deepEqual(await trashed(), []);
  assert.equal(store().pendingDeletion, null);
  assert.equal(byTitle("C").deletedAt, null);
});

test("undo with nothing pending is a no-op", async () => {
  const before = shown(store().notes);

  await store().undoRemove();

  assert.deepEqual(shown(store().notes), before);
});

/** Deletions are timestamped in milliseconds, so ordering needs a real gap. */
const tick = () => new Promise((resolve) => setTimeout(resolve, 2));

test("the trash is newest-deleted first", async () => {
  await store().remove(byTitle("A").id);
  await tick();
  await store().remove(byTitle("D").id);
  await tick();
  await store().remove(byTitle("B").id);

  assert.deepEqual(shown(store().notes), ["C"]);
  assert.deepEqual(shown(store().deleted), ["B", "D", "A"]);
  assert.deepEqual(await trashed(), ["B", "D", "A"]);
});

test("deletions sharing a millisecond fall back to list order", async () => {
  // Two notes deleted inside the same millisecond is rare from a person and
  // ordinary from a loop. Forced here rather than raced for, using the app's own
  // connection, so the tie-break is actually exercised instead of hoped for.
  const db = await getDatabase();
  const [first, second] = await repo.listDeletedNotes();

  await db.runAsync(
    "UPDATE notes SET deleted_at = ? WHERE id IN (?, ?)",
    Date.now(),
    first.id,
    second.id,
  );

  const tied = (await repo.listDeletedNotes()).slice(0, 2);

  assert.ok(
    tied[0].position < tied[1].position,
    "tied deletions came back in an undefined order",
  );

  // Put the distinct timestamps back so the rest of the file reads normally.
  await db.runAsync(
    "UPDATE notes SET deleted_at = ? WHERE id = ?",
    first.deletedAt,
    first.id,
  );
  await db.runAsync(
    "UPDATE notes SET deleted_at = ? WHERE id = ?",
    second.deletedAt,
    second.id,
  );

  await store().loadDeleted();
  assert.deepEqual(shown(store().deleted), ["B", "D", "A"]);
});

test("the in-memory trash matches what a reload would show", async () => {
  const inMemory = shown(store().deleted);

  await store().loadDeleted();

  assert.deepEqual(shown(store().deleted), inMemory);
});

test("restoring from the trash returns the note to its old place", async () => {
  await store().restore(byTitle("D").id);

  // D sat above C before it was deleted, and that is where it comes back.
  assert.deepEqual(shown(store().notes), ["D", "C"]);
  assert.deepEqual(await live(), ["D", "C"]);
  assert.deepEqual(shown(store().deleted), ["B", "A"]);
});

test("deleting a pinned note and restoring it keeps it pinned", async () => {
  await store().togglePin(byTitle("C").id);
  assert.equal(byTitle("C").isPinned, true);
  assert.deepEqual(shown(store().notes), ["C", "D"]);

  await store().remove(byTitle("C").id);
  assert.deepEqual(shown(store().notes), ["D"]);

  await store().restore(byTitle("C").id);

  assert.equal(byTitle("C").isPinned, true);
  assert.deepEqual(shown(store().notes), ["C", "D"]);
  assert.deepEqual(await live(), ["C", "D"]);
});

test("deleting the same note twice does not rewrite its deletion time", async () => {
  const target = store().notes.find((note) => !note.isPinned);
  assert.ok(target, "need a live unpinned note");

  await store().remove(target.id);

  const read = async () =>
    (await repo.listDeletedNotes()).find((note) => note.id === target.id)
      .deletedAt;

  const first = await read();

  await tick();

  // The store already dropped it from the live list, so a second delete finds
  // nothing to move — but the repository is guarded independently of the store.
  await repo.softDeleteNote(target.id);

  assert.equal(await read(), first);
});

test("a live note cannot be destroyed, even by calling purge directly", async () => {
  const liveNote = store().notes[0];

  await repo.purgeNote(liveNote.id);
  await store().purge(liveNote.id);

  assert.ok(
    (await live()).includes(liveNote.title),
    "a live note was destroyed",
  );
});

/** Set by the purge test and checked by the one after it. */
let purgedTitle = null;

test("purging destroys one note and leaves the rest of the trash", async () => {
  await store().loadDeleted();
  const before = shown(store().deleted);
  assert.ok(before.length > 1, "need more than one note in the trash");

  const victim = byTitle(before[0]);
  purgedTitle = victim.title;
  const liveBefore = await live();

  await store().purge(victim.id);

  assert.deepEqual(shown(store().deleted), before.slice(1));
  assert.deepEqual(await trashed(), before.slice(1));
  assert.deepEqual(await live(), liveBefore, "purging touched the live list");
});

test("a purged note is gone from both lists for good", async () => {
  assert.ok(purgedTitle, "the purge test did not run");

  assert.ok(!(await trashed()).includes(purgedTitle));
  assert.ok(!(await live()).includes(purgedTitle));

  // And it cannot be brought back: restore only knows notes in the trash.
  await store().restore(purgedTitle);

  assert.ok(!(await live()).includes(purgedTitle));
});

test("editing is scoped to live notes", async () => {
  await store().loadDeleted();
  const trashedNote = store().deleted[0];

  await repo.updateNote(trashedNote.id, { title: "rewritten", content: "x" });

  const [after] = (await repo.listDeletedNotes()).filter(
    (note) => note.id === trashedNote.id,
  );

  assert.equal(after.title, trashedNote.title);
  assert.equal(after.content, trashedNote.content);
});

test("pinning is scoped to live notes", async () => {
  const trashedNote = store().deleted[0];

  await repo.setPinned(trashedNote.id, true);

  const [after] = (await repo.listDeletedNotes()).filter(
    (note) => note.id === trashedNote.id,
  );

  assert.equal(after.isPinned, trashedNote.isPinned);
});

test("a new note never collides with a deleted note's position", async () => {
  await seed("collide-1", "collide-2");
  await store().load();

  // The lowest unpinned note is the one whose position a new note is placed
  // below, so deleting it is what would let a new note reuse that slot.
  const unpinned = store().notes.filter((note) => !note.isPinned);
  const lowest = unpinned[unpinned.length - 1];
  assert.ok(lowest, "need a live unpinned note");

  await store().remove(lowest.id);
  await seed("fresh");
  await store().restore(lowest.id);

  const rows = [...(await repo.listNotes()), ...(await repo.listDeletedNotes())];
  const positions = rows.map((note) => note.position);

  assert.equal(
    new Set(positions).size,
    positions.length,
    "two notes share a position, so pinning either one makes their order undefined",
  );

  // And the order is still what the in-memory list believes it is.
  assert.deepEqual(await live(), shown(store().notes));
});

test("pinning a note created after a delete cannot make the order ambiguous", async () => {
  // The failure this guards against: a new note takes a position a pinned note
  // already holds, nothing looks wrong while it is unpinned, and pinning it puts
  // two notes on one position — where SQLite's order and the in-memory sort are
  // free to disagree.
  await store().load();

  const fresh = store().notes[0];
  await store().togglePin(fresh.id);

  assert.deepEqual(await live(), shown(store().notes));

  const pinned = (await repo.listNotes()).filter((note) => note.isPinned);
  const positions = pinned.map((note) => note.position);

  assert.equal(
    new Set(positions).size,
    positions.length,
    "two pinned notes share a position",
  );

  await store().togglePin(fresh.id);
});

test("emptying the trash leaves live notes alone", async () => {
  await store().loadDeleted();
  assert.ok(store().deleted.length > 0, "need something in the trash");

  const liveBefore = await live();

  await store().purgeAll();

  assert.deepEqual(store().deleted, []);
  assert.deepEqual(await trashed(), []);
  assert.deepEqual(await live(), liveBefore);
});

test("reset clears the trash as well as the list", async () => {
  await store().remove(store().notes[0].id);
  assert.ok(store().deleted.length > 0);

  store().reset();

  assert.deepEqual(store().notes, []);
  assert.deepEqual(store().deleted, []);
});
