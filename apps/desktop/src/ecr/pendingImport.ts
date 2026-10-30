// An import the teacher hasn't kept yet. Its undo snapshot is saved on this computer
// so that if TWIG closes before they choose, the import is undone at the next start.

import { restoreImport, type ImportSnapshot } from "@/lib/db";

const KEY = "twig.pendingImport";

// Score maps don't survive JSON on their own.
const replacer = (_: string, v: unknown) => (v instanceof Map ? { __map: [...v.entries()] } : v);
const reviver = (_: string, v: unknown) =>
  v && typeof v === "object" && "__map" in v ? new Map((v as { __map: [unknown, unknown][] }).__map) : v;

export const serializeSnapshot = (s: ImportSnapshot) => JSON.stringify(s, replacer);
export const parseSnapshot = (text: string) => JSON.parse(text, reviver) as ImportSnapshot;

export function savePendingImport(s: ImportSnapshot) {
  try {
    localStorage.setItem(KEY, serializeSnapshot(s));
  } catch {
    // Without storage the import is only undone if the teacher stays to choose.
  }
}

export function clearPendingImport() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing saved to clear.
  }
}

let undoing: Promise<boolean> | null = null;

/** Undoes an import left unkept when TWIG last closed. True when something was undone. Runs once per start. */
export function undoUnkeptImport(): Promise<boolean> {
  undoing ??= undoSaved();
  return undoing;
}

async function undoSaved(): Promise<boolean> {
  let text: string | null = null;
  try {
    text = localStorage.getItem(KEY);
  } catch {
    return false;
  }
  if (!text) return false;
  await restoreImport(parseSnapshot(text));
  clearPendingImport();
  return true;
}
