/**
 * The text transformations behind the editor's formatting bar.
 *
 * Kept as pure functions over (text, selection) rather than as handlers inside the
 * editor, because the fiddly parts — where the cursor lands, what happens when the
 * selection already carries the marker, what a multi-line selection means — are
 * exactly the parts worth testing, and none of them need a TextInput to decide.
 */

export type Selection = { start: number; end: number };

export type EditResult = {
  text: string;
  selection: Selection;
};

/**
 * Wraps the selection in an inline marker, or unwraps it if it is already wrapped.
 *
 * Toggling matters more than it sounds: the button is the only way to *remove*
 * emphasis without hunting for the asterisks by hand.
 */
export function toggleInline(
  text: string,
  selection: Selection,
  marker: string,
): EditResult {
  const start = Math.min(selection.start, selection.end);
  const end = Math.max(selection.start, selection.end);

  const width = marker.length;
  const before = text.slice(0, start);
  const selected = text.slice(start, end);
  const after = text.slice(end);

  // Already wrapped from the outside: "**|bold|**" with the markers just beyond
  // the selection. Unwrap without disturbing what is selected.
  if (before.endsWith(marker) && after.startsWith(marker)) {
    return {
      text: before.slice(0, -width) + selected + after.slice(width),
      selection: { start: start - width, end: end - width },
    };
  }

  // Wrapped from the inside: the markers are part of the selection.
  if (
    selected.length >= width * 2 &&
    selected.startsWith(marker) &&
    selected.endsWith(marker)
  ) {
    const stripped = selected.slice(width, -width);

    return {
      text: before + stripped + after,
      selection: { start, end: start + stripped.length },
    };
  }

  // Nothing selected: leave an empty pair with the cursor inside it, ready to
  // type into. This is what the button does most of the time.
  if (selected.length === 0) {
    return {
      text: `${before}${marker}${marker}${after}`,
      selection: { start: start + width, end: start + width },
    };
  }

  return {
    text: `${before}${marker}${selected}${marker}${after}`,
    selection: { start: start + width, end: end + width },
  };
}

/** The line boundaries containing the selection, as [start, end) offsets. */
function lineRange(text: string, selection: Selection): [number, number] {
  const start = Math.min(selection.start, selection.end);
  const end = Math.max(selection.start, selection.end);

  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const nextBreak = text.indexOf("\n", end);
  const lineEnd = nextBreak === -1 ? text.length : nextBreak;

  return [lineStart, lineEnd];
}

/**
 * Which prefixes a line-level button owns, so pressing it can recognise its own
 * previous work — including a heading at a different level.
 */
const FAMILY: Record<string, RegExp> = {
  "# ": /^#{1,6}[ \t]+/,
  "- ": /^[ \t]*[-*+][ \t]+/,
  "> ": /^[ \t]*>[ \t]?/,
};

/**
 * Adds a prefix to every line the selection touches, or strips it if every line
 * already has one.
 *
 * "Every line already has one" rather than "any line does": with a mixed
 * selection, pressing the button should finish the job, not undo half of it.
 */
export function toggleLinePrefix(
  text: string,
  selection: Selection,
  prefix: string,
): EditResult {
  const pattern = FAMILY[prefix] ?? new RegExp(`^${prefix}`);
  const [lineStart, lineEnd] = lineRange(text, selection);

  const body = text.slice(lineStart, lineEnd);
  const lines = body.split("\n");

  const present = lines.every(
    (line) => line.trim().length === 0 || pattern.test(line),
  );

  const rewritten = lines.map((line) => {
    if (line.trim().length === 0) return line;

    return present ? line.replace(pattern, "") : prefix + line;
  });

  const replacement = rewritten.join("\n");

  const start = Math.min(selection.start, selection.end);
  const end = Math.max(selection.start, selection.end);

  const updated =
    text.slice(0, lineStart) + replacement + text.slice(lineEnd);

  // With text selected, the selection covers the rewritten lines whole. This is a
  // line operation, so the lines are what it acted on — and it means pressing the
  // button twice returns exactly what you started with, visibly.
  if (start !== end) {
    return {
      text: updated,
      selection: { start: lineStart, end: lineStart + replacement.length },
    };
  }

  // A bare cursor instead travels with its own character, so typing continues
  // where it left off rather than jumping to the start of the line.
  const firstDelta = rewritten[0].length - lines[0].length;

  return {
    text: updated,
    selection: {
      start: Math.max(lineStart, start + firstDelta),
      end: Math.max(lineStart, end + firstDelta),
    },
  };
}

/**
 * Inserts a link, with the cursor left wherever the writer still has to type.
 *
 * With text selected that is the target, since the label is already written; with
 * nothing selected it is the label, since a URL with no words around it is not
 * what anyone is reaching for.
 */
export function insertLink(text: string, selection: Selection): EditResult {
  const start = Math.min(selection.start, selection.end);
  const end = Math.max(selection.start, selection.end);

  const before = text.slice(0, start);
  const selected = text.slice(start, end);
  const after = text.slice(end);

  if (selected.length === 0) {
    return {
      text: `${before}[]()${after}`,
      selection: { start: start + 1, end: start + 1 },
    };
  }

  const cursor = start + selected.length + 3;

  return {
    text: `${before}[${selected}]()${after}`,
    selection: { start: cursor, end: cursor },
  };
}
