import type { Note, NoteDraft, NoteRow } from "@/src/types/note";
import { createId } from "@/src/utils/id";

import { getDatabase } from "../database";

/** Gap left between neighbouring notes, giving drops somewhere to land. */
const POSITION_STEP = 1;

/**
 * Once two neighbours are this close, halving the gap again starts losing
 * precision, so the section needs renumbering.
 */
const MIN_POSITION_GAP = 0.000001;

/**
 * Canonical ordering: pinned above unpinned, manual order within each section.
 *
 * `is_pinned DESC` puts 1 before 0. Because the flag dominates the sort, pinning
 * a note moves it to the top section without rewriting its position — which is
 * what preserves its place relative to the other pinned notes.
 */
const ORDER_BY = "ORDER BY is_pinned DESC, position ASC";

/**
 * Deleting is soft, so every query about the notebook has to say which half of
 * the table it means. Nothing here selects across both.
 */
const LIVE = "deleted_at IS NULL";
const TRASHED = "deleted_at IS NOT NULL";

/** What a move wrote, and whether the section it landed in needs renumbering. */
export type MoveResult = {
  /**
   * The position given to the moved note. Callers hold notes in memory and must
   * mirror this — a stale position would re-sort the note back to where it was
   * the next time the list is ordered locally.
   */
  position: number;
  /**
   * True when the gap just split was already at the precision floor, meaning
   * the caller should follow up with `rebalanceSection`.
   */
  exhausted: boolean;
};

function toNote(row: NoteRow): Note {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    isPinned: row.is_pinned === 1,
    position: row.position,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listNotes(): Promise<Note[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<NoteRow>(
    `SELECT * FROM notes WHERE ${LIVE} ${ORDER_BY}`,
  );

  return rows.map(toNote);
}

/**
 * Recently Deleted, most recently deleted first.
 *
 * `position` breaks ties: two notes deleted inside the same millisecond are rare
 * from a person but ordinary from a loop, and without a tie-break their order in
 * the trash would be whatever SQLite happened to return.
 */
export async function listDeletedNotes(): Promise<Note[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<NoteRow>(
    `SELECT * FROM notes WHERE ${TRASHED} ORDER BY deleted_at DESC, position ASC`,
  );

  return rows.map(toNote);
}

export async function createNote(draft: NoteDraft): Promise<Note> {
  const db = await getDatabase();
  const now = Date.now();

  // New notes go to the top, so the next free slot is one step below every
  // position already in use.
  //
  // Deliberately unscoped. Taking the minimum of the *unpinned* notes alone
  // would be enough to place the note correctly, but it hands out positions that
  // pinned notes may already hold — and the moment such a note is pinned, two
  // notes in one section share a position, where the order between them is
  // whatever SQLite and the in-memory sort each happen to decide.
  //
  // Deleted notes count too: one may be restored later, and it comes back with
  // the position it left with.
  const head = await db.getFirstAsync<{ min: number | null }>(
    "SELECT MIN(position) AS min FROM notes",
  );

  const note: Note = {
    id: createId(),
    title: draft.title.trim(),
    content: draft.content,
    isPinned: false,
    position: (head?.min ?? 0) - POSITION_STEP,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.runAsync(
    `INSERT INTO notes (id, title, content, is_pinned, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    note.id,
    note.title,
    note.content,
    0,
    note.position,
    note.createdAt,
    note.updatedAt,
  );

  return note;
}

/** Saves an edit and returns the timestamp written, so callers can mirror it. */
export async function updateNote(
  id: string,
  draft: NoteDraft,
): Promise<number> {
  const db = await getDatabase();
  const updatedAt = Date.now();

  await db.runAsync(
    `UPDATE notes SET title = ?, content = ?, updated_at = ?
     WHERE id = ? AND ${LIVE}`,
    draft.title.trim(),
    draft.content,
    updatedAt,
    id,
  );

  return updatedAt;
}

/**
 * Moves a note to Recently Deleted and returns the deletion time, so callers can
 * mirror it without a second read.
 *
 * Nothing is destroyed here. The row keeps its id, content, position and pin
 * state; only `deleted_at` changes, which is what lets `restoreDeletedNote` put
 * the note back exactly where it was.
 */
export async function softDeleteNote(id: string): Promise<number> {
  const db = await getDatabase();
  const deletedAt = Date.now();

  // Guarded on LIVE so deleting twice cannot rewrite the original deletion time
  // and quietly move the note to the top of the trash.
  await db.runAsync(
    `UPDATE notes SET deleted_at = ? WHERE id = ? AND ${LIVE}`,
    deletedAt,
    id,
  );

  return deletedAt;
}

/** Brings a note back out of Recently Deleted, exactly as it was. */
export async function restoreDeletedNote(id: string): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `UPDATE notes SET deleted_at = NULL WHERE id = ? AND ${TRASHED}`,
    id,
  );
}

/**
 * The only call in the app that actually destroys a note.
 *
 * Guarded on TRASHED: a note has to be in Recently Deleted before it can be
 * erased, so no code path — or bug — can turn a single tap on a live note into
 * permanent data loss.
 */
export async function purgeNote(id: string): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(`DELETE FROM notes WHERE id = ? AND ${TRASHED}`, id);
}

/** Empties Recently Deleted. Live notes are untouchable from here. */
export async function purgeAllDeleted(): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(`DELETE FROM notes WHERE ${TRASHED}`);
}

export async function setPinned(
  id: string,
  isPinned: boolean,
): Promise<void> {
  const db = await getDatabase();

  // `updated_at` is intentionally left alone: pinning is not an edit, and
  // bumping it would misreport when the note was last written.
  //
  // LIVE-guarded because a note in the trash has no place in either section;
  // pinning it would only decide where it reappears if it were restored.
  await db.runAsync(
    `UPDATE notes SET is_pinned = ? WHERE id = ? AND ${LIVE}`,
    isPinned ? 1 : 0,
    id,
  );
}

/**
 * Drops a note between two neighbours, either of which may be null at a
 * section's edge.
 *
 * Positions are floats specifically so this touches exactly one row: the note
 * takes the midpoint of the gap it landed in. With integer positions every drag
 * would renumber every row below the drop point.
 *
 * Callers must pass neighbours from the *same* section — pinned and unpinned
 * notes never interleave, so a cross-section midpoint would be meaningless.
 */
export async function moveNote(
  id: string,
  before: Note | null,
  after: Note | null,
): Promise<MoveResult> {
  const db = await getDatabase();

  let position: number;

  if (before && after) {
    position = (before.position + after.position) / 2;
  } else if (after) {
    position = after.position - POSITION_STEP;
  } else if (before) {
    position = before.position + POSITION_STEP;
  } else {
    position = 0;
  }

  await db.runAsync(
    "UPDATE notes SET position = ? WHERE id = ?",
    position,
    id,
  );

  return {
    position,
    exhausted:
      !!before &&
      !!after &&
      Math.abs(after.position - before.position) < MIN_POSITION_GAP,
  };
}

/**
 * Renumbers one section to 0, 1, 2, … restoring full gaps between its notes.
 *
 * Deleted notes are renumbered along with the live ones, in their existing
 * relative order. They are invisible to the list, but they still hold positions,
 * and a restore has to land them somewhere sensible without colliding.
 *
 * Runs in a single transaction so the list is never observed half-renumbered.
 */
export async function rebalanceSection(isPinned: boolean): Promise<void> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<{ id: string }>(
    "SELECT id FROM notes WHERE is_pinned = ? ORDER BY position ASC",
    isPinned ? 1 : 0,
  );

  await db.withExclusiveTransactionAsync(async (txn) => {
    for (let index = 0; index < rows.length; index++) {
      await txn.runAsync(
        "UPDATE notes SET position = ? WHERE id = ?",
        index * POSITION_STEP,
        rows[index].id,
      );
    }
  });
}
