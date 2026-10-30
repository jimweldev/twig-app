import { describe, expect, it } from "vitest";
import {
  GradeFileError,
  isEncrypted,
  matchLearners,
  packetFileName,
  parseLearnerList,
  serializeLearnerList,
  fileToText,
  packetTerms,
  packetToText,
  readGradeText,
  scoreTerms,
  parsePacket,
  PasswordRequiredError,
  serializePacket,
  type GradePacket,
  type PacketLearner,
} from "@/ecr/exchange";

const learner = (over: Partial<PacketLearner> = {}): PacketLearner => ({
  lrn: "",
  last_name: "Dela Cruz",
  first_name: "Juan",
  middle_name: "Mendoza",
  sex: "M",
  terms: [85, null, null],
  final: null,
  ...over,
});

const packet: GradePacket = {
  exported_at: "2026-10-26T08:00:00.000Z",
  teacher_name: "Ms. Reyes",
  school_name: "Sample NHS",
  school_id: "300000",
  school_year: "2026-2027",
  grade_level: 7,
  section: "Sampaguita",
  learning_area: "MAPEH",
  learners: [learner({ lrn: "123456789012" }), learner({ last_name: "Santos", first_name: "Ana", sex: "F" })],
};

describe("grade file", () => {
  it("round-trips a plain file", async () => {
    const text = await serializePacket(packet);
    expect(isEncrypted(text)).toBe(false);
    expect(await parsePacket(text)).toEqual(packet);
  });

  it("rejects a hand-edited file", async () => {
    const text = (await serializePacket(packet)).replace('"final": null', '"final": 99');
    await expect(parsePacket(text)).rejects.toBeInstanceOf(GradeFileError);
  });

  it("rejects files that are not TWIG files", async () => {
    await expect(parsePacket("hello")).rejects.toThrow("not a TWIG file");
    await expect(parsePacket('{"format":"other"}')).rejects.toThrow("not a TWIG file");
  });

  it("round-trips an encrypted file and needs the right password", async () => {
    const text = await serializePacket(packet, "s3cret");
    expect(isEncrypted(text)).toBe(true);
    expect(text).not.toContain("Dela Cruz");
    await expect(parsePacket(text)).rejects.toBeInstanceOf(PasswordRequiredError);
    await expect(parsePacket(text, "wrong")).rejects.toBeInstanceOf(PasswordRequiredError);
    expect(await parsePacket(text, "s3cret")).toEqual(packet);
  });

  it("names files after grade, section, area and year", () => {
    expect(packetFileName(packet)).toBe("G7-Sampaguita_MAPEH_SY2026-2027.twig");
    expect(packetFileName({ ...packet, section: "St. Peter", learning_area: "Araling Panlipunan" })).toBe(
      "G7-St-Peter_Araling-Panlipunan_SY2026-2027.twig",
    );
  });
});

describe("matchLearners", () => {
  const section = [
    { id: 1, lrn: "123456789012", last_name: "DELA CRUZ", first_name: "Juan", middle_name: "M" },
    { id: 2, lrn: "", last_name: "SANTOS", first_name: "Ána", middle_name: "Mendoza" },
  ];

  it("matches by LRN first, then by name ignoring case and accents", () => {
    const r = matchLearners(
      [
        learner({ lrn: "123456789012" }),
        learner({ last_name: "santos", first_name: "Ana", middle_name: "mendoza" }),
        learner({ last_name: "Unknown", first_name: "Kid" }),
      ],
      section,
    );
    expect(r.matched.map((m) => [m.learner.id, m.by])).toEqual([
      [1, "lrn"],
      [2, "name"],
    ]);
    expect(r.unmatched.map((l) => l.last_name)).toEqual(["Unknown"]);
  });

  it("matches each section learner only once", () => {
    const twin = learner({ last_name: "SANTOS", first_name: "Ana", middle_name: "Mendoza" });
    const r = matchLearners([twin, twin], section);
    expect(r.matched).toHaveLength(1);
    expect(r.unmatched).toHaveLength(1);
  });
});

describe("grades as text", () => {
  it("round-trips through text, even when a chat app wraps it or adds words", async () => {
    const text = await packetToText(packet);
    expect(text).toMatch(/^TWIG1:[A-Za-z0-9_-]+~$/);
    const wrapped = `Hi ma'am, here are the grades:\n${text.replace(/(.{40})/g, "$1\n ")}\nThanks!`;
    expect(await parsePacket(await readGradeText(wrapped))).toEqual(packet);
  });

  it("keeps the password protection", async () => {
    const json = await readGradeText(await packetToText(packet, "s3cret"));
    expect(isEncrypted(json)).toBe(true);
    expect(await parsePacket(json, "s3cret")).toEqual(packet);
  });

  it("passes file contents through and rejects cut or unrelated text", async () => {
    const file = await serializePacket(packet);
    expect(await readGradeText(file)).toBe(file);
    const text = await packetToText(packet);
    await expect(readGradeText(text.slice(0, -20))).rejects.toBeInstanceOf(GradeFileError);
    await expect(readGradeText("hello")).rejects.toBeInstanceOf(GradeFileError);
  });
});

describe("terms in a file", () => {
  it("treats older files as carrying every term", () => {
    expect(packetTerms(packet)).toEqual([1, 2, 3]);
    expect(packetTerms({ terms_included: [2] })).toEqual([2]);
  });

  it("names one-term files after the term", () => {
    expect(packetFileName({ ...packet, terms_included: [2] })).toBe("G7-Sampaguita_MAPEH_SY2026-2027_T2.twig");
  });
});

describe("raw scores in a file", () => {
  const withScores: GradePacket = {
    ...packet,
    terms_included: [2, 3],
    activities: [
      { term: 2, component: "WW", position: 1, highest_score: 20 },
      { term: 3, component: "WW", position: 1, highest_score: 10 },
    ],
    learners: [learner({ scores: [18, null] }), learner({ last_name: "Santos", scores: [null, null] })],
  };

  it("finds the terms that have at least one score", () => {
    expect(scoreTerms(withScores)).toEqual([2]);
    expect(scoreTerms(packet)).toEqual([]);
  });

  it("round-trips scores through text", async () => {
    expect(await parsePacket(await readGradeText(await packetToText(withScores)))).toEqual(withScores);
  });
});

describe("learner lists", () => {
  const list = {
    exported_at: "2026-10-28T08:00:00.000Z",
    teacher_name: "Ms. Reyes",
    school_year: "2026-2027",
    grade_level: 7,
    section: "Sampaguita",
    learners: [
      { lrn: "1", last_name: "Dela Cruz", first_name: "Juan", middle_name: "M", sex: "M" as const, birthdate: "" },
    ],
  };

  it("round-trips through text with a password", async () => {
    const json = await readGradeText(await fileToText(await serializeLearnerList(list, "pw")));
    expect(await parseLearnerList(json, "pw")).toEqual(list);
  });

  it("tells grades and learner lists apart", async () => {
    await expect(parseLearnerList(await serializePacket(packet))).rejects.toThrow("This is grades, not a learner list");
    await expect(parsePacket(await serializeLearnerList(list))).rejects.toThrow("This is a learner list, not grades");
  });
});
