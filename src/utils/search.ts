/**
 * Search over notes. Runs entirely in memory: the whole point of an offline
 * notebook is that filtering is instant, and a local `LIKE` round trip per
 * keystroke would be slower than scanning an array we already hold.
 */

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

type Searchable = {
  title: string;
  content: string;
};

export function matchesQuery(note: Searchable, query: string): boolean {
  const needle = normalize(query);

  if (!needle) return true;

  return (
    note.title.toLowerCase().includes(needle) ||
    note.content.toLowerCase().includes(needle)
  );
}

export function filterNotes<T extends Searchable>(
  notes: T[],
  query: string,
): T[] {
  if (!normalize(query)) return notes;

  return notes.filter((note) => matchesQuery(note, query));
}

export type Segment = {
  text: string;
  match: boolean;
};

/**
 * Splits text into alternating plain and matching runs so the UI can emphasise
 * the matches without building markup out of string concatenation.
 */
export function highlight(text: string, query: string): Segment[] {
  const needle = normalize(query);

  if (!needle) return [{ text, match: false }];

  const haystack = text.toLowerCase();
  const segments: Segment[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const found = haystack.indexOf(needle, cursor);

    if (found === -1) {
      segments.push({ text: text.slice(cursor), match: false });
      break;
    }

    if (found > cursor) {
      segments.push({ text: text.slice(cursor, found), match: false });
    }

    segments.push({
      text: text.slice(found, found + needle.length),
      match: true,
    });

    cursor = found + needle.length;
  }

  return segments;
}

/**
 * Shifts a preview window so the first match is inside it.
 *
 * Without this, searching for a word that appears late in a long note shows a
 * preview with no visible match — the row looks like a false positive.
 */
export function previewAround(
  text: string,
  query: string,
  radius = 70,
): string {
  const needle = normalize(query);

  if (!needle) return text;

  const found = text.toLowerCase().indexOf(needle);

  if (found <= radius) return text;

  return `…${text.slice(found - radius)}`;
}
