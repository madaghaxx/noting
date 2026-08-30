import { useNotesStore } from "./notes-store";
import { useSidebarStore } from "./sidebar-store";
import { useAuthStore } from "./auth-store";
import { useConfirmStore } from "./confirm-store";

/**
 * Locks the app, everywhere, the same way.
 *
 * Locking is four things, not one: the guard has to close, the notes have to leave
 * memory, the sidebar has to shut so it is not sitting open behind the unlock
 * screen, and any open confirmation has to be answered — it renders in its own
 * window above everything, so the privacy shield cannot cover the note title it
 * may be quoting.
 *
 * Every path that locks — the header button, the sidebar, the app going to the
 * background — goes through here, because a path that forgot the second step would
 * leave note contents in the JS heap behind a locked screen and nothing on screen
 * would look wrong.
 */
export function lockEverything(): void {
  useConfirmStore.getState().cancelPending();
  useSidebarStore.getState().close();
  useNotesStore.getState().reset();
  useAuthStore.getState().lock();
}
