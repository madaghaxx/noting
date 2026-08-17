const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/**
 * Renders a timestamp the way a notes list wants it: coarse and short for
 * anything recent, an actual date once "9 days ago" stops being useful.
 */
export function formatRelativeTime(timestamp: number): string {
  const elapsed = Date.now() - timestamp;

  // Clock skew, or a note written in this same tick, must not read "-0 min ago".
  if (elapsed < MINUTE) return "just now";

  if (elapsed < HOUR) {
    return `${Math.floor(elapsed / MINUTE)} min ago`;
  }

  if (elapsed < DAY) {
    const hours = Math.floor(elapsed / HOUR);
    return `${hours} hr ago`;
  }

  if (elapsed < WEEK) {
    const days = Math.floor(elapsed / DAY);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }

  return new Date(timestamp).toLocaleDateString();
}

/**
 * Collapses a note body into a single line for the list preview. Without this,
 * a note that opens with several blank lines shows an empty preview.
 */
export function toPreview(content: string): string {
  return content.replace(/\s+/g, " ").trim();
}

/**
 * Time-of-day greeting for the home screen header.
 *
 * Deliberately has a late-night case: "Good evening" at 3am reads as a template
 * that isn't paying attention.
 */
export function greeting(now: Date = new Date()): string {
  const hour = now.getHours();

  if (hour < 5) return "Late night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";

  return "Good evening";
}

export function countWords(text: string): number {
  const trimmed = text.trim();

  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

/** "1 word" / "24 words · 138 characters" for the editor's status line. */
export function describeLength(text: string): string {
  const words = countWords(text);
  const characters = text.length;

  if (words === 0) return "Empty";

  const wordLabel = `${words} ${words === 1 ? "word" : "words"}`;

  return `${wordLabel}  ·  ${characters} ${characters === 1 ? "character" : "characters"}`;
}
