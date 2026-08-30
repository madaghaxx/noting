/**
 * Search over notes.
 *
 * The utilities are pure, so what needs pinning down is the behaviour a person
 * would notice: that matching is case-insensitive, that it finds what the list
 * *shows* rather than the Markdown behind it, that a term appearing late in a long
 * note still produces a visible match, and that the highlighter cannot corrupt the
 * text it is emphasising.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { toPlainText } from "@/src/markdown/plain";
import {
  filterNotes,
  highlight,
  matchesQuery,
  previewAround,
} from "@/src/utils/search";

/** Mirrors what the notes screen builds before filtering. */
const row = (title, content) => ({
  title,
  content: toPlainText(content),
  raw: content,
});

const NOTES = [
  row("Shopping", "- milk\n- **eggs**\n- bread"),
  row("Trip to Lisbon", "Leaving on Friday. Book the *train*."),
  row("", "A note with no title at all."),
  row("Recipe", "# Bread\n\nMix `flour` and water."),
];

const titles = (rows) => rows.map((r) => r.title);

test("an empty query matches everything", () => {
  assert.equal(filterNotes(NOTES, "").length, NOTES.length);
  assert.equal(filterNotes(NOTES, "   ").length, NOTES.length);
});

test("matching is case-insensitive and ignores surrounding space", () => {
  assert.deepEqual(titles(filterNotes(NOTES, "LISBON")), ["Trip to Lisbon"]);
  assert.deepEqual(titles(filterNotes(NOTES, "  lisbon  ")), [
    "Trip to Lisbon",
  ]);
});

test("titles and bodies are both searched", () => {
  assert.deepEqual(titles(filterNotes(NOTES, "Shopping")), ["Shopping"]);
  assert.deepEqual(titles(filterNotes(NOTES, "Friday")), ["Trip to Lisbon"]);
});

test("a note with no title is still findable by its body", () => {
  assert.equal(filterNotes(NOTES, "no title").length, 1);
});

test("search finds the words the list shows, not the Markdown behind them", () => {
  // "eggs" is written as **eggs**. Searching the raw body for "eggs" would work
  // here by luck, but searching for a word split by markers would not — and a
  // term containing the markers must not match.
  assert.deepEqual(titles(filterNotes(NOTES, "eggs")), ["Shopping"]);
  assert.deepEqual(titles(filterNotes(NOTES, "**eggs**")), []);

  const split = row("Split", "b**old** claim");

  assert.ok(matchesQuery(split, "bold"), "the visible word is not findable");
  assert.ok(!matchesQuery(split, "b**old**"), "raw syntax matched");
});

test("headings and code spans are searchable as plain words", () => {
  assert.deepEqual(titles(filterNotes(NOTES, "bread")), ["Shopping", "Recipe"]);
  assert.deepEqual(titles(filterNotes(NOTES, "flour")), ["Recipe"]);
});

test("a term that matches nothing returns nothing", () => {
  assert.deepEqual(filterNotes(NOTES, "helicopter"), []);
});

test("matching is substring, not whole-word", () => {
  // Halfway through typing "Lisbon", every prefix has to match already.
  for (const prefix of ["L", "Li", "Lis", "Lisb"]) {
    assert.equal(
      filterNotes(NOTES, prefix).length > 0,
      true,
      `"${prefix}" found nothing`,
    );
  }
});

test("filtering preserves the order it was given", () => {
  // The list arrives pinned-first; search must not reshuffle it.
  const ordered = filterNotes(NOTES, "e");

  assert.deepEqual(
    titles(ordered),
    titles(NOTES).filter((_, index) => ordered.some((r) => r === NOTES[index])),
  );
});

test("highlight splits text into plain and matching runs", () => {
  assert.deepEqual(highlight("Trip to Lisbon", "lisbon"), [
    { text: "Trip to ", match: false },
    { text: "Lisbon", match: true },
  ]);
});

test("highlight finds every occurrence", () => {
  const segments = highlight("bread and more bread", "bread");

  assert.equal(segments.filter((s) => s.match).length, 2);
});

test("highlight preserves the original casing of the match", () => {
  const [, match] = highlight("Trip to Lisbon", "LISBON");

  assert.equal(match.text, "Lisbon");
});

test("highlight never loses or duplicates a character", () => {
  // The property that matters: joining the runs must reproduce the input exactly,
  // whatever the term. This is what makes the highlighter safe on arbitrary text.
  const samples = [
    ["hello world", "o"],
    ["aaa", "a"],
    ["aaaa", "aa"],
    ["Trip to Lisbon", "lisbon"],
    ["edge", "edge"],
    ["no match here", "zzz"],
    ["**bold**", "*"],
    ["a.b.c", "."],
    ["", "x"],
  ];

  for (const [text, query] of samples) {
    assert.equal(
      highlight(text, query)
        .map((segment) => segment.text)
        .join(""),
      text,
      `highlight corrupted ${JSON.stringify(text)} for ${JSON.stringify(query)}`,
    );
  }
});

test("highlight treats the term as literal text, not a pattern", () => {
  // A term full of regex metacharacters is just a term.
  const text = "costs $5 (approx.) [see notes]";

  for (const query of ["$5", "(approx.)", "[see", ".", "*"]) {
    const segments = highlight(text, query);

    assert.equal(
      segments.map((segment) => segment.text).join(""),
      text,
      `${query} corrupted the text`,
    );
  }

  assert.ok(highlight(text, "$5").some((segment) => segment.match));
  assert.ok(!highlight(text, "*").some((segment) => segment.match));
});

test("an empty term highlights nothing", () => {
  assert.deepEqual(highlight("anything", ""), [
    { text: "anything", match: false },
  ]);
});

test("a preview window shifts so a late match is visible", () => {
  const long = `${"filler ".repeat(40)}needle at the end`;
  const shifted = previewAround(long, "needle");

  assert.ok(shifted.includes("needle"), "the match fell outside the preview");
  assert.ok(shifted.startsWith("…"), "a shifted preview should say so");
  assert.ok(shifted.length < long.length);
});

test("a preview is left alone when the match is already visible", () => {
  const text = "needle right at the start of this note";

  assert.equal(previewAround(text, "needle"), text);
  assert.equal(previewAround(text, ""), text);
});

test("a search result always shows evidence of its match", () => {
  // The whole point: every row the list keeps must contain the term somewhere the
  // person can see — in its title, or in the preview as it will be rendered.
  const query = "needle";
  const notes = [
    row("Has it in the title: needle", "nothing else here"),
    row("Buried", `${"filler ".repeat(60)}needle deep inside`),
    row("Formatted", "the **needle** is bold"),
  ];

  for (const note of filterNotes(notes, query)) {
    const visible =
      note.title.toLowerCase().includes(query) ||
      previewAround(note.content, query).toLowerCase().includes(query);

    assert.ok(visible, `"${note.title}" matched with nothing visible to show`);
  }
});
