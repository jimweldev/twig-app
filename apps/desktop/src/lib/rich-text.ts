/**
 * Rich text is stored as the HTML the editor writes (paragraphs, bold, italic, underline,
 * superscript, subscript, lists and LaTeX equations). Older values, and what ChatGPT sends
 * back, are plain text: they are turned into HTML when shown, so both kinds can sit in the
 * same field. In plain text an equation is LaTeX between dollar signs, e.g. $x^2 + 1$.
 */

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Whether a stored value is editor HTML rather than plain text. */
export const isHtml = (value: string) => /^\s*<(p|ol|ul|h[1-6]|blockquote|div)[\s>]/i.test(value);

/**
 * $LaTeX$ in plain text. Money like "$5 and $10" isn't math: the inside can't start or
 * end with a space, and can't be only a number.
 */
const INLINE_MATH = /\$(?!\s)([^$\n]+?)(?<!\s)\$/g;

/** A line of plain text as HTML, with $LaTeX$ as equations. */
export function inlineHtml(line: string): string {
  let out = "";
  let last = 0;
  for (const m of line.matchAll(INLINE_MATH)) {
    if (/^[\d.,]+$/.test(m[1])) continue;
    out += escapeHtml(line.slice(last, m.index));
    out += `<span data-type="inline-math" data-latex="${escapeHtml(m[1])}"></span>`;
    last = m.index + m[0].length;
  }
  return out + escapeHtml(line.slice(last));
}

const NUMBERED = /^\d+[.)]\s+/;
const BULLET = /^[-•*]\s+/;

/**
 * Plain text as editor HTML: "1. " lines become a numbered list, "- " lines a bulleted one,
 * and $LaTeX$ an equation.
 */
export function textToHtml(text: string): string {
  const out: string[] = [];
  let list: "ol" | "ul" | null = null;
  const close = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };
  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      close();
      continue;
    }
    const kind = NUMBERED.test(line) ? "ol" : BULLET.test(line) ? "ul" : null;
    if (kind !== list) close();
    if (kind) {
      if (!list) out.push(`<${kind}>`);
      list = kind;
      out.push(`<li><p>${inlineHtml(line.replace(kind === "ol" ? NUMBERED : BULLET, ""))}</p></li>`);
    } else {
      out.push(`<p>${inlineHtml(line)}</p>`);
    }
  }
  close();
  return out.join("");
}

/** Any stored value as editor HTML. */
export const toHtml = (value: string | undefined) => (!value ? "" : isHtml(value) ? value : textToHtml(value));

const decode = (text: string) =>
  text
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

const DOLLAR = "$";

/**
 * Any stored value as plain text, e.g. for the ChatGPT prompt. Lists keep their "1. " and
 * "- ", and equations go back to $LaTeX$ ($$LaTeX$$ for one on its own line).
 */
export function toText(value: string | undefined): string {
  if (!value) return "";
  if (!isHtml(value)) return value;
  let n = 0;
  const numbered: boolean[] = [];
  const text = value
    .replace(
      /<div[^>]*data-latex="([^"]*)"[^>]*><\/div>/gi,
      (_, latex: string) => DOLLAR.repeat(2) + latex + DOLLAR.repeat(2) + "\n",
    )
    .replace(/<span[^>]*data-latex="([^"]*)"[^>]*><\/span>/gi, (_, latex: string) => DOLLAR + latex + DOLLAR)
    .replace(/<(ol|ul)[^>]*>|<\/(ol|ul)>|<li[^>]*>|<\/p>|<br\s*\/?>/gi, (tag) => {
      const t = tag.toLowerCase();
      if (t.startsWith("<ol")) (numbered.push(true), (n = 0));
      else if (t.startsWith("<ul")) numbered.push(false);
      else if (t.startsWith("</ol") || t.startsWith("</ul")) numbered.pop();
      else if (t.startsWith("<li")) return numbered[numbered.length - 1] ? `${++n}. ` : "- ";
      else return "\n";
      return "";
    })
    .replace(/<[^>]+>/g, "");
  return decode(text)
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l, i, all) => l || (i > 0 && all[i - 1]))
    .join("\n")
    .trim();
}

/** Whether a stored value has any words in it (an emptied editor leaves "<p></p>"). */
export const hasText = (value: string | undefined) => toText(value).trim() !== "";
