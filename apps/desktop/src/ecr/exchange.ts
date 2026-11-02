// .twig files: how teachers send grades and learner lists to each other without
// internet (USB, Messenger, email...). Plain JSON with a SHA-256 checksum,
// optionally encrypted with a password (PBKDF2 + AES-GCM).
//
// The checksum catches damaged or hand-edited files; it is not a signature,
// since anyone with TWIG could produce a valid file.

import type { Sex } from "@/lib/db";
import type { Component } from "./grading";

export const FILE_EXTENSION = "twig";
const FORMAT = "twig.grades";
const LEARNERS_FORMAT = "twig.learners";
type Format = typeof FORMAT | typeof LEARNERS_FORMAT;
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
  /** Raw scores, one per entry of GradePacket.activities; null where blank. Absent when scores weren't sent. */
  scores?: (number | null)[];
}

/** A written work, performance task or exam in the sender's class record. */
export interface PacketActivity {
  term: number;
  component: Component;
  position: number;
  highest_score: number;
  /** MAPEH: "MA" or "PEH". Absent for other learning areas and in older files. */
  part?: string;
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
  /** Terms (1-3) this file carries; absent in older files, which carry every term. */
  terms_included?: number[];
  /** The class record's activities for the terms sent, when raw scores were included. */
  activities?: PacketActivity[];
  learners: PacketLearner[];
}

/** Terms whose raw scores a file carries (at least one score), so a class record can rebuild them. */
export function scoreTerms(p: Pick<GradePacket, "activities" | "learners">): number[] {
  const acts = p.activities ?? [];
  const scored = acts.filter((_, i) => p.learners.some((l) => (l.scores?.[i] ?? null) !== null));
  return [...new Set(scored.map((a) => a.term))].sort();
}

/** The terms a file carries. */
export const packetTerms = (p: Pick<GradePacket, "terms_included">) => p.terms_included ?? [1, 2, 3];

/** A section's learners, sent so another teacher can set up the same class list. */
export interface LearnerListPacket {
  exported_at: string; // ISO timestamp
  teacher_name: string;
  school_year: string;
  grade_level: number;
  section: string;
  learners: (Omit<PacketLearner, "terms" | "final" | "scores"> & { birthdate: string })[];
}

interface PlainEnvelope<T> {
  format: Format;
  version: number;
  encrypted: false;
  checksum: string;
  packet: T;
}

interface EncryptedEnvelope {
  format: Format;
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

async function seal<T>(format: Format, packet: T, password?: string): Promise<string> {
  const plain: PlainEnvelope<T> = {
    format,
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
    format,
    version: VERSION,
    encrypted: true,
    salt: toBase64(salt),
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(cipher)),
  };
  return JSON.stringify(envelope, null, 2);
}

export const serializePacket = (packet: GradePacket, password?: string) => seal(FORMAT, packet, password);
export const serializeLearnerList = (list: LearnerListPacket, password?: string) =>
  seal(LEARNERS_FORMAT, list, password);

export function isEncrypted(text: string): boolean {
  try {
    return JSON.parse(text)?.encrypted === true;
  } catch {
    return false;
  }
}

/** What kind of TWIG file a text is, so the wrong kind gets a clear message. */
const KIND: Record<Format, string> = { [FORMAT]: "grades", [LEARNERS_FORMAT]: "a learner list" };

async function unseal<T>(text: string, format: Format, password?: string): Promise<T> {
  let envelope: PlainEnvelope<T> | EncryptedEnvelope;
  try {
    envelope = JSON.parse(text);
  } catch {
    throw new GradeFileError("This is not a TWIG file.");
  }
  if (envelope?.format !== format) {
    const other = KIND[envelope?.format as Format];
    throw new GradeFileError(
      other ? `This is ${other}, not ${KIND[format]}. Import it from the right page.` : "This is not a TWIG file.",
    );
  }
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
      return unseal<T>(dec.decode(plain), format);
    } catch (e) {
      if (e instanceof GradeFileError) throw e;
      throw new PasswordRequiredError("Wrong password, or the file is damaged.");
    }
  }

  if ((await sha256(JSON.stringify(envelope.packet))) !== envelope.checksum) {
    throw new GradeFileError(
      "This file was changed or damaged after it was exported. Ask the teacher to send it again.",
    );
  }
  return envelope.packet;
}

export const parsePacket = (text: string, password?: string) => unseal<GradePacket>(text, FORMAT, password);
export const parseLearnerList = (text: string, password?: string) =>
  unseal<LearnerListPacket>(text, LEARNERS_FORMAT, password);

/** Checksum of the packet, used to tell whether the same file was imported before. */
export const packetChecksum = (packet: GradePacket) => sha256(JSON.stringify(packet));

/** e.g. G7-Sampaguita_Learners_SY2026-2027.twig */
export const learnerListFileName = (p: Pick<LearnerListPacket, "grade_level" | "section" | "school_year">) =>
  packetFileName({ ...p, learning_area: "Learners" });

/** e.g. G7-Sampaguita_MAPEH_SY2026-2027.twig, or …_SY2026-2027_T2.twig for one term. */
export function packetFileName(
  p: Pick<GradePacket, "grade_level" | "section" | "learning_area" | "school_year" | "terms_included">,
) {
  const clean = (s: string) =>
    s
      .trim()
      .replace(/[^\p{L}\p{N}-]+/gu, "-")
      .replace(/^-+|-+$/g, "");
  const term = p.terms_included?.length === 1 ? `_T${p.terms_included[0]}` : "";
  return `G${p.grade_level}-${clean(p.section)}_${clean(p.learning_area)}_SY${p.school_year}${term}.${FILE_EXTENSION}`;
}

// ---- Grades as text ----
// The same file, gzipped and base64url-encoded between a prefix and an end mark,
// so it can be pasted into a chat. Chat apps may wrap long lines or add text
// around it, so whitespace inside is ignored. A missing end mark means the
// message was cut.

const TEXT_PREFIX = "TWIG1:";
const TEXT_END = "~";

async function gzip(bytes: Uint8Array, mode: "compress" | "decompress"): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(mode === "compress" ? new CompressionStream("gzip") : new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const toBase64Url = (bytes: Uint8Array) => toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromBase64Url = (s: string) => fromBase64(s.replace(/-/g, "+").replace(/_/g, "/"));

/** A grade file as one line of text, e.g. "TWIG1:H4sIAAAA…~". */
/** Any TWIG file's contents as one line of text. */
export async function fileToText(contents: string): Promise<string> {
  const compact = JSON.stringify(JSON.parse(contents));
  return TEXT_PREFIX + toBase64Url(await gzip(enc.encode(compact), "compress")) + TEXT_END;
}

export const packetToText = async (packet: GradePacket, password?: string) =>
  fileToText(await serializePacket(packet, password));

/**
 * The file contents behind pasted text or an opened file: grades text is unpacked,
 * file contents are returned as they are.
 */
export async function readGradeText(input: string): Promise<string> {
  const at = input.indexOf(TEXT_PREFIX);
  if (at === -1) {
    if (input.trim().startsWith("{")) return input;
    throw new GradeFileError("This isn't TWIG grades text. Copy the whole message, starting with “TWIG1:”.");
  }
  const rest = input.slice(at + TEXT_PREFIX.length);
  const end = rest.indexOf(TEXT_END);
  const code = rest.slice(0, end).replace(/\s+/g, "");
  if (end === -1 || !/^[A-Za-z0-9_-]+$/.test(code)) {
    throw new GradeFileError("Part of the grades text is missing or changed. Ask the teacher to send it again.");
  }
  try {
    return dec.decode(await gzip(fromBase64Url(code), "decompress"));
  } catch {
    throw new GradeFileError("Part of the grades text is missing or changed. Ask the teacher to send it again.");
  }
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
