/**
 * A small Markdown parser, written for the subset a notes app actually uses:
 * headings, emphasis, inline code, links, lists, quotes, fenced code and rules.
 *
 * Hand-written rather than pulled in, for two reasons. The dependency-shaped
 * options bring a renderer with their own typography, which would fight the type
 * scale in `tokens.ts`; and a parser that produces plain data is testable without
 * a device, which is the only way this code gets verified at all.
 *
 * It is not CommonMark. It handles what people write in notes and leaves
 * unrecognised syntax as literal text, which is the failure mode that loses the
 * least: a stray asterisk shows up as an asterisk rather than swallowing a line.
 */

export type Inline =
  | { type: "text"; value: string }
  | { type: "strong"; children: Inline[] }
  | { type: "em"; children: Inline[] }
  | { type: "code"; value: string }
  | { type: "link"; href: string; children: Inline[] };

export type ListItem = {
  /** Nesting level, 0 for a top-level item. */
  depth: number;
  /** The number shown for an ordered item; null for a bullet. */
  number: number | null;
  children: Inline[];
};

export type Block =
  | { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; children: Inline[] }
  | { type: "paragraph"; children: Inline[] }
  | { type: "quote"; blocks: Block[] }
  | { type: "list"; ordered: boolean; items: ListItem[] }
  | { type: "code"; language: string | null; value: string }
  | { type: "rule" };

const HEADING = /^(#{1,6})[ \t]+(.*)$/;
const FENCE = /^[ \t]{0,3}(```+|~~~+)[ \t]*([^`]*)$/;
const RULE = /^[ \t]{0,3}([-*_])[ \t]*(?:\1[ \t]*){2,}$/;
const QUOTE = /^[ \t]{0,3}>[ \t]?(.*)$/;
const BULLET = /^([ \t]*)([-*+])[ \t]+(.*)$/;
const ORDERED = /^([ \t]*)(\d{1,9})[.)][ \t]+(.*)$/;

/** Two spaces per level, with a tab counting as one level. */
function depthOf(indent: string): number {
  const spaces = indent.replace(/\t/g, "  ").length;

  return Math.min(3, Math.floor(spaces / 2));
}

const isBlank = (line: string) => line.trim().length === 0;

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];

  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (isBlank(line)) {
      index++;
      continue;
    }

    // Fenced code first: inside a fence, nothing else is markup.
    const fence = line.match(FENCE);

    if (fence) {
      const [, ticks, info] = fence;
      const body: string[] = [];
      index++;

      while (index < lines.length) {
        const candidate = lines[index];
        const closing = candidate.match(/^[ \t]{0,3}(```+|~~~+)[ \t]*$/);

        if (closing && closing[1][0] === ticks[0]) {
          index++;
          break;
        }

        body.push(candidate);
        index++;
      }

      blocks.push({
        type: "code",
        language: info.trim() || null,
        // An unterminated fence still renders as code: the writer's intent is
        // clear, and dropping the text would be worse than closing it for them.
        value: body.join("\n"),
      });

      continue;
    }

    if (RULE.test(line)) {
      blocks.push({ type: "rule" });
      index++;
      continue;
    }

    const heading = line.match(HEADING);

    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1].length as 1 | 2 | 3 | 4 | 5 | 6,
        children: parseInline(heading[2].trim()),
      });
      index++;
      continue;
    }

    if (QUOTE.test(line)) {
      const quoted: string[] = [];

      while (index < lines.length) {
        const match = lines[index].match(QUOTE);

        if (!match) {
          const current = lines[index];

          // A plain line directly under a quote continues it — "lazy"
          // continuation, which is what people write when a long quote wraps and
          // they don't repeat the marker. Anything that starts a block of its own
          // ends the quote instead of being swallowed by it.
          if (
            isBlank(current) ||
            HEADING.test(current) ||
            FENCE.test(current) ||
            RULE.test(current) ||
            BULLET.test(current) ||
            ORDERED.test(current)
          ) {
            break;
          }

          quoted.push(current);
          index++;
          continue;
        }

        quoted.push(match[1]);
        index++;
      }

      blocks.push({ type: "quote", blocks: parseMarkdown(quoted.join("\n")) });
      continue;
    }

    const listMatch = line.match(BULLET) ?? line.match(ORDERED);

    if (listMatch) {
      const ordered = ORDERED.test(line);
      const items: ListItem[] = [];

      while (index < lines.length) {
        const current = lines[index];
        const bullet = current.match(BULLET);
        const numbered = current.match(ORDERED);
        const match = bullet ?? numbered;

        // A list ends at a blank line or anything that is not an item. Mixing
        // bullets and numbers starts a new list rather than continuing this one.
        if (!match || (ordered ? !numbered : !bullet)) break;

        items.push({
          depth: depthOf(match[1]),
          number: numbered ? Number(numbered[2]) : null,
          children: parseInline(match[3].trim()),
        });

        index++;
      }

      blocks.push({ type: "list", ordered, items });
      continue;
    }

    // Paragraph: everything up to a blank line or the start of another block.
    const paragraph: string[] = [];

    while (index < lines.length) {
      const current = lines[index];

      if (
        isBlank(current) ||
        HEADING.test(current) ||
        FENCE.test(current) ||
        RULE.test(current) ||
        QUOTE.test(current) ||
        BULLET.test(current) ||
        ORDERED.test(current)
      ) {
        break;
      }

      paragraph.push(current);
      index++;
    }

    // Joined with newlines, not spaces: in a notebook a line break is almost
    // always deliberate, and reflowing it loses the shape the writer gave it.
    blocks.push({
      type: "paragraph",
      children: parseInline(paragraph.join("\n")),
    });
  }

  return blocks;
}

const PUNCTUATION = new Set("\\`*_[]()#+-.!>~".split(""));

const isWordChar = (char: string | undefined) =>
  char !== undefined && /[\p{L}\p{N}]/u.test(char);

/** Finds the closing run of `marker`, skipping code spans. */
function findClosing(
  source: string,
  marker: string,
  from: number,
): number {
  let index = from;

  while (index < source.length) {
    if (source[index] === "\\") {
      index += 2;
      continue;
    }

    if (source.startsWith(marker, index)) {
      // `**` must not match the first half of `***`'s closing run when the run
      // is longer; starting at the first character keeps nesting predictable.
      return index;
    }

    index++;
  }

  return -1;
}

export function parseInline(source: string): Inline[] {
  const nodes: Inline[] = [];
  let buffer = "";
  let index = 0;

  const flush = () => {
    if (buffer.length > 0) {
      nodes.push({ type: "text", value: buffer });
      buffer = "";
    }
  };

  while (index < source.length) {
    const char = source[index];

    // Escapes: a backslash before punctuation means "the character itself".
    if (char === "\\" && PUNCTUATION.has(source[index + 1] ?? "")) {
      buffer += source[index + 1];
      index += 2;
      continue;
    }

    if (char === "`") {
      const run = /^`+/.exec(source.slice(index))?.[0] ?? "`";
      const closing = source.indexOf(run, index + run.length);

      if (closing !== -1) {
        flush();
        nodes.push({
          type: "code",
          value: source.slice(index + run.length, closing).trim(),
        });
        index = closing + run.length;
        continue;
      }
    }

    if (char === "[") {
      const link = matchLink(source, index);

      if (link) {
        flush();
        nodes.push(link.node);
        index = link.end;
        continue;
      }
    }

    if (char === "*" || char === "_") {
      // Markers come in runs: one is italic, two bold, three both. Anything
      // longer is treated as three, since the extras have no further meaning.
      const run = Math.min(
        3,
        (/^(?:\*+|_+)/.exec(source.slice(index))?.[0] ?? char).length,
      );
      const marker = char.repeat(run);
      const next = source[index + run];

      // A marker followed by a space is punctuation, not emphasis: "2 * 3" and
      // "- item" should survive intact. And an underscore inside a word is part
      // of the word — snake_case is a name. Asterisks carry no such rule.
      const opens =
        next !== undefined &&
        !/\s/.test(next) &&
        (char === "*" || !isWordChar(source[index - 1]));

      if (opens) {
        const closing = findClosing(source, marker, index + run);

        if (closing > index + run) {
          const inner = parseInline(source.slice(index + run, closing));

          flush();
          nodes.push(
            run === 1
              ? { type: "em", children: inner }
              : run === 2
                ? { type: "strong", children: inner }
                : { type: "strong", children: [{ type: "em", children: inner }] },
          );
          index = closing + run;
          continue;
        }
      }
    }

    if (char === "h" && /^https?:\/\/\S/.test(source.slice(index))) {
      const raw = /^https?:\/\/[^\s<]+/.exec(source.slice(index))?.[0] ?? "";
      // Trailing punctuation almost always belongs to the sentence, not the URL.
      const href = raw.replace(/[.,;:!?)\]]+$/, "");

      flush();
      nodes.push({
        type: "link",
        href,
        children: [{ type: "text", value: href }],
      });
      index += href.length;
      continue;
    }

    buffer += char;
    index++;
  }

  flush();

  return nodes;
}

function matchLink(
  source: string,
  start: number,
): { node: Inline; end: number } | null {
  let depth = 0;
  let index = start;

  while (index < source.length) {
    const char = source[index];

    if (char === "\\") {
      index += 2;
      continue;
    }

    if (char === "[") depth++;

    if (char === "]") {
      depth--;

      if (depth === 0) break;
    }

    if (char === "\n") return null;

    index++;
  }

  if (depth !== 0 || source[index + 1] !== "(") return null;

  const closing = source.indexOf(")", index + 2);

  if (closing === -1) return null;

  const label = source.slice(start + 1, index);
  const href = source.slice(index + 2, closing).trim();

  if (href.length === 0) return null;

  return {
    node: {
      type: "link",
      href,
      children: label.length > 0 ? parseInline(label) : [
        { type: "text", value: href },
      ],
    },
    end: closing + 1,
  };
}
