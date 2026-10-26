import { describe, expect, it } from "vitest";
import {
  GradeFileError,
  isEncrypted,
  matchLearners,
  packetFileName,
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

  it("rejects files that are not TWIG grade files", async () => {
    await expect(parsePacket("hello")).rejects.toThrow("not a TWIG grade file");
    await expect(parsePacket('{"format":"other"}')).rejects.toThrow("not a TWIG grade file");
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
