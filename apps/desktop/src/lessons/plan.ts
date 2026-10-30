import { gradeLabel } from "@/ecr/levels";

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
    label: "Learning objectives",
    hint: "The competency unpacked into knowledge, skills and the task learners will do",
  },
  {
    key: "learner_context",
    part: "I",
    label: "Learner context",
    hint: "What you've observed about the class: strengths, interests and barriers to learning",
  },
  { key: "pre_lesson", part: "L", label: "Pre-lesson", hint: "How learners are prepared for the lesson" },
  {
    key: "flow",
    part: "L",
    label: "Lesson flow",
    hint: "Activities for each session, in order, with time allotments, following learning design principles",
  },
  {
    key: "resources",
    part: "L",
    label: "Learning resources",
    hint: "Materials needed, with low-cost or offline alternatives in case of emergencies",
  },
  {
    key: "integration",
    part: "L",
    label: "Opportunities for integration",
    hint: "Links to other learning areas, special topics and technology",
  },
  {
    key: "assessment",
    part: "A",
    label: "Formative assessment",
    hint: "Tasks, activities and questions that check learning, with accommodations for learners who need them",
  },
  {
    key: "extended_learning",
    part: "W",
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
  checked_by?: string;
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

export const DEFAULT_AI_DECLARATION =
  "ChatGPT was used to draft parts of this lesson plan. The teacher reviewed, revised and validated all content before use.";

/** What the teacher tells ChatGPT on top of the plan's header. */
export interface PromptInput {
  topic: string;
  notes: string;
  language: "English" | "Filipino";
}

/** Keys ChatGPT fills in. `title` and `references` sit in the header but are worth drafting too. */
const AI_KEYS = ["title", ...SECTIONS.filter((s) => !s.teacherOnly).map((s) => s.key), "references"] as const;
export type AiKey = (typeof AI_KEYS)[number];

const AI_HINTS: Record<AiKey, string> = {
  title: "A short lesson title",
  references: "Books, curriculum guides, websites and toolkits used, one per line",
  ...(Object.fromEntries(SECTIONS.map((s) => [s.key, s.hint])) as Record<SectionKey, string>),
};

/** The message the teacher copies into ChatGPT. Asks for a JSON reply the app can read back. */
export function buildPrompt(plan: LessonPlan, input: PromptInput): string {
  const c = plan.content;
  const known = (label: string, value: string | undefined) => (value?.trim() ? [`- ${label}: ${value.trim()}`] : []);
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
  const schema = AI_KEYS.map((k) => `  "${k}": "${AI_HINTS[k]}"`).join(",\n");

  return `You are helping a Filipino public school teacher draft a lesson plan in the ILAW format of DepEd Order No. 16, s. 2026 (Intentions, Learning Experience, Assessing Learning, Ways Forward) for the MATATAG curriculum.

Lesson details:
${details.join("\n")}

Guidelines:
- Write in ${input.language}. Be practical for a real Philippine public school classroom with limited resources.
- If the learning competency or standards are not given, use the matching ones from the DepEd MATATAG curriculum guide for this grade and learning area.
- Make the activities learner-centered, and give the time for each part of the flow. Label each session ("Session 1", "Session 2", ...).
- The teacher will review and revise your draft; do not include notes to the teacher.

Reply with ONLY one JSON code block and no other text. Use exactly these keys. Every value is a string; use "\\n" for line breaks and "- " to start list items:
\`\`\`json
{
${schema}
}
\`\`\``;
}

export type ParsedResponse = { ok: true; values: Partial<Record<AiKey, string>> } | { ok: false; error: string };

/** Turns whatever shape ChatGPT used for a value (string, list, nested object) into plain text. */
function toText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.replace(/\r\n/g, "\n").trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value
      .map((v) => toText(v))
      .filter(Boolean)
      .map((t) => (typeof value[0] === "string" && !/^[-•*]\s/.test(t) ? `- ${t}` : t))
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

/** The JSON object in a pasted reply: a ```json block if there is one, else the outermost braces. */
function extractJson(text: string): string | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  return start === -1 || end <= start ? null : body.slice(start, end + 1);
}

/** Reads ChatGPT's reply back into plan fields. Unknown keys are ignored. */
export function parseResponse(text: string): ParsedResponse {
  const json = extractJson(text);
  if (!json) return { ok: false, error: "No JSON found. Copy ChatGPT's whole reply, including the code block." };
  let data: unknown;
  try {
    // Smart quotes sneak in when a reply passes through a word processor.
    data = JSON.parse(json.replace(/[“”]/g, '"'));
  } catch {
    return { ok: false, error: "The reply isn't valid JSON. Ask ChatGPT to resend it as one JSON code block." };
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, error: "The reply should be one JSON object with the lesson plan parts." };
  }
  const values: Partial<Record<AiKey, string>> = {};
  for (const key of AI_KEYS) {
    const text = toText((data as Record<string, unknown>)[key]);
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
