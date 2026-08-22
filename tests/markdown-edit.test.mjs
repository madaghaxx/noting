/**
 * The formatting bar's text transformations.
 *
 * The notation below marks the selection: "a[bc]d" means b and c are selected,
 * "a|b" means an empty cursor between a and b. Each case asserts both the text
 * and where the cursor ends up, because a button that formats correctly and then
 * drops the cursor somewhere unexpected is still broken.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  insertLink,
  toggleInline,
  toggleLinePrefix,
} from "@/src/markdown/edit";

/** Parses "a[bc]d" / "a|b" into text plus selection. */
function parse(notation) {
  if (notation.includes("|")) {
    const start = notation.indexOf("|");

    return {
      text: notation.replace("|", ""),
      selection: { start, end: start },
    };
  }

  const start = notation.indexOf("[");
  const end = notation.indexOf("]") - 1;

  return {
    text: notation.replace("[", "").replace("]", ""),
    selection: { start, end },
  };
}

/** Renders a result back into the same notation, for legible assertions. */
function show({ text, selection }) {
  if (selection.start === selection.end) {
    return `${text.slice(0, selection.start)}|${text.slice(selection.start)}`;
  }

  return (
    text.slice(0, selection.start) +
    "[" +
    text.slice(selection.start, selection.end) +
    "]" +
    text.slice(selection.end)
  );
}

const inline = (notation, marker) => {
  const { text, selection } = parse(notation);

  return show(toggleInline(text, selection, marker));
};

const prefix = (notation, marker) => {
  const { text, selection } = parse(notation);

  return show(toggleLinePrefix(text, selection, marker));
};

test("bold wraps the selection and keeps it selected", () => {
  assert.equal(inline("make [this] bold", "**"), "make **[this]** bold");
});

test("bold on an empty cursor leaves a pair to type into", () => {
  assert.equal(inline("type |here", "**"), "type **|**here");
});

test("bold on already-bold text unwraps it", () => {
  assert.equal(inline("make **[this]** plain", "**"), "make [this] plain");
});

test("bold unwraps when the markers are inside the selection", () => {
  assert.equal(inline("make [**this**] plain", "**"), "make [this] plain");
});

test("italic and code use the same rules", () => {
  assert.equal(inline("[word]", "*"), "*[word]*");
  assert.equal(inline("*[word]*", "*"), "[word]");
  assert.equal(inline("[npm test]", "`"), "`[npm test]`");
  assert.equal(inline("`[npm test]`", "`"), "[npm test]");
});

test("bold inside italic does not unwrap the italic", () => {
  // The selection is wrapped in single asterisks, but the button being pressed is
  // bold — a naive prefix check would strip the italic markers instead.
  assert.equal(inline("*[word]*", "**"), "***[word]***");
});

test("a heading is added, then removed", () => {
  assert.equal(prefix("|Title", "# "), "# |Title");
  assert.equal(prefix("# |Title", "# "), "|Title");
});

test("the heading button clears a heading of any level", () => {
  assert.equal(prefix("### |Deep", "# "), "|Deep");
});

test("a bullet is added to every selected line", () => {
  assert.equal(
    prefix("[milk\neggs\nbread]", "- "),
    "[- milk\n- eggs\n- bread]",
  );
});

test("bulleting a fully bulleted selection removes the bullets", () => {
  assert.equal(
    prefix("[- milk\n- eggs]", "- "),
    "[milk\neggs]",
  );
});

test("a mixed selection gets finished rather than half-undone", () => {
  assert.equal(
    prefix("[- milk\neggs]", "- "),
    "[- - milk\n- eggs]",
  );
});

test("blank lines inside a selection are left alone", () => {
  assert.equal(
    prefix("[milk\n\neggs]", "- "),
    "[- milk\n\n- eggs]",
  );
});

test("quoting works on one line and on many", () => {
  assert.equal(prefix("|said", "> "), "> |said");
  assert.equal(prefix("[one\ntwo]", "> "), "[> one\n> two]");
  assert.equal(prefix("[> one\n> two]", "> "), "[one\ntwo]");
});

test("a line prefix only touches the lines the selection reaches", () => {
  const { text, selection } = parse("first\n[second]\nthird");
  const result = toggleLinePrefix(text, selection, "- ");

  assert.equal(result.text, "first\n- second\nthird");
});

test("a prefix applies to the whole line, not from the cursor", () => {
  // The cursor sits mid-word; the bullet still belongs at the start of the line.
  assert.equal(prefix("mi|lk", "- "), "- mi|lk");
});

test("a link around a selection leaves the cursor in the target", () => {
  const { text, selection } = parse("see [the docs] here");
  const result = insertLink(text, selection);

  assert.equal(result.text, "see [the docs]() here");
  // Between the parentheses, where the URL goes.
  assert.equal(result.selection.start, "see [the docs](".length);
  assert.equal(result.selection.end, result.selection.start);
});

test("a link with nothing selected leaves the cursor in the label", () => {
  const { text, selection } = parse("start |end");
  const result = insertLink(text, selection);

  assert.equal(result.text, "start []()end");
  assert.equal(result.selection.start, "start [".length);
});

test("pressing a line button twice returns exactly what you started with", () => {
  for (const marker of ["- ", "> ", "# "]) {
    const { text, selection } = parse("[one\ntwo\nthree]");

    const once = toggleLinePrefix(text, selection, marker);
    const twice = toggleLinePrefix(once.text, once.selection, marker);

    assert.equal(twice.text, text, `${marker} did not round-trip`);
    assert.deepEqual(twice.selection, selection);
  }
});

test("pressing an inline button twice returns exactly what you started with", () => {
  for (const marker of ["**", "*", "`"]) {
    const { text, selection } = parse("make [this] stand out");

    const once = toggleInline(text, selection, marker);
    const twice = toggleInline(once.text, once.selection, marker);

    assert.equal(twice.text, text, `${marker} did not round-trip`);
    assert.deepEqual(twice.selection, selection);
  }
});

test("transformations never lose the text around them", () => {  const source = "keep this\nand [this]\nand that";
  const { text, selection } = parse(source);

  for (const result of [
    toggleInline(text, selection, "**"),
    toggleLinePrefix(text, selection, "- "),
    insertLink(text, selection),
  ]) {
    assert.ok(result.text.includes("keep this"), "leading text was lost");
    assert.ok(result.text.includes("and that"), "trailing text was lost");
    assert.ok(
      result.selection.start >= 0 &&
        result.selection.end <= result.text.length,
      "the cursor ended up outside the text",
    );
  }
});
