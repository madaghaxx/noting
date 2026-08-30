/**
 * The Markdown parser. Pure functions in, plain data out — so this is where the
 * markdown feature actually gets verified.
 *
 * The cases are the ones a notebook produces: shopping lists, pasted URLs,
 * snake_case identifiers, half-typed syntax. The last group matters most — while
 * you are typing, every document is briefly malformed, and the renderer must not
 * flinch.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { parseInline, parseMarkdown } from "@/src/markdown/parse";
import { toPlainText } from "@/src/markdown/plain";

/** Collapses inline nodes to a compact shape that reads well in assertions. */
const shape = (nodes) =>
  nodes.map((node) => {
    switch (node.type) {
      case "text":
        return node.value;
      case "code":
        return { code: node.value };
      case "strong":
        return { b: shape(node.children) };
      case "em":
        return { i: shape(node.children) };
      case "link":
        return { href: node.href, text: shape(node.children) };
    }
  });

test("plain text is one paragraph", () => {
  const blocks = parseMarkdown("Just a note.");

  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "paragraph");
  assert.deepEqual(shape(blocks[0].children), ["Just a note."]);
});

test("blank lines separate paragraphs, single ones do not", () => {
  const blocks = parseMarkdown("First line\nsecond line\n\nNew paragraph");

  assert.deepEqual(
    blocks.map((block) => block.type),
    ["paragraph", "paragraph"],
  );

  // A line break inside a paragraph is kept: in a notebook it is deliberate.
  assert.deepEqual(shape(blocks[0].children), ["First line\nsecond line"]);
});

test("headings carry their level", () => {
  const blocks = parseMarkdown("# One\n## Two\n###### Six");

  assert.deepEqual(
    blocks.map((block) => [block.type, block.level]),
    [
      ["heading", 1],
      ["heading", 2],
      ["heading", 6],
    ],
  );
});

test("a hash without a space is not a heading", () => {
  const [block] = parseMarkdown("#hashtag");

  assert.equal(block.type, "paragraph");
  assert.deepEqual(shape(block.children), ["#hashtag"]);
});

test("seven hashes is a paragraph, not a heading", () => {
  const [block] = parseMarkdown("####### too deep");

  assert.equal(block.type, "paragraph");
});

test("emphasis: one marker is italic, two bold, three both", () => {
  assert.deepEqual(shape(parseInline("*i*")), [{ i: ["i"] }]);
  assert.deepEqual(shape(parseInline("**b**")), [{ b: ["b"] }]);
  assert.deepEqual(shape(parseInline("***both***")), [
    { b: [{ i: ["both"] }] },
  ]);
  assert.deepEqual(shape(parseInline("__b__")), [{ b: ["b"] }]);
  assert.deepEqual(shape(parseInline("_i_")), [{ i: ["i"] }]);
});

test("emphasis nests and sits alongside plain text", () => {
  assert.deepEqual(shape(parseInline("a **b _c_** d")), [
    "a ",
    { b: ["b ", { i: ["c"] }] },
    " d",
  ]);
});

test("an underscore inside a word is part of the word", () => {
  assert.deepEqual(shape(parseInline("call read_file_now once")), [
    "call read_file_now once",
  ]);
});

test("arithmetic and bullets survive as text", () => {
  assert.deepEqual(shape(parseInline("2 * 3 * 4")), ["2 * 3 * 4"]);
  assert.deepEqual(shape(parseInline("a * b")), ["a * b"]);
});

test("an unclosed marker stays literal", () => {
  // The state every document passes through while being typed.
  assert.deepEqual(shape(parseInline("**half typed")), ["**half typed"]);
  assert.deepEqual(shape(parseInline("*")), ["*"]);
  assert.deepEqual(shape(parseInline("_")), ["_"]);
});

test("inline code is verbatim", () => {
  assert.deepEqual(shape(parseInline("run `npm test` now")), [
    "run ",
    { code: "npm test" },
    " now",
  ]);

  // Markup inside code is not markup.
  assert.deepEqual(shape(parseInline("`**not bold**`")), [
    { code: "**not bold**" },
  ]);
});

test("a backtick with no partner stays literal", () => {
  assert.deepEqual(shape(parseInline("a ` b")), ["a ` b"]);
});

test("links keep their label and target", () => {
  assert.deepEqual(shape(parseInline("see [the docs](https://x.dev/a)")), [
    "see ",
    { href: "https://x.dev/a", text: ["the docs"] },
  ]);
});

test("a link label can hold emphasis", () => {
  assert.deepEqual(shape(parseInline("[**bold** link](https://x.dev)")), [
    { href: "https://x.dev", text: [{ b: ["bold"] }, " link"] },
  ]);
});

test("malformed links stay literal", () => {
  assert.deepEqual(shape(parseInline("[label] (spaced)")), ["[label] (spaced)"]);
  assert.deepEqual(shape(parseInline("[empty]()")), ["[empty]()"]);
});

test("a link still being typed degrades to its bare URL", () => {
  // The closing bracket is always the last thing written. Rather than swallow the
  // rest of the line, the syntax stays visible and the URL itself stays usable.
  assert.deepEqual(shape(parseInline("[unclosed](https://x.dev")), [
    "[unclosed](",
    { href: "https://x.dev", text: ["https://x.dev"] },
  ]);
});

test("a bare URL becomes a link without eating the sentence", () => {
  assert.deepEqual(shape(parseInline("go to https://x.dev/a, then stop")), [
    "go to ",
    { href: "https://x.dev/a", text: ["https://x.dev/a"] },
    ", then stop",
  ]);
});

test("escapes produce the literal character", () => {
  assert.deepEqual(shape(parseInline("\\*not italic\\*")), ["*not italic*"]);
  assert.deepEqual(shape(parseInline("a \\` b")), ["a ` b"]);
});

test("bullet lists group consecutive items", () => {
  const [list] = parseMarkdown("- milk\n- eggs\n* bread");

  assert.equal(list.type, "list");
  assert.equal(list.ordered, false);
  assert.deepEqual(
    list.items.map((item) => shape(item.children)),
    [["milk"], ["eggs"], ["bread"]],
  );
});

test("ordered lists keep their numbers", () => {
  const [list] = parseMarkdown("1. first\n2. second\n5. fifth");

  assert.equal(list.ordered, true);
  assert.deepEqual(
    list.items.map((item) => item.number),
    [1, 2, 5],
  );
});

test("indentation becomes nesting depth", () => {
  const [list] = parseMarkdown("- top\n  - nested\n    - deeper\n- top again");

  assert.deepEqual(
    list.items.map((item) => item.depth),
    [0, 1, 2, 0],
  );
});

test("switching marker style starts a new list", () => {
  const blocks = parseMarkdown("- bullet\n1. numbered");

  assert.deepEqual(
    blocks.map((block) => [block.type, block.ordered]),
    [
      ["list", false],
      ["list", true],
    ],
  );
});

test("list items can hold emphasis and code", () => {
  const [list] = parseMarkdown("- buy **milk**\n- run `test`");

  assert.deepEqual(shape(list.items[0].children), ["buy ", { b: ["milk"] }]);
  assert.deepEqual(shape(list.items[1].children), ["run ", { code: "test" }]);
});

test("a lone hyphen is not a list", () => {
  const [block] = parseMarkdown("-");

  assert.equal(block.type, "paragraph");
});

test("quotes hold blocks of their own", () => {
  const [quote] = parseMarkdown("> Something said\n> ## and shouted");

  assert.equal(quote.type, "quote");
  assert.deepEqual(
    quote.blocks.map((block) => block.type),
    ["paragraph", "heading"],
  );
});

test("a wrapped quote line continues the quote", () => {
  const [quote] = parseMarkdown("> starts here\nand keeps going");

  assert.equal(quote.type, "quote");
  assert.deepEqual(shape(quote.blocks[0].children), [
    "starts here\nand keeps going",
  ]);
});

test("a list under a quote is not swallowed by it", () => {
  const blocks = parseMarkdown("> quoted\n- not quoted");

  assert.deepEqual(
    blocks.map((block) => block.type),
    ["quote", "list"],
  );
});

test("fenced code keeps every character", () => {
  const [code] = parseMarkdown("```js\nconst a = **1**;\n  indented\n```");

  assert.equal(code.type, "code");
  assert.equal(code.language, "js");
  assert.equal(code.value, "const a = **1**;\n  indented");
});

test("a fence with no language has none", () => {
  const [code] = parseMarkdown("```\nplain\n```");

  assert.equal(code.language, null);
  assert.equal(code.value, "plain");
});

test("an unterminated fence still renders as code", () => {
  // Reached constantly while typing: the closing fence is always the last thing
  // written. Dropping the text would be worse than closing it for the writer.
  const [code] = parseMarkdown("```\nstill writing");

  assert.equal(code.type, "code");
  assert.equal(code.value, "still writing");
});

test("tildes fence too, and do not close a backtick fence", () => {
  const [tilde] = parseMarkdown("~~~\nbody\n~~~");
  assert.equal(tilde.type, "code");
  assert.equal(tilde.value, "body");

  const [mixed] = parseMarkdown("```\nbody\n~~~\nmore\n```");
  assert.equal(mixed.value, "body\n~~~\nmore");
});

test("rules are recognised in their usual spellings", () => {
  for (const source of ["---", "***", "___", "- - -", "*****"]) {
    const [block] = parseMarkdown(source);

    assert.equal(block.type, "rule", `${source} should be a rule`);
  }
});

test("two hyphens is text, not a rule", () => {
  const [block] = parseMarkdown("--");

  assert.equal(block.type, "paragraph");
});

test("a whole note parses into the blocks it looks like", () => {
  const blocks = parseMarkdown(
    [
      "# Trip",
      "",
      "Leaving on **Friday**. Ticket: [booking](https://air.example/x)",
      "",
      "## Packing",
      "- charger",
      "- 2 books",
      "",
      "> Check the passport expiry",
      "",
      "```sh",
      "echo pack",
      "```",
      "",
      "---",
    ].join("\n"),
  );

  assert.deepEqual(
    blocks.map((block) => block.type),
    [
      "heading",
      "paragraph",
      "heading",
      "list",
      "quote",
      "code",
      "rule",
    ],
  );
});

test("empty and whitespace-only sources produce nothing", () => {
  assert.deepEqual(parseMarkdown(""), []);
  assert.deepEqual(parseMarkdown("\n\n   \n"), []);
});

test("carriage returns are handled like newlines", () => {
  const blocks = parseMarkdown("# One\r\n\r\nBody");

  assert.deepEqual(
    blocks.map((block) => block.type),
    ["heading", "paragraph"],
  );
  assert.deepEqual(shape(blocks[0].children), ["One"]);
});

test("previews show the words, not the syntax", () => {
  assert.equal(
    toPlainText("## Shopping **list**\n\n- milk\n- `eggs`"),
    "Shopping list milk eggs",
  );

  assert.equal(
    toPlainText("See [the docs](https://x.dev) for more"),
    "See the docs for more",
  );

  assert.equal(toPlainText("---\n\n# Title"), "Title");
  assert.equal(toPlainText(""), "");
});

test("parsing is not quadratic on a long note", () => {
  // A guard on the shape of the algorithm rather than a benchmark: a scan that
  // restarts on every character would not finish this in a reasonable time.
  const source = Array.from(
    { length: 4000 },
    (_, index) => `- item ${index} with **bold** and \`code\``,
  ).join("\n");

  const started = process.hrtime.bigint();
  const [list] = parseMarkdown(source);
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;

  assert.equal(list.items.length, 4000);
  assert.ok(elapsedMs < 1000, `parsing took ${Math.round(elapsedMs)}ms`);
});
