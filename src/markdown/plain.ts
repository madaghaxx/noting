import { parseMarkdown, type Block, type Inline } from "./parse";

function flattenInline(nodes: Inline[]): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case "text":
          return node.value;
        case "code":
          return node.value;
        case "strong":
        case "em":
          return flattenInline(node.children);
        case "link":
          return flattenInline(node.children);
      }
    })
    .join("");
}

function flattenBlock(block: Block): string {
  switch (block.type) {
    case "heading":
    case "paragraph":
      return flattenInline(block.children);
    case "quote":
      return block.blocks.map(flattenBlock).join(" ");
    case "list":
      return block.items.map((item) => flattenInline(item.children)).join(" ");
    case "code":
      return block.value;
    case "rule":
      return "";
  }
}

/**
 * Markdown reduced to the words in it.
 *
 * Used for the one-line previews on note cards, where the syntax is noise: a card
 * reading "## Shopping **list**" tells you less than "Shopping list" does. Goes
 * through the parser rather than stripping characters with regexes, so what the
 * preview shows is exactly the text the rendered note shows.
 */
export function toPlainText(markdown: string): string {
  return parseMarkdown(markdown)
    .map(flattenBlock)
    .filter((text) => text.trim().length > 0)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
