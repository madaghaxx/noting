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

function toNote(row: NoteRow): Note {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    isPinned: row.is_pinned === 1,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listNotes(): Promise<Note[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<NoteRow>(
    `SELECT * FROM notes ${ORDER_BY}`,
  );

  return rows.map(toNote);
}

export async function createNote(draft: NoteDraft): Promise<Note> {
  const db = await getDatabase();
  const now = Date.now();

  // New notes land at the top of the unpinned section, so the next free slot is
  // one step below the first unpinned note. Scoped to unpinned deliberately —
  // using the global minimum would place it relative to pinned notes it will
  // never sit among.
  const head = await db.getFirstAsync<{ min: number | null }>(
    "SELECT MIN(position) AS min FROM notes WHERE is_pinned = 0",
  );

  const note: Note = {
    id: createId(),
    title: draft.title.trim(),
    content: draft.content,
    isPinned: false,
    position: (head?.min ?? 0) - POSITION_STEP,
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
    "UPDATE notes SET title = ?, content = ?, updated_at = ? WHERE id = ?",
    draft.title.trim(),
    draft.content,
    updatedAt,
    id,
  );

  return updatedAt;
}

export async function deleteNote(id: string): Promise<void> {
  const db = await getDatabase();

  await db.runAsync("DELETE FROM notes WHERE id = ?", id);
}

/**
 * Puts a deleted note back exactly as it was, including its id, position and
 * timestamps — so undo restores the note to its old place in the list rather
 * than creating a copy at the top.
 */
export async function restoreNote(note: Note): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `INSERT OR REPLACE INTO notes (id, title, content, is_pinned, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    note.id,
    note.title,
    note.content,
    note.isPinned ? 1 : 0,
    note.position,
    note.createdAt,
    note.updatedAt,
  );
}

export async function setPinned(
  id: string,
  isPinned: boolean,
): Promise<void> {
  const db = await getDatabase();

  // `updated_at` is intentionally left alone: pinning is not an edit, and
  // bumping it would misreport when the note was last written.
  await db.runAsync(
    "UPDATE notes SET is_pinned = ? WHERE id = ?",
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
 *
 * Returns true when the gap just split was already at the precision floor,
 * meaning the caller should follow up with `rebalanceSection`.
 */
export async function moveNote(
  id: string,
  before: Note | null,
  after: Note | null,
): Promise<boolean> {
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

  return (
    !!before &&
    !!after &&
    Math.abs(after.position - before.position) < MIN_POSITION_GAP
  );
}

/**
 * Renumbers one section to 0, 1, 2, … restoring full gaps between its notes.
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
