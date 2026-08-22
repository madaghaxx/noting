import { create } from "zustand";

import * as repository from "@/src/db/repositories/notes-repository";
import type { Note, NoteDraft } from "@/src/types/note";

type Status = "idle" | "loading" | "ready" | "error";

/** A delete waiting on its undo window. */
type PendingDeletion = {
  note: Note;
  /** Where it sat in the list, so undo puts it back rather than on top. */
  index: number;
};

type NotesState = {
  notes: Note[];
  /** Recently Deleted, most recently deleted first. */
  deleted: Note[];
  status: Status;
  error: string | null;
  query: string;
  pendingDeletion: PendingDeletion | null;

  load: () => Promise<void>;
  loadDeleted: () => Promise<void>;
  create: (draft: NoteDraft) => Promise<Note | null>;
  update: (id: string, draft: NoteDraft) => Promise<void>;
  /** Moves a note to Recently Deleted. Nothing is destroyed. */
  remove: (id: string) => Promise<void>;
  undoRemove: () => Promise<void>;
  dismissDeletion: () => void;
  /** Brings a note back out of Recently Deleted. */
  restore: (id: string) => Promise<void>;
  /** Destroys one note for good. Only reachable from Recently Deleted. */
  purge: (id: string) => Promise<void>;
  /** Empties Recently Deleted. */
  purgeAll: () => Promise<void>;
  togglePin: (id: string) => Promise<void>;
  reorder: (from: number, to: number) => Promise<void>;
  setQuery: (query: string) => void;
  clearError: () => void;
  reset: () => void;
};

function describe(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Something went wrong reaching the database.";
}

/**
 * Mirrors the repository's `ORDER BY is_pinned DESC, position ASC` so local
 * re-sorts land exactly where a reload would put them. `sort` is stable in
 * Hermes, so equal keys keep their relative order.
 */
function compareNotes(a: Note, b: Note): number {
  if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;

  return a.position - b.position;
}

/** Mirrors `ORDER BY deleted_at DESC, position ASC` for the trash list. */
function compareDeleted(a: Note, b: Note): number {
  const gap = (b.deletedAt ?? 0) - (a.deletedAt ?? 0);

  return gap !== 0 ? gap : a.position - b.position;
}

/**
 * Owns the in-memory view of the notes table.
 *
 * Mutations are optimistic: state changes first so the UI answers the gesture
 * immediately, and the previous list is restored if the write fails. The store
 * never touches SQL — that stays behind the repository.
 */
export const useNotesStore = create<NotesState>((set, get) => ({
  notes: [],
  deleted: [],
  status: "idle",
  error: null,
  query: "",
  pendingDeletion: null,

  load: async () => {
    set({ status: "loading", error: null });

    try {
      const notes = await repository.listNotes();
      set({ notes, status: "ready" });
    } catch (error) {
      set({ status: "error", error: describe(error) });
    }
  },

  /**
   * Read separately from `load`, and only by the screen that shows it: the trash
   * is the one list whose contents the home screen never needs, and loading it
   * eagerly would keep deleted note bodies in memory for no reason.
   */
  loadDeleted: async () => {
    try {
      set({ deleted: await repository.listDeletedNotes(), error: null });
    } catch (error) {
      set({ error: describe(error) });
    }
  },

  create: async (draft) => {
    try {
      const note = await repository.createNote(draft);

      set((state) => ({
        notes: [...state.notes, note].sort(compareNotes),
        error: null,
      }));

      return note;
    } catch (error) {
      set({ error: describe(error) });
      return null;
    }
  },

  update: async (id, draft) => {
    try {
      const updatedAt = await repository.updateNote(id, draft);

      set((state) => ({
        notes: state.notes.map((note) =>
          note.id === id
            ? {
                ...note,
                title: draft.title.trim(),
                content: draft.content,
                updatedAt,
              }
            : note,
        ),
        error: null,
      }));
    } catch (error) {
      set({ error: describe(error) });
    }
  },

  /**
   * Moves a note to Recently Deleted, and remembers where it sat so undo can put
   * it back rather than on top.
   *
   * The row itself never leaves SQLite — only its `deleted_at` is written — so a
   * note recovered from the trash is indistinguishable from one that was never
   * deleted, and an app killed mid-undo-window loses nothing.
   */
  remove: async (id) => {
    const previousNotes = get().notes;
    const previousDeleted = get().deleted;
    const index = previousNotes.findIndex((note) => note.id === id);
    const note = previousNotes[index];

    if (!note) return;

    // Optimistic: the row leaves the list and joins the trash on this frame. The
    // timestamp is provisional and gets replaced by the one the write returns.
    const deletedAt = Date.now();

    set({
      notes: previousNotes.filter((candidate) => candidate.id !== id),
      deleted: [{ ...note, deletedAt }, ...previousDeleted],
      pendingDeletion: { note, index },
      error: null,
    });

    try {
      const written = await repository.softDeleteNote(id);

      set((state) => ({
        deleted: state.deleted
          .map((candidate) =>
            candidate.id === id
              ? { ...candidate, deletedAt: written }
              : candidate,
          )
          .sort(compareDeleted),
      }));
    } catch (error) {
      set({
        notes: previousNotes,
        deleted: previousDeleted,
        pendingDeletion: null,
        error: describe(error),
      });
    }
  },

  undoRemove: async () => {
    const pending = get().pendingDeletion;

    if (!pending) return;

    set({ pendingDeletion: null });

    await get().restore(pending.note.id);
  },

  dismissDeletion: () => set({ pendingDeletion: null }),

  /**
   * Brings a note back out of Recently Deleted.
   *
   * It returns to the section and position it left with, so restoring is the
   * exact inverse of deleting — including whether it was pinned.
   */
  restore: async (id) => {
    const previousNotes = get().notes;
    const previousDeleted = get().deleted;
    const note = previousDeleted.find((candidate) => candidate.id === id);

    if (!note) return;

    const revived: Note = { ...note, deletedAt: null };

    set({
      notes: [...previousNotes, revived].sort(compareNotes),
      deleted: previousDeleted.filter((candidate) => candidate.id !== id),
      pendingDeletion:
        get().pendingDeletion?.note.id === id ? null : get().pendingDeletion,
      error: null,
    });

    try {
      await repository.restoreDeletedNote(id);
    } catch (error) {
      set({
        notes: previousNotes,
        deleted: previousDeleted,
        error: describe(error),
      });
    }
  },

  /**
   * Destroys one note for good.
   *
   * Only ever called from Recently Deleted, and the repository refuses ids that
   * are not already there — so this cannot be reached in one step from a live
   * note, by any path.
   */
  purge: async (id) => {
    const previousDeleted = get().deleted;

    if (!previousDeleted.some((note) => note.id === id)) return;

    set({
      deleted: previousDeleted.filter((note) => note.id !== id),
      // A purged note has no undo left to offer.
      pendingDeletion:
        get().pendingDeletion?.note.id === id ? null : get().pendingDeletion,
      error: null,
    });

    try {
      await repository.purgeNote(id);
    } catch (error) {
      set({ deleted: previousDeleted, error: describe(error) });
    }
  },

  purgeAll: async () => {
    const previousDeleted = get().deleted;

    if (previousDeleted.length === 0) return;

    set({ deleted: [], pendingDeletion: null, error: null });

    try {
      await repository.purgeAllDeleted();
    } catch (error) {
      set({ deleted: previousDeleted, error: describe(error) });
    }
  },

  togglePin: async (id) => {
    const previous = get().notes;
    const target = previous.find((note) => note.id === id);

    if (!target) return;

    const isPinned = !target.isPinned;

    // Re-sorted locally so the note crosses the section boundary on the same
    // frame as the tap, rather than after a database round trip.
    set({
      notes: previous
        .map((note) => (note.id === id ? { ...note, isPinned } : note))
        .sort(compareNotes),
      error: null,
    });

    try {
      await repository.setPinned(id, isPinned);
    } catch (error) {
      set({ notes: previous, error: describe(error) });
    }
  },

  reorder: async (from, to) => {
    const previous = get().notes;
    const moved = previous[from];
    const target = previous[to];

    if (!moved || !target || from === to) return;

    // Pinned and unpinned notes never interleave. A drag that would cross the
    // boundary is ignored rather than silently pinning or unpinning the note —
    // that decision belongs to the pin button alone.
    if (moved.isPinned !== target.isPinned) return;

    const reordered = [...previous];
    reordered.splice(from, 1);
    reordered.splice(to, 0, moved);

    set({ notes: reordered, error: null });

    const index = reordered.findIndex((note) => note.id === moved.id);

    // Clamp neighbours to the moved note's own section, so a note dropped at a
    // section edge takes a position relative to its own group.
    const sameSection = (candidate: Note | undefined) =>
      candidate && candidate.isPinned === moved.isPinned ? candidate : null;

    try {
      const { position, exhausted } = await repository.moveNote(
        moved.id,
        sameSection(reordered[index - 1]),
        sameSection(reordered[index + 1]),
      );

      // Mirror the position that was written. The array is already in the right
      // order, but the moved note still carries its old position — and the next
      // local re-sort (pinning something, say) would order by that stale value
      // and undo the drag on screen while the database says otherwise.
      set((state) => ({
        notes: state.notes.map((note) =>
          note.id === moved.id ? { ...note, position } : note,
        ),
      }));

      if (exhausted) {
        // The gap ran out of float precision. Renumber this section, then
        // re-read so in-memory positions match what is on disk.
        await repository.rebalanceSection(moved.isPinned);
        set({ notes: await repository.listNotes() });
      }
    } catch (error) {
      set({ notes: previous, error: describe(error) });
    }
  },

  setQuery: (query) => set({ query }),

  clearError: () => set({ error: null }),

  /**
   * Drops every note from memory. Called on lock so note contents do not sit in
   * the JS heap behind the unlock screen — the trash included, since a deleted
   * note is still the user's writing.
   */
  reset: () =>
    set({
      notes: [],
      deleted: [],
      status: "idle",
      error: null,
      query: "",
      pendingDeletion: null,
    }),
}));
