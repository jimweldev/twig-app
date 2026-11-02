import katex from "katex";
import "katex/dist/katex.min.css";
import { inlineHtml, toHtml } from "@/lib/rich-text";

const unescapeAttr = (text: string) =>
  text
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

/** Editor HTML with its equations drawn by KaTeX (the editor stores only their LaTeX). */
function withEquations(html: string) {
  return html.replace(
    /<(span|div)([^>]*)data-latex="([^"]*)"([^>]*)><\/\1>/gi,
    (_, tag: string, before: string, latex: string, after: string) =>
      `<${tag}${before}${after}>${katex.renderToString(unescapeAttr(latex), {
        throwOnError: false,
        displayMode: tag.toLowerCase() === "div",
      })}</${tag}>`,
  );
}

/** A stored value as printed: editor HTML, or plain text turned into paragraphs and lists. */
export function Rich({ value }: { value: string | undefined }) {
  return <div className="rich-text" dangerouslySetInnerHTML={{ __html: withEquations(toHtml(value)) }} />;
}

/** One line of plain text, with $LaTeX$ drawn as equations. */
export function MathText({ text }: { text: string }) {
  return <span dangerouslySetInnerHTML={{ __html: withEquations(inlineHtml(text)) }} />;
}
