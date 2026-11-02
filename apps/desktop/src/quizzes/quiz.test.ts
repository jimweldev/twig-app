import { describe, expect, it } from "vitest";
import type { LessonPlan } from "@/lessons/plan";
import {
  answerKey,
  buildQuizPrompt,
  matchingColumn,
  newPart,
  parseQuizResponse,
  quizPoints,
  withType,
  type QuizPart,
} from "./quiz";

const plan: LessonPlan = {
  id: 1,
  title: "Geologic Time Scale",
  grade_level: 9,
  learning_area: "Science",
  sections: "",
  term: 2,
  week: 3,
  sessions: 3,
  minutes: 60,
  content: {
    competency: "Explain how the geologic time scale helps to recount the history of the Earth.",
    by_session: {
      objectives: ["1. Explain why scientists need a time scale", "1. Describe eons, eras, periods and epochs", ""],
    },
  },
  updated_at: "",
};

describe("buildQuizPrompt", () => {
  const prompt = buildQuizPrompt({ title: "", grade_level: 9, learning_area: "Science" }, plan, {
    counts: { multiple_choice: 10, true_false: 5, essay: 0 },
    sessions: [2],
    notes: "Avoid dates",
    language: "English",
  });

  it("asks only for the types with items, in order", () => {
    expect(prompt).toContain("1. Multiple choice: 10 items\n2. True or false: 5 items");
    expect(prompt).toContain("(15 items in all)");
    expect(prompt).not.toContain('"type": "essay"');
  });

  it("includes the competency and only the chosen sessions", () => {
    expect(prompt).toContain("Learning competency: Explain how the geologic time scale");
    expect(prompt).toContain("Session 2:");
    expect(prompt).toContain("Describe eons, eras");
    expect(prompt).not.toContain("Explain why scientists need a time scale");
    expect(prompt).toContain("Teacher's notes: Avoid dates");
  });
});

describe("parseQuizResponse", () => {
  it("reads each type into its stored form", () => {
    const reply = `\`\`\`json
{
  "title": "Geologic Time Quiz",
  "parts": [
    { "type": "multiple_choice", "directions": "Choose.", "items": [
      { "question": "1. Largest division?", "choices": ["A. Epoch", "B. Period", "C. Era", "D. Eon"], "answer": "D. Eon" },
      { "question": "Age of Dinosaurs?", "choices": ["Paleozoic", "Mesozoic", "Cenozoic", "Archean"], "answer": "Mesozoic" }
    ] },
    { "type": "True or False", "items": [
      { "statement": "Fossils show past life.", "answer": true },
      { "question": "Earth is 100 years old.", "answer": "FALSE" }
    ] },
    { "type": "enumeration", "items": [ { "question": "Give the eons.", "answer": ["Hadean", "Archean"] } ] },
    { "type": "essay", "points": 5, "rubric": "5 - complete", "items": [ { "question": "Explain.", "answer": "…" } ] },
    { "type": "poem", "items": [ { "question": "?" } ] }
  ]
}
\`\`\``;
    const parsed = parseQuizResponse(reply);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.title).toBe("Geologic Time Quiz");
    expect(parsed.parts.map((p) => p.type)).toEqual(["multiple_choice", "true_false", "enumeration", "essay"]);
    const [mc, tf, en, essay] = parsed.parts;
    expect(mc.items[0]).toEqual({
      question: "Largest division?",
      choices: ["Epoch", "Period", "Era", "Eon"],
      answer: "D",
    });
    expect(mc.items[1].answer).toBe("B");
    expect(tf.items.map((i) => i.answer)).toEqual(["True", "False"]);
    expect(tf.directions).toContain("TRUE");
    expect(en.items[0].answer).toBe("Hadean\nArchean");
    expect(essay.rubric).toBe("5 - complete");
  });

  it("says what's wrong when nothing usable came back", () => {
    expect(parseQuizResponse("no json here").ok).toBe(false);
    expect(parseQuizResponse('{"parts": []}').ok).toBe(false);
  });
});

describe("scoring and keys", () => {
  const matching: QuizPart = {
    ...newPart("matching"),
    items: ["Eon", "Era", "Period", "Epoch"].map((answer, i) => ({ question: `Q${i}`, answer })),
  };

  it("shuffles Column B the same way every time, never in Column A's order", () => {
    const column = matchingColumn(matching);
    expect(column).toEqual(matchingColumn(matching));
    expect([...column].sort()).toEqual(["Eon", "Epoch", "Era", "Period"]);
    expect(column).not.toEqual(["Eon", "Era", "Period", "Epoch"]);
  });

  it("keys matching items to their letter in Column B", () => {
    const column = matchingColumn(matching);
    const key = answerKey(matching);
    matching.items.forEach((it, i) => expect(column["ABCD".indexOf(key[i])]).toBe(it.answer));
  });

  it("counts enumeration points per answer", () => {
    const en: QuizPart = { ...newPart("enumeration"), points: 1, items: [{ question: "Give 3", answer: "a\nb\nc" }] };
    const essay: QuizPart = { ...newPart("essay"), items: [{ question: "Why?", answer: "" }] };
    expect(quizPoints({ parts: [en, essay] })).toBe(3 + 5);
  });

  it("keeps the questions when a part changes type", () => {
    const mc = { ...newPart("multiple_choice"), items: [{ question: "Q", choices: ["a", "b"], answer: "B" }] };
    const tf = withType(mc, "true_false");
    expect(tf.items).toEqual([{ question: "Q", answer: "True" }]);
    expect(tf.directions).toContain("TRUE");
  });
});
