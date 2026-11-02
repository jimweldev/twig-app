import { describe, expect, it } from "vitest";
import { buildPrompt, parseResponse, withAiValues, type LessonPlan } from "./plan";

const plan: LessonPlan = {
  id: 1,
  title: "Photosynthesis",
  grade_level: 7,
  learning_area: "Science",
  sections: "Rizal",
  term: 2,
  week: 3,
  sessions: 2,
  minutes: 50,
  content: { competency: "Describe how plants make food" },
  updated_at: "",
};

describe("buildPrompt", () => {
  const prompt = buildPrompt(plan, { topic: "", notes: "Many learners lack science books", language: "English" });

  it("includes the lesson details the teacher set", () => {
    expect(prompt).toContain("Grade 7");
    expect(prompt).toContain("Topic: Photosynthesis");
    expect(prompt).toContain("Term 2, Week 3");
    expect(prompt).toContain("2 sessions of 50 minutes each");
    expect(prompt).toContain("Learning competency: Describe how plants make food");
    expect(prompt).toContain("Teacher's notes: Many learners lack science books");
  });

  it("asks for every part except the teacher's reflection", () => {
    expect(prompt).toContain('"flow":');
    expect(prompt).toContain('"assessment":');
    expect(prompt).not.toContain('"reflection":');
  });
});

describe("parseResponse", () => {
  it("reads a fenced JSON reply with chatter around it", () => {
    const r = parseResponse(
      'Here you go!\n```json\n{"title": "Food Factories", "flow": "Session 1\\n- Hook", "extra": "x"}\n```\nGood luck!',
    );
    expect(r).toEqual({ ok: true, values: { title: "Food Factories", flow: "Session 1\n- Hook" } });
  });

  it("turns lists and nested objects into text", () => {
    const r = parseResponse(
      JSON.stringify({
        references: ["Science 7 Learner's Material", "- DepEd LR Portal"],
        flow: { "Session 1": ["Hook", "Lab"] },
      }),
    );
    expect(r.ok && r.values.references).toBe("Science 7 Learner's Material\n- DepEd LR Portal");
    expect(r.ok && r.values.flow).toBe("Session 1:\n- Hook\n- Lab");
  });

  it("ignores the prompt's // notes when ChatGPT copies them", () => {
    const r = parseResponse('{\n  "title": "Rocks",  // A short lesson title\n  "references": ["https://x.org/a"]\n}');
    expect(r).toEqual({ ok: true, values: { title: "Rocks", references: "https://x.org/a" } });
  });

  it("keeps LaTeX backslashes that ChatGPT didn't escape", () => {
    const r = parseResponse('{"assessment": [["Solve $\\frac{1}{2} + \\theta \\neq x$\\nThen check"]]}');
    expect(r.ok && r.values.assessment).toEqual(["Solve $\\frac{1}{2} + \\theta \\neq x$\nThen check"]);
  });

  it("turns double-escaped line breaks into real ones", () => {
    const r = parseResponse(JSON.stringify({ flow: ["Hook (5 min)\\nLab (20 min)"], references: "A\\nB" }));
    expect(r.ok && r.values.flow).toEqual(["Hook (5 min)\nLab (20 min)"]);
    expect(r.ok && r.values.references).toBe("A\nB");
  });

  it("keeps per-session lists as one entry per session", () => {
    const r = parseResponse(
      JSON.stringify({ objectives: ["Session 1: Explain photosynthesis", ["1. Draw a leaf", "2. Label it"]] }),
    );
    expect(r.ok && r.values.objectives).toEqual(["Explain photosynthesis", "1. Draw a leaf\n2. Label it"]);
  });
});

describe("withAiValues", () => {
  it("puts session lists in their columns and replaces all-sessions text", () => {
    const next = withAiValues({ flow: "old", ai_declaration: "Mine" }, { flow: ["A", "B"], title: "X" });
    expect(next.flow).toBeUndefined();
    expect(next.by_session?.flow).toEqual(["A", "B"]);
    expect(next.ai_declaration).toBe("Mine");
  });

  it("explains what went wrong", () => {
    expect(parseResponse("Sorry, I can't help").ok).toBe(false);
    expect(parseResponse("{not json}").ok).toBe(false);
    expect(parseResponse('{"unrelated": "x"}').ok).toBe(false);
  });
});
