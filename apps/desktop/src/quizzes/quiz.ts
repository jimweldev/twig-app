import { gradeLabel } from "@/ecr/levels";
import { readJsonReply, unescapeBreaks } from "@/lib/ai-reply";
import { hasText, toText as richToText } from "@/lib/rich-text";
import { sessionText, type LessonPlan, type SectionKey } from "@/lessons/plan";

/** The kinds of test the teacher can put in a quiz, each its own part (Test I, Test II, …). */
export type QuestionType = "multiple_choice" | "true_false" | "identification" | "matching" | "enumeration" | "essay";

export interface QuizItem {
  question: string;
  /** Multiple choice: the options in order (A, B, C, …). */
  choices?: string[];
  /**
   * The correct answer: a choice letter, "True" or "False", the word or phrase, the
   * Column B match, the enumerated answers one per line, or an essay's model answer.
   */
  answer: string;
}

export interface QuizPart {
  type: QuestionType;
  directions: string;
  /** Points for each item; for enumeration, for each answer. */
  points: number;
  items: QuizItem[];
  /** Essay: how answers are scored. */
  rubric?: string;
}

export type PaperSize = "short" | "long" | "a4";

export const PAPERS: Record<PaperSize, { label: string; widthIn: number; heightIn: number }> = {
  short: { label: "Short bond (8.5 × 11 in)", widthIn: 8.5, heightIn: 11 },
  long: { label: "Long bond (8.5 × 13 in)", widthIn: 8.5, heightIn: 13 },
  a4: { label: "A4", widthIn: 8.27, heightIn: 11.69 },
};

export interface QuizContent {
  /** General instructions printed above the first part. */
  instructions?: string;
  paper?: PaperSize;
  parts: QuizPart[];
}

export interface Quiz {
  id: number;
  title: string;
  /** The lesson plan it was made from, if any. */
  lesson_plan_id: number | null;
  grade_level: number;
  learning_area: string;
  content: QuizContent;
  updated_at: string;
}

interface TypeDef {
  label: string;
  /** What the part is called on the test paper, e.g. "Multiple Choice". */
  heading: string;
  directions: string;
  points: number;
  /** One item as ChatGPT should write it. */
  example: string;
  /** What makes a good item of this type. */
  guide: string;
}

export const QUESTION_TYPES: Record<QuestionType, TypeDef> = {
  multiple_choice: {
    label: "Multiple choice",
    heading: "Multiple Choice",
    directions:
      "Read each question carefully. Choose the letter of the correct answer and write it on the space before the number.",
    points: 1,
    example: `{ "question": "…", "choices": ["…", "…", "…", "…"], "answer": "B" }`,
    guide:
      'exactly 4 choices without "A." labels, one clearly correct, plausible wrong choices, no "all of the above"; spread the correct letters evenly',
  },
  true_false: {
    label: "True or false",
    heading: "True or False",
    directions: "Write TRUE if the statement is correct and FALSE if it is incorrect.",
    points: 1,
    example: `{ "question": "…", "answer": "True" }`,
    guide: 'a full statement; about half true; answer "True" or "False"; no trick wording',
  },
  identification: {
    label: "Identification",
    heading: "Identification",
    directions: "Identify what is being described. Write your answer on the space before the number.",
    points: 1,
    example: `{ "question": "…", "answer": "…" }`,
    guide: "a description whose answer is one word or a short term",
  },
  matching: {
    label: "Matching type",
    heading: "Matching Type",
    directions:
      "Match each item in Column A with its answer in Column B. Write the letter of your answer on the space before the number.",
    points: 1,
    example: `{ "question": "Column A description", "answer": "Column B term" }`,
    guide: "a short description in Column A and its term in Column B; every answer different",
  },
  enumeration: {
    label: "Enumeration",
    heading: "Enumeration",
    directions: "List what is asked. Write your answers on the lines provided.",
    points: 1,
    example: `{ "question": "Give the four …", "answer": ["…", "…", "…", "…"] }`,
    guide: "says how many to give; answer lists each expected answer",
  },
  essay: {
    label: "Essay",
    heading: "Essay",
    directions: "Answer each question in two to three sentences.",
    points: 5,
    example: `{ "question": "…", "answer": "what a complete answer includes" }`,
    guide: "asks learners to explain, compare or apply; answer says what a full-credit answer includes",
  },
};

export const TYPE_ORDER = Object.keys(QUESTION_TYPES) as QuestionType[];

export const LETTERS = "ABCDEFGH";
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
export const partNumber = (i: number) => ROMAN[i] ?? String(i + 1);

/** An enumeration item's expected answers. */
export const answerLines = (answer: string) =>
  answer
    .split("\n")
    .map((a) => a.trim())
    .filter(Boolean);

export function newItem(type: QuestionType): QuizItem {
  if (type === "multiple_choice") return { question: "", choices: ["", "", "", ""], answer: "A" };
  if (type === "true_false") return { question: "", answer: "True" };
  return { question: "", answer: "" };
}

export function newPart(type: QuestionType): QuizPart {
  const def = QUESTION_TYPES[type];
  return { type, directions: def.directions, points: def.points, items: [newItem(type)] };
}

/**
 * The part as another type, keeping its questions: switching types keeps the work done.
 * Answers that can't carry over (a choice letter turned true or false) start over.
 */
export function withType(part: QuizPart, type: QuestionType): QuizPart {
  const def = QUESTION_TYPES[type];
  const keepsDirections = part.directions === QUESTION_TYPES[part.type].directions || !part.directions.trim();
  return {
    ...part,
    type,
    directions: keepsDirections ? def.directions : part.directions,
    points: part.points === QUESTION_TYPES[part.type].points ? def.points : part.points,
    items: part.items.map((it) => ({ ...newItem(type), question: it.question })),
  };
}

export const itemPoints = (part: QuizPart, item: QuizItem) =>
  part.type === "enumeration" ? part.points * Math.max(1, answerLines(item.answer).length) : part.points;

export const partPoints = (part: QuizPart) => part.items.reduce((sum, it) => sum + itemPoints(part, it), 0);

export const quizPoints = (content: QuizContent) => content.parts.reduce((sum, p) => sum + partPoints(p), 0);

export const quizItems = (content: QuizContent) => content.parts.reduce((sum, p) => sum + p.items.length, 0);

/** A whole number from a string, for picking things in a stable "random" order. */
function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Column B of a matching part: the answers shuffled, the same way every time so the test
 * paper and its answer key agree. Never left in Column A's order.
 */
export function matchingColumn(part: QuizPart): string[] {
  const answers = part.items.map((it) => it.answer);
  const order = answers.map((a, i) => ({ a, key: hash(`${a}#${i}#${answers.join("|")}`) }));
  order.sort((x, y) => x.key - y.key);
  const shuffled = order.map((o) => o.a);
  if (shuffled.length > 1 && shuffled.every((a, i) => a === answers[i])) shuffled.push(shuffled.shift()!);
  return shuffled;
}

/** The answer to each item of a part as the answer key prints it. */
export function answerKey(part: QuizPart): string[] {
  switch (part.type) {
    case "multiple_choice":
      return part.items.map((it) => it.answer.toUpperCase());
    case "true_false":
      return part.items.map((it) => it.answer.toUpperCase());
    case "matching": {
      const column = matchingColumn(part);
      const used = new Set<number>();
      return part.items.map((it) => {
        const i = column.findIndex((a, j) => a === it.answer && !used.has(j));
        used.add(i);
        return i < 0 ? "" : (LETTERS[i] ?? String(i + 1));
      });
    }
    case "enumeration":
      return part.items.map((it) => answerLines(it.answer).join(", "));
    default:
      return part.items.map((it) => it.answer);
  }
}

// ---- Drafting with ChatGPT ----

/** What the teacher asks ChatGPT for. */
export interface QuizSpec {
  /** How many items of each type; types at 0 are left out. */
  counts: Partial<Record<QuestionType, number>>;
  /** Sessions of the lesson plan the quiz covers, 1-based; empty for all. */
  sessions: number[];
  notes: string;
  language: "English" | "Filipino";
}

/** The lesson plan parts that say what the quiz should test, per covered session. */
const PLAN_KEYS: [SectionKey, string][] = [
  ["objectives", "Objectives"],
  ["flow", "What was taught"],
  ["assessment", "Formative assessment"],
];

/** The message the teacher copies into ChatGPT. Asks for a JSON reply the app can read back. */
export function buildQuizPrompt(
  quiz: Pick<Quiz, "title" | "grade_level" | "learning_area">,
  plan: LessonPlan | null,
  spec: QuizSpec,
): string {
  const text = (v: string | undefined) => (hasText(v) ? richToText(v).trim() : "");
  const details = [
    `- Learning area: ${quiz.learning_area || plan?.learning_area || "(not set)"}`,
    `- Grade level: ${gradeLabel(quiz.grade_level)}`,
    `- Topic: ${quiz.title || plan?.title || "(not set)"}`,
  ];
  const lesson: string[] = [];
  if (plan) {
    const c = plan.content;
    if (text(c.competency)) lesson.push(`- Learning competency: ${text(c.competency)}`);
    const sessions = spec.sessions.length
      ? spec.sessions.filter((s) => s >= 1 && s <= plan.sessions)
      : Array.from({ length: plan.sessions }, (_, i) => i + 1);
    for (const s of sessions) {
      const parts = PLAN_KEYS.map(([key, label]) => {
        const t = text(sessionText(c, key, s - 1) || (s === sessions[0] ? c[key] : ""));
        return t ? `  ${label}:\n${t.replace(/^/gm, "    ")}` : "";
      }).filter(Boolean);
      if (parts.length) lesson.push(`- Session ${s}:\n${parts.join("\n")}`);
    }
  }
  if (spec.notes.trim()) details.push(`- Teacher's notes: ${spec.notes.trim()}`);

  const wanted = TYPE_ORDER.filter((t) => (spec.counts[t] ?? 0) > 0);
  const total = wanted.reduce((sum, t) => sum + (spec.counts[t] ?? 0), 0);
  const items = (n = 0) => `${n} item${n === 1 ? "" : "s"}`;
  const tests = wanted.map((t, i) => `${i + 1}. ${QUESTION_TYPES[t].label}: ${items(spec.counts[t])}`).join("\n");
  const shapes = wanted.map((t) => `- ${t}: ${QUESTION_TYPES[t].example} (${QUESTION_TYPES[t].guide})`).join("\n");
  const schemaParts = wanted
    .map(
      (t) =>
        `    { "type": "${t}", "directions": "…", "items": [ ${items(spec.counts[t])} ]${t === "essay" ? `, "rubric": "…"` : ""} }`,
    )
    .join(",\n");

  return `You are helping a Filipino public school teacher write a quiz for the DepEd MATATAG curriculum.

Quiz details:
${details.join("\n")}
${lesson.length ? `\nWhat the lesson covered (the quiz tests only this):\n${lesson.join("\n")}\n` : ""}
Write these tests, in this order (${total} items in all):
${tests}

Guidelines:
- Follow the teacher's notes first.
- Write in ${spec.language}, at a reading level that fits ${gradeLabel(quiz.grade_level)}.
- Test the learning competency and objectives. Mix the difficulty: about 60% easy (remembering, understanding), 30% average (applying) and 10% difficult (analyzing, evaluating).
- Every item must be correct and have one defensible answer. No trick questions, no repeated items, and no item that gives away another's answer.
- Keep directions to one or two sentences, for learners.

Format of the reply:
- ONLY one JSON code block, no other text.
- Do not number the items or letter the choices; the app does that.
- Never write "\\n" inside a string.
- Write any math or chemistry as LaTeX between single dollar signs, e.g. $\\frac{3}{4}$, $H_2O$.
- Each item by type:
${shapes}

\`\`\`json
{
  "title": "a short quiz title",
  "parts": [
${schemaParts}
  ]
}
\`\`\``;
}

/** A value ChatGPT sent as text, a list or a number, as one string. */
function str(value: unknown): string {
  if (typeof value === "string") return unescapeBreaks(value).trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(str).filter(Boolean).join("\n");
  return "";
}

/** The type a part says it is, from its key or a label like "True or False". */
function typeOf(value: unknown): QuestionType | null {
  const t = str(value)
    .toLowerCase()
    .replace(/[^a-z]+/g, "_");
  if (t in QUESTION_TYPES) return t as QuestionType;
  if (t.includes("choice")) return "multiple_choice";
  if (t.includes("true") || t.includes("false")) return "true_false";
  if (t.includes("ident") || t.includes("fill") || t.includes("short")) return "identification";
  if (t.includes("match")) return "matching";
  if (t.includes("enum") || t.includes("list")) return "enumeration";
  if (t.includes("essay") || t.includes("explain")) return "essay";
  return null;
}

/** An item as stored: choices without "A." labels, answers in the form each type keeps. */
function readItem(type: QuestionType, raw: unknown): QuizItem | null {
  if (typeof raw === "string") return raw.trim() ? { ...newItem(type), question: str(raw) } : null;
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const question = str(r.question ?? r.statement ?? r.item ?? r.prompt).replace(/^\d+[.)]\s*/, "");
  if (!question) return null;
  const answer = r.answer ?? r.correct ?? r.correct_answer ?? r.key;

  if (type === "multiple_choice") {
    const choices = (Array.isArray(r.choices ?? r.options) ? ((r.choices ?? r.options) as unknown[]) : [])
      .map(str)
      .map((c) => c.replace(/^[A-Ha-h][.)]\s+/, ""));
    const a = str(answer);
    const letter = /^([A-Ha-h])(?:[.)]|$|\s)/.exec(a)?.[1]?.toUpperCase();
    const byText = choices.findIndex((c) => c.toLowerCase() === a.toLowerCase());
    const byIndex = typeof answer === "number" && choices[answer] !== undefined ? answer : -1;
    // The choice's own words first: an answer like "A cell" is a choice, not the letter A.
    const i = byText >= 0 ? byText : letter ? LETTERS.indexOf(letter) : byIndex;
    return { question, choices, answer: LETTERS[Math.max(0, i)] };
  }
  if (type === "true_false") {
    const a = str(answer).toLowerCase();
    const truthy = answer === true || /^(t|true|tama|totoo|yes)\b/.test(a);
    return { question, answer: truthy ? "True" : "False" };
  }
  return { question, answer: str(answer) };
}

export type ParsedQuiz = { ok: true; title: string; parts: QuizPart[] } | { ok: false; error: string };

/** Reads ChatGPT's reply back into quiz parts. Parts of an unknown type are skipped. */
export function parseQuizResponse(text: string): ParsedQuiz {
  const reply = readJsonReply(text);
  if (!reply.ok) return reply;
  const rawParts = reply.data.parts ?? reply.data.tests;
  if (!Array.isArray(rawParts)) return { ok: false, error: 'The reply has no "parts" list.' };
  const parts: QuizPart[] = [];
  for (const raw of rawParts) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const type = typeOf(r.type);
    if (!type) continue;
    const items = (Array.isArray(r.items) ? r.items : []).map((it) => readItem(type, it)).filter((it) => !!it);
    if (!items.length) continue;
    const def = QUESTION_TYPES[type];
    const points = Number(r.points);
    parts.push({
      type,
      directions: str(r.directions) || def.directions,
      points: points > 0 ? points : def.points,
      items,
      ...(type === "essay" && str(r.rubric) ? { rubric: str(r.rubric) } : {}),
    });
  }
  if (!parts.length) return { ok: false, error: "No test items were found in the reply." };
  return { ok: true, title: str(reply.data.title), parts };
}
