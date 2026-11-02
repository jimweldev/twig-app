import { gradeLabel } from "@/ecr/levels";
import { readJsonReply, unescapeBreaks } from "@/lib/ai-reply";
import { hasText, toText as richToText } from "@/lib/rich-text";

export { unescapeBreaks };

/**
 * ILAW lesson plan (DepEd Order No. 16, s. 2026): Intentions, Learning Experience,
 * Assessing Learning, Ways Forward. It replaces the DLL/DLP of DO 42, s. 2016.
 */
export type PartId = "I" | "L" | "A" | "W";

export const PARTS: { id: PartId; title: string }[] = [
  { id: "I", title: "Intentions" },
  { id: "L", title: "Learning Experience" },
  { id: "A", title: "Assessing Learning" },
  { id: "W", title: "Ways Forward" },
];

export type SectionKey =
  | "content_standard"
  | "performance_standard"
  | "competency"
  | "objectives"
  | "learner_context"
  | "pre_lesson"
  | "flow"
  | "resources"
  | "integration"
  | "assessment"
  | "extended_learning"
  | "reflection";

export interface SectionDef {
  key: SectionKey;
  part: PartId;
  label: string;
  /** Shown under the box in the editor and sent to ChatGPT as what to write. */
  hint: string;
  /** Written by the teacher only; never asked of ChatGPT. */
  teacherOnly?: boolean;
  /** Written once per session: a column for each session on the printed plan. */
  perSession?: boolean;
}

export const SECTIONS: SectionDef[] = [
  {
    key: "content_standard",
    part: "I",
    label: "Content standard",
    hint: "What learners should know, from the curriculum guide",
  },
  {
    key: "performance_standard",
    part: "I",
    label: "Performance standard",
    hint: "What learners should be able to do with what they learned, from the curriculum guide",
  },
  {
    key: "competency",
    part: "I",
    label: "Learning competency",
    hint: "The MATATAG learning competency, with its code if known",
  },
  {
    key: "objectives",
    part: "I",
    perSession: true,
    label: "Learning objectives",
    hint: "The competency unpacked into knowledge, skills and the task learners will do",
  },
  {
    key: "learner_context",
    part: "I",
    perSession: true,
    label: "Learner context",
    hint: "What you've observed about the class: strengths, interests and barriers to learning",
  },
  {
    key: "pre_lesson",
    part: "L",
    perSession: true,
    label: "Pre-lesson",
    hint: "How learners are prepared for the lesson",
  },
  {
    key: "flow",
    part: "L",
    perSession: true,
    label: "Lesson flow",
    hint: "Activities for each session, in order, with time allotments, following learning design principles",
  },
  {
    key: "resources",
    part: "L",
    perSession: true,
    label: "Learning resources",
    hint: "Materials needed, with low-cost or offline alternatives in case of emergencies",
  },
  {
    key: "integration",
    part: "L",
    perSession: true,
    label: "Opportunities for integration",
    hint: "Links to other learning areas, special topics and technology",
  },
  {
    key: "assessment",
    part: "A",
    perSession: true,
    label: "Formative assessment",
    hint: "Tasks, activities and questions that check learning, with accommodations for learners who need them",
  },
  {
    key: "extended_learning",
    part: "W",
    perSession: true,
    label: "Extended learning opportunities",
    hint: "Activities learners can do outside the classroom",
  },
  {
    key: "reflection",
    part: "W",
    label: "Reflections",
    hint: "After the lesson: what to change, what interested learners, what to ask a coach about",
    teacherOnly: true,
  },
];

/** Everything written in the plan besides its header numbers. */
export interface PlanContent extends Partial<Record<SectionKey, string>> {
  references?: string;
  /** Declaration of AI use: which tool helped and how the teacher checked it. */
  ai_declaration?: string;
  /** Names under the signatures; prepared and noted default to the teacher and school head in the profile. */
  prepared_by?: string;
  checked_by?: string;
  noted_by?: string;
  /** Positions under the signatures, e.g. "Teacher I", "Head Teacher III", "Principal IV". */
  prepared_position?: string;
  checked_position?: string;
  noted_position?: string;
  /**
   * Per-session parts, one entry per session. The plain field of the same key, when
   * set, is text for all sessions (plans written before sessions had their own column).
   */
  by_session?: Partial<Record<SectionKey, string[]>>;
  /** This plan's own footer images; without it the plan prints the default footer from Lesson plans › Settings. */
  footer?: { left: string[]; right: string[] };
}

/** The text a per-session part has for session `i` (0-based). */
export const sessionText = (content: PlanContent, key: SectionKey, i: number) => content.by_session?.[key]?.[i] ?? "";

/** Whether a per-session part has anything written in any session column. */
export const hasSessionText = (content: PlanContent, key: SectionKey) => !!content.by_session?.[key]?.some(hasText);

/** Content with session `i`'s text of a per-session part changed. */
export function withSessionText(content: PlanContent, key: SectionKey, i: number, text: string): PlanContent {
  const list = [...(content.by_session?.[key] ?? [])];
  while (list.length <= i) list.push("");
  list[i] = text;
  return { ...content, by_session: { ...content.by_session, [key]: list } };
}

export interface LessonPlan {
  id: number;
  title: string;
  grade_level: number;
  learning_area: string;
  /** Free text, e.g. "Rizal, Mabini". */
  sections: string;
  term: number;
  week: number;
  sessions: number;
  minutes: number;
  content: PlanContent;
  updated_at: string;
}

/** The Declaration of AI use written for the teacher when ChatGPT drafts a plan. */
export function aiDeclaration(teacherName = "") {
  const who = teacherName.trim() ? `I, ${teacherName.trim()}, ` : "I ";
  return `Consistent with the policy guidelines on the use of AI in basic education, ${who}declare that I used ChatGPT to help draft this lesson plan: its objectives, learning activities, assessment and extended learning.

I reviewed, adapted, edited and validated all outputs using my professional judgment to make sure they are accurate, appropriate and suited to my learners. No confidential learner information or sensitive school data was shared with the AI tool.`;
}

/** What the teacher tells ChatGPT on top of the plan's header. */
export interface PromptInput {
  topic: string;
  notes: string;
  language: "English" | "Filipino";
}

/** Keys ChatGPT fills in. `title` and `references` sit in the header but are worth drafting too. */
const AI_KEYS = ["title", ...SECTIONS.filter((s) => !s.teacherOnly).map((s) => s.key), "references"] as const;
export type AiKey = (typeof AI_KEYS)[number];

const PER_SESSION_KEYS = new Set<string>(SECTIONS.filter((s) => s.perSession).map((s) => s.key));

/** What ChatGPT is asked to write for each key: concrete enough to come back print-ready. */
const AI_HINTS: Partial<Record<AiKey, string>> = {
  title: "A short lesson title, at most 8 words",
  content_standard: "The MATATAG content standard for this grade, learning area and term, in one or two sentences",
  performance_standard: "The MATATAG performance standard, in one or two sentences",
  competency: "The MATATAG learning competency, in one sentence, with its code if you know it",
  objectives: '2 or 3 numbered objectives ("1. ..."), each starting with a measurable verb',
  learner_context:
    "1 or 2 short lines on what learners likely bring to this session: strengths, interests and possible barriers",
  pre_lesson: "2 or 3 short lines: how learners get ready (review, motivation, routines), with minutes",
  flow: '4 to 6 short lines, each "Activity name (N min): what learners and the teacher do"',
  resources: "1 to 3 short lines: materials, plus a low-cost or offline alternative",
  integration: '1 or 2 short lines linking to another learning area, special topic or technology, or "N/A"',
  assessment:
    "The actual task learners answer: its directions, then the numbered items (e.g. 5 questions with blanks or choices), then a one-line scoring guide or answer key",
  extended_learning: "1 or 2 short lines: something learners can do at home with no internet needed",
  references: "Each book, curriculum guide, learner's material or website as its own line",
};

/** How long a session's text may run, so the printed table stays readable. */
const WORD_LIMITS: Partial<Record<AiKey, number>> = {
  objectives: 45,
  learner_context: 35,
  pre_lesson: 45,
  flow: 110,
  resources: 40,
  integration: 35,
  assessment: 120,
  extended_learning: 40,
};

/** The message the teacher copies into ChatGPT. Asks for a JSON reply the app can read back. */
export function buildPrompt(plan: LessonPlan, input: PromptInput): string {
  const c = plan.content;
  // Plan parts may be editor HTML; ChatGPT gets them as plain text.
  const known = (label: string, value: string | undefined) =>
    hasText(value) ? [`- ${label}: ${richToText(value).trim()}`] : [];
  const details = [
    `- Learning area: ${plan.learning_area || "(not set)"}`,
    `- Grade level: ${gradeLabel(plan.grade_level)}`,
    ...known("Topic", input.topic || plan.title),
    `- Term ${plan.term}, Week ${plan.week}`,
    `- ${plan.sessions} session${plan.sessions === 1 ? "" : "s"} of ${plan.minutes} minutes each`,
    ...known("Learning competency", c.competency),
    ...known("Content standard", c.content_standard),
    ...known("Performance standard", c.performance_standard),
    ...known("Learner context", c.learner_context),
    ...known("Teacher's notes", input.notes),
  ];
  const n = plan.sessions;
  const sessions = `${n} session${n === 1 ? "" : "s"}`;
  const schema = AI_KEYS.map((k, i) => {
    const limit = WORD_LIMITS[k] ? `, at most ${WORD_LIMITS[k]} words per session` : "";
    const value = PER_SESSION_KEYS.has(k)
      ? `[${Array.from({ length: n }, (_, i) => `["session ${i + 1} line", "..."]`).join(", ")}]`
      : k === "references"
        ? `["line", "..."]`
        : `"text"`;
    const comma = i < AI_KEYS.length - 1 ? "," : "";
    return `  "${k}": ${value}${comma}  // ${AI_HINTS[k]}${limit}`;
  }).join("\n");

  return `You are helping a Filipino public school teacher draft a lesson plan in the ILAW format of DepEd Order No. 16, s. 2026 (Intentions, Learning Experience, Assessing Learning, Ways Forward) for the MATATAG curriculum.

Lesson details:
${details.join("\n")}

Guidelines:
- Follow the teacher's notes closely: what they ask for each session, the activities, the assessment and the learners come first over these guidelines.
- Write in ${input.language}. Be practical for a real Philippine public school classroom with limited resources.
- The lesson runs ${sessions}. Each session's pre-lesson and flow together must fit in ${plan.minutes} minutes. Every timed step gets at least 1 minute: leave a step out rather than give it 0 min.
- Plan the sessions as a sequence: each builds on the one before. If there are 3 or more sessions, the last one may be an assessment or summative session.
- If the learning competency or standards are not given, use the matching ones from the DepEd MATATAG curriculum guide for this grade and learning area.
- Make the activities learner-centered and concrete: say what learners do, not only what the teacher explains.
- Write it ready to print. No disclaimers, caveats, "verify this" notes or notes to the teacher anywhere in the values. If you are unsure of exact curriculum wording, write your best version plainly.
- References list only learning materials (books, learner's materials, websites). Do not list this prompt, DepEd orders on lesson planning, or "as specified" notes.

Format of the reply:
- ONLY one JSON code block, no other text, exactly the keys below. The // notes explain each key; do not include them.
- Never write "\\n" inside a string. When a part has several lines, give a list of strings, one line each.
- A per-session key is a list of exactly ${n} item${n === 1 ? "" : "s"}, one per session in order, and each item is a list of lines. Do not add "Session 1" labels.
- Start a line with "1. ", "2. " for numbered items; otherwise write plain sentences without "- ".
- Write any math or chemistry as LaTeX between single dollar signs, e.g. $\\frac{3}{4}$, $x^2 + 5x + 6 = 0$, $H_2O$. Use plain words for everything else.

\`\`\`json
{
${schema}
}
\`\`\``;
}

/** What ChatGPT wrote for each part: per-session parts may come back as one string per session. */
export type AiValues = Partial<Record<AiKey, string | string[]>>;

export type ParsedResponse = { ok: true; values: AiValues } | { ok: false; error: string };

/** Plan content with escaped line breaks fixed in every part, e.g. from a reply pasted before this fix. */
export function cleanContent(content: PlanContent): PlanContent {
  const out: PlanContent = {};
  for (const [k, v] of Object.entries(content)) {
    if (typeof v === "string") (out as Record<string, unknown>)[k] = unescapeBreaks(v);
    else if (k === "by_session" && v) {
      out.by_session = Object.fromEntries(
        Object.entries(v as Record<string, string[]>).map(([key, list]) => [key, list.map(unescapeBreaks)]),
      );
    } else (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

/** A list of lines as ChatGPT is asked to send them: one line each, kept as written. */
function linesText(value: unknown): string {
  if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
    return value
      .map((v) => unescapeBreaks(v).trim())
      .filter(Boolean)
      .join("\n");
  }
  return toText(value);
}

/** Turns whatever shape ChatGPT used for a value (string, list, nested object) into plain text. */
function toText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return unescapeBreaks(value).trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value
      .map((v) => toText(v))
      .filter(Boolean)
      .map((t) => (typeof value[0] === "string" && !/^([-•*]|\d+[.)])\s/.test(t) ? `- ${t}` : t))
      .join("\n");
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => {
        const text = toText(v);
        return text.includes("\n") ? `${k}:\n${text}` : `${k}: ${text}`;
      })
      .join("\n\n");
  }
  return "";
}

/** Reads ChatGPT's reply back into plan fields. Unknown keys are ignored. */
export function parseResponse(text: string): ParsedResponse {
  const reply = readJsonReply(text);
  if (!reply.ok) return reply;
  const values: AiValues = {};
  for (const key of AI_KEYS) {
    const raw = reply.data[key];
    if (PER_SESSION_KEYS.has(key) && Array.isArray(raw)) {
      // One entry per session; a "Session 2:" label ChatGPT added anyway is dropped.
      const list = raw.map((v) => linesText(v).replace(/^session\s*\d+\s*[:.-]\s*/i, ""));
      if (list.some(Boolean)) values[key] = list;
      continue;
    }
    const text = key === "references" ? linesText(raw) : toText(raw);
    if (text) values[key] = text;
  }
  if (Object.keys(values).length === 0) {
    return { ok: false, error: "None of the lesson plan parts were found in the reply." };
  }
  return { ok: true, values };
}

export const AI_LABELS: Record<AiKey, string> = {
  title: "Lesson title",
  references: "References",
  ...(Object.fromEntries(SECTIONS.map((s) => [s.key, s.label])) as Record<SectionKey, string>),
};

/**
 * Plan content with ChatGPT's reply filled in. The title stays the teacher's, and the
 * Declaration of AI use is filled in when blank.
 */
export function withAiValues(content: PlanContent, values: AiValues, teacherName = ""): PlanContent {
  const next: PlanContent = { ...content, by_session: { ...content.by_session } };
  for (const [key, value] of Object.entries(values) as [AiKey, string | string[]][]) {
    if (key === "title") continue;
    if (Array.isArray(value)) {
      // Session columns replace any all-sessions text the part had.
      next.by_session![key as SectionKey] = value;
      delete next[key as SectionKey];
    } else {
      next[key] = value;
      if (PER_SESSION_KEYS.has(key)) delete next.by_session![key as SectionKey];
    }
  }
  next.ai_declaration = hasText(content.ai_declaration) ? content.ai_declaration : aiDeclaration(teacherName);
  return next;
}

/** A title value from ChatGPT's reply, which is always one string. */
export const aiTitle = (values: AiValues) => (typeof values.title === "string" ? values.title : undefined);
