import { useEffect, useSyncExternalStore } from "react";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";

export type UpdateState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "current" }
  | { kind: "available"; update: Update }
  | { kind: "installing"; version: string; done: number; total: number }
  | { kind: "error"; message: string };

/**
 * One update state for the whole app, so the header badge and Settings › Updates
 * agree. Updates are verified against the updater public key in tauri.conf.json
 * before they install.
 */
let state: UpdateState = { kind: "idle" };
const listeners = new Set<() => void>();

function set(next: UpdateState) {
  state = next;
  listeners.forEach((l) => l());
}

export function useUpdateState() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

/** Asks GitHub for a newer release. Quiet mode (the check on start) keeps errors to the console. */
export async function checkForUpdate(quiet = false) {
  if (state.kind === "checking" || state.kind === "installing") return;
  set({ kind: "checking" });
  try {
    const update = await check();
    set(update ? { kind: "available", update } : { kind: "current" });
  } catch (e) {
    console.error("update check", e);
    set(
      quiet
        ? { kind: "idle" }
        : { kind: "error", message: "Couldn't reach the update server. Check your internet connection and try again." },
    );
  }
}

export async function installUpdate(update: Update) {
  set({ kind: "installing", version: update.version, done: 0, total: 0 });
  let total = 0;
  let done = 0;
  try {
    await update.downloadAndInstall((event) => {
      if (event.event === "Started") total = event.data.contentLength ?? 0;
      if (event.event === "Progress") done += event.data.chunkLength;
      set({ kind: "installing", version: update.version, done, total });
    });
    // On Windows the installer closes TWIG itself; elsewhere restart into the new version.
    await relaunch();
  } catch (e) {
    console.error(e);
    set({ kind: "error", message: "The update couldn't be installed. Try again, or download it from the website." });
  }
}

/** Checks once, quietly, a few seconds after TWIG opens. Offline just means no badge. */
export function useUpdateCheckOnStart(ready: boolean) {
  useEffect(() => {
    if (!ready || import.meta.env.DEV) return;
    const t = setTimeout(() => checkForUpdate(true), 5000);
    return () => clearTimeout(t);
  }, [ready]);
}
