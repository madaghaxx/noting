/**
 * Where a dragged note lands.
 *
 * Separated from the gesture for the usual reason: the arithmetic is the part that
 * can be wrong in ways nobody notices — a row that settles one place off, a drag
 * that quietly crosses into the pinned section — and it is the part that can be
 * tested without a touchscreen. The component above it only has to translate
 * fingers into a `y`.
 *
 * Rows are measured rather than assumed: note cards are one to four lines tall
 * depending on what is written in them, so a fixed row height would drift further
 * out of step the further the drag went.
 */

/** A row's vertical extent within the list's content, in pixels. */
export type Slot = {
  top: number;
  height: number;
};

/**
 * Turns measured row heights into stacked slots.
 *
 * `gap` is the separator between rows; it belongs to the space between two slots
 * rather than to either of them, which is why the tops accumulate it but the
 * heights do not.
 */
export function stack(heights: readonly number[], gap: number): Slot[] {
  const slots: Slot[] = [];
  let top = 0;

  for (const height of heights) {
    slots.push({ top, height });
    top += height + gap;
  }

  return slots;
}

/** The vertical midpoint of a slot. */
function midpoint(slot: Slot): number {
  return slot.top + slot.height / 2;
}

/**
 * The contiguous run of rows a note may move within, as inclusive `[first, last]`
 * indices.
 *
 * Pinned notes always sort above unpinned ones, and the list is stored in that
 * order, so each section is a contiguous run and a drag can be clamped to the one
 * it started in. That clamp is what stops a drag from silently pinning a note —
 * pinning is the pin button's decision, and only its.
 */
export function sectionBounds(
  pinned: readonly boolean[],
  index: number,
): [number, number] {
  const section = pinned[index];

  let first = index;
  let last = index;

  while (first > 0 && pinned[first - 1] === section) first--;
  while (last < pinned.length - 1 && pinned[last + 1] === section) last++;

  return [first, last];
}

/**
 * The index a note dragged to `centerY` should occupy.
 *
 * A row is displaced once the dragged note's centre passes *its* centre, not its
 * edge — crossing an edge would swap rows while they were still only half
 * overlapping, which reads as the list twitching ahead of the finger.
 *
 * `centerY` is in the same content coordinates as the slots, so a list that
 * scrolls under the finger needs no special handling here.
 */
export function dropIndex(
  slots: readonly Slot[],
  from: number,
  centerY: number,
  bounds: [number, number] = [0, slots.length - 1],
): number {
  const [first, last] = bounds;

  if (slots.length === 0) return from;

  let index = from;

  while (index > first && centerY < midpoint(slots[index - 1])) index--;
  while (index < last && centerY > midpoint(slots[index + 1])) index++;

  return index;
}

/**
 * How far a row at `index` has to move aside while `from` is being dragged over
 * `to`, in pixels.
 *
 * Only rows between the two positions move, and they all move by one dragged-row
 * height — the gap the dragged note left behind travels with it, so every row it
 * passed shifts by exactly that much in the opposite direction.
 */
export function displacement(
  index: number,
  from: number,
  to: number,
  slotHeight: number,
): number {
  if (index === from || from === to) return 0;

  if (from < to && index > from && index <= to) return -slotHeight;
  if (from > to && index < from && index >= to) return slotHeight;

  return 0;
}
