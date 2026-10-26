// .twig grade files: how subject teachers send grades to a section adviser
// without internet (USB, Messenger, email...). Plain JSON with a SHA-256
// checksum, optionally encrypted with a password (PBKDF2 + AES-GCM).
//
// The checksum catches damaged or hand-edited files; it is not a signature,
// since anyone with TWIG could produce a valid file.

import type { Sex } from "@/lib/db";

export const FILE_EXTENSION = "twig";
const FORMAT = "twig.grades";
const VERSION = 1;
const PBKDF2_ITERATIONS = 210_000;

export interface PacketLearner {
  lrn: string;
  last_name: string;
  first_name: string;
  middle_name: string;
  sex: Sex;
  /** Term 1-3 grades: numbers, or codes such as "A" for descriptive grading; null where not graded yet. */
  terms: (number | string | null)[];
  final: number | string | null;
}

export interface GradePacket {
  exported_at: string; // ISO timestamp
  teacher_name: string;
  school_name: string;
  school_id: string;
  school_year: string;
  grade_level: number;
  section: string;
  learning_area: string;
  /** Senior High subject type id; absent in files from older TWIG versions. */
  subject_type?: string;
  learners: PacketLearner[];
}

interface PlainEnvelope {
  format: typeof FORMAT;
  version: number;
  encrypted: false;
  checksum: string;
  packet: GradePacket;
}

interface EncryptedEnvelope {
  format: typeof FORMAT;
  version: number;
  encrypted: true;
  salt: string;
  iv: string;
  data: string;
}

export class GradeFileError extends Error {}
/** Thrown when the file is encrypted and no (or the wrong) password was given. */
export class PasswordRequiredError extends GradeFileError {}

const enc = new TextEncoder();
const dec = new TextDecoder();

function toBase64(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
const fromBase64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function sha256(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function deriveKey(password: string, salt: Uint8Array) {
  const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function serializePacket(packet: GradePacket, password?: string): Promise<string> {
  const plain: PlainEnvelope = {
    format: FORMAT,
    version: VERSION,
    encrypted: false,
    checksum: await sha256(JSON.stringify(packet)),
    packet,
  };
  if (!password) return JSON.stringify(plain, null, 2);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(plain)));
  const envelope: EncryptedEnvelope = {
    format: FORMAT,
    version: VERSION,
    encrypted: true,
    salt: toBase64(salt),
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(cipher)),
  };
  return JSON.stringify(envelope, null, 2);
}

export function isEncrypted(text: string): boolean {
  try {
    return JSON.parse(text)?.encrypted === true;
  } catch {
    return false;
  }
}

export async function parsePacket(text: string, password?: string): Promise<GradePacket> {
  let envelope: PlainEnvelope | EncryptedEnvelope;
  try {
    envelope = JSON.parse(text);
  } catch {
    throw new GradeFileError("This is not a TWIG grade file.");
  }
  if (envelope?.format !== FORMAT) throw new GradeFileError("This is not a TWIG grade file.");
  if (envelope.version > VERSION) {
    throw new GradeFileError("This file was made by a newer version of TWIG. Update TWIG to import it.");
  }

  if (envelope.encrypted) {
    if (!password) throw new PasswordRequiredError("This file is protected with a password.");
    try {
      const key = await deriveKey(password, fromBase64(envelope.salt));
      const plain = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: fromBase64(envelope.iv) as BufferSource },
        key,
        fromBase64(envelope.data) as BufferSource,
      );
      return parsePacket(dec.decode(plain));
    } catch (e) {
      if (e instanceof GradeFileError) throw e;
      throw new PasswordRequiredError("Wrong password, or the file is damaged.");
    }
  }

  if ((await sha256(JSON.stringify(envelope.packet))) !== envelope.checksum) {
    throw new GradeFileError("This file was changed or damaged after it was exported. Ask the teacher to send it again.");
  }
  return envelope.packet;
}

/** Checksum of the packet, used to tell whether the same file was imported before. */
export const packetChecksum = (packet: GradePacket) => sha256(JSON.stringify(packet));

/** e.g. G7-Sampaguita_MAPEH_SY2026-2027.twig */
export function packetFileName(p: Pick<GradePacket, "grade_level" | "section" | "learning_area" | "school_year">) {
  const clean = (s: string) => s.trim().replace(/[^\p{L}\p{N}-]+/gu, "-").replace(/^-+|-+$/g, "");
  return `G${p.grade_level}-${clean(p.section)}_${clean(p.learning_area)}_SY${p.school_year}.${FILE_EXTENSION}`;
}

// ---- Learner matching ----

interface MatchableLearner {
  id: number;
  lrn: string;
  last_name: string;
  first_name: string;
  middle_name: string;
}

const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase().replace(/\s+/g, " ");
const nameKey = (l: Pick<MatchableLearner, "last_name" | "first_name" | "middle_name">) =>
  `${norm(l.last_name)}|${norm(l.first_name)}|${norm(l.middle_name)}`;

export interface MatchResult<L> {
  matched: { incoming: PacketLearner; learner: L; by: "lrn" | "name" }[];
  unmatched: PacketLearner[];
}

/**
 * Matches incoming learners to the section's learners: by LRN when both
 * have one, else by full name (case and accents ignored). Each section
 * learner is matched at most once.
 */
export function matchLearners<L extends MatchableLearner>(incoming: PacketLearner[], section: L[]): MatchResult<L> {
  const used = new Set<number>();
  const byLrn = new Map(section.filter((l) => l.lrn.trim()).map((l) => [l.lrn.trim(), l]));
  const byName = new Map<string, L[]>();
  for (const l of section) {
    const k = nameKey(l);
    byName.set(k, [...(byName.get(k) ?? []), l]);
  }

  const result: MatchResult<L> = { matched: [], unmatched: [] };
  for (const inc of incoming) {
    const lrnHit = inc.lrn.trim() ? byLrn.get(inc.lrn.trim()) : undefined;
    if (lrnHit && !used.has(lrnHit.id)) {
      used.add(lrnHit.id);
      result.matched.push({ incoming: inc, learner: lrnHit, by: "lrn" });
      continue;
    }
    const nameHit = (byName.get(nameKey(inc)) ?? []).find((l) => !used.has(l.id));
    if (nameHit) {
      used.add(nameHit.id);
      result.matched.push({ incoming: inc, learner: nameHit, by: "name" });
    } else {
      result.unmatched.push(inc);
    }
  }
  return result;
}
