/**
 * Reading back what ChatGPT sends when asked for "one JSON code block": the JSON is
 * found in the reply and repaired for the usual slips before it's parsed.
 */

/**
 * Real line breaks for the ones ChatGPT sometimes double-escapes, which arrive as a
 * literal backslash and "n".
 */
export const unescapeBreaks = (text: string) =>
  text
    .replace(/\r\n/g, "\n")
    // Not when a lowercase letter follows: that's LaTeX like \neq, \theta or \times.
    .replace(/\\r\\n|\\n(?![a-z])/g, "\n")
    .replace(/\\t(?![a-z])/g, " ");

/**
 * JSON text with LaTeX backslashes kept. ChatGPT often writes \frac or \sqrt in a JSON
 * string with one backslash, which JSON reads as a form feed (\f) or rejects (\s). A
 * backslash before a word or a LaTeX symbol is doubled so it survives as written.
 */
const keepLatexBackslashes = (json: string) =>
  json.replace(/(?<!\\)\\(?=[a-zA-Z]{2}|[%,;:!{}_^&#$ ])(?!u[0-9a-fA-F]{4})/g, "\\\\");

/** The JSON object in a pasted reply: a ```json block if there is one, else the outermost braces. */
function extractJson(text: string): string | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  return start === -1 || end <= start ? null : body.slice(start, end + 1);
}

export type JsonReply = { ok: true; data: Record<string, unknown> } | { ok: false; error: string };

/** The one JSON object in ChatGPT's reply, or why it couldn't be read. */
export function readJsonReply(text: string): JsonReply {
  const json = extractJson(text);
  if (!json) return { ok: false, error: "No JSON found. Copy ChatGPT's whole reply, including the code block." };
  let data: unknown;
  try {
    // Smart quotes sneak in when a reply passes through a word processor.
    const fixed = keepLatexBackslashes(json.replace(/[“”]/g, '"'));
    try {
      data = JSON.parse(fixed);
    } catch {
      // The prompt's "// what this key is" notes, copied into the reply. URLs are safe: no space before their "//".
      data = JSON.parse(fixed.replace(/\s+\/\/[^\n"]*$/gm, ""));
    }
  } catch {
    return { ok: false, error: "The reply isn't valid JSON. Ask ChatGPT to resend it as one JSON code block." };
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, error: "The reply should be one JSON object." };
  }
  return { ok: true, data: data as Record<string, unknown> };
}
