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
  status: Status;
  error: string | null;
  query: string;
  pendingDeletion: PendingDeletion | null;

  load: () => Promise<void>;
  create: (draft: NoteDraft) => Promise<Note | null>;
  update: (id: string, draft: NoteDraft) => Promise<void>;
  remove: (id: string) => Promise<void>;
  undoRemove: () => Promise<void>;
  dismissDeletion: () => void;
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

/**
 * Owns the in-memory view of the notes table.
 *
 * Mutations are optimistic: state changes first so the UI answers the gesture
 * immediately, and the previous list is restored if the write fails. The store
 * never touches SQL — that stays behind the repository.
 */
export const useNotesStore = create<NotesState>((set, get) => ({
  notes: [],
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
   * Deletes immediately and remembers enough to put the note back.
   *
   * The row really does leave SQLite — undo re-inserts it with its original id,
   * position and timestamps, so a restored note is indistinguishable from one
   * that was never deleted. The alternative (deferring the delete until the undo
   * window closes) would leave the note present if the app were killed mid-window.
   */
  remove: async (id) => {
    const previous = get().notes;
    const index = previous.findIndex((note) => note.id === id);
    const note = previous[index];

    if (!note) return;

    set({
      notes: previous.filter((candidate) => candidate.id !== id),
      pendingDeletion: { note, index },
      error: null,
    });

    try {
      await repository.deleteNote(id);
    } catch (error) {
      set({ notes: previous, pendingDeletion: null, error: describe(error) });
    }
  },

  undoRemove: async () => {
    const pending = get().pendingDeletion;

    if (!pending) return;

    const restored = [...get().notes];
    restored.splice(Math.min(pending.index, restored.length), 0, pending.note);

    set({
      notes: restored.sort(compareNotes),
      pendingDeletion: null,
      error: null,
    });

    try {
      await repository.restoreNote(pending.note);
    } catch (error) {
      set((state) => ({
        notes: state.notes.filter((note) => note.id !== pending.note.id),
        error: describe(error),
      }));
    }
  },

  dismissDeletion: () => set({ pendingDeletion: null }),

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
      const exhausted = await repository.moveNote(
        moved.id,
        sameSection(reordered[index - 1]),
        sameSection(reordered[index + 1]),
      );

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
   * the JS heap behind the unlock screen.
   */
  reset: () =>
    set({
      notes: [],
      status: "idle",
      error: null,
      query: "",
      pendingDeletion: null,
    }),
}));
