import { describe, expect, it } from "vitest";
import { buildPrompt, parseResponse, type LessonPlan } from "./plan";

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
        objectives: ["Explain photosynthesis", "- Draw a leaf"],
        flow: { "Session 1": ["Hook", "Lab"] },
      }),
    );
    expect(r.ok && r.values.objectives).toBe("- Explain photosynthesis\n- Draw a leaf");
    expect(r.ok && r.values.flow).toBe("Session 1:\n- Hook\n- Lab");
  });

  it("explains what went wrong", () => {
    expect(parseResponse("Sorry, I can't help").ok).toBe(false);
    expect(parseResponse("{not json}").ok).toBe(false);
    expect(parseResponse('{"unrelated": "x"}').ok).toBe(false);
  });
});
