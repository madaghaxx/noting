/**
 * A note as the rest of the app sees it: camelCase, real booleans, timestamps
 * as epoch milliseconds.
 */
export type Note = {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  /**
   * Manual sort key within a section. A float so reordering rewrites one row
   * rather than renumbering the list — see `moveNote` in the repository.
   */
  position: number;
  /**
   * When the note was moved to Recently Deleted, or null while it is live.
   *
   * Deleting is a soft delete: the row stays put and only this field changes, so
   * a restore returns the note with its id, position, pin and timestamps intact.
   * Nothing leaves the database until the user empties the trash.
   */
  deletedAt: number | null;
  createdAt: number;
  updatedAt: number;
};

/**
 * A note as SQLite hands it back. Kept separate from `Note` so snake_case column
 * names and integer booleans stop at the repository boundary instead of leaking
 * into the store and components.
 */
export type NoteRow = {
  id: string;
  title: string;
  content: string;
  is_pinned: number;
  position: number;
  deleted_at: number | null;
  created_at: number;
  updated_at: number;
};

/** The editable half of a note — what the editor produces. */
export type NoteDraft = {
  title: string;
  content: string;
};

/**
 * Which half of the list a note belongs to. Pinned notes always sort above
 * unpinned ones, and reordering is only ever valid within one section.
 */
export type NoteSection = "pinned" | "unpinned";

export function sectionOf(note: Note): NoteSection {
  return note.isPinned ? "pinned" : "unpinned";
}
