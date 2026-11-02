import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";
import { toast } from "sonner";
import { closeDatabase, vacuumInto } from "@/lib/db";

/** Mirrors `BackupStatus` in src-tauri/src/backup.rs. */
export interface BackupStatus {
  enabled: boolean;
  /** null means the default folder, Documents/TWIG Backups. */
  folder: string | null;
  /** The folder backups actually go to. */
  folderPath: string;
  keep: number;
  lastDate: string | null;
  lastFile: string | null;
  lastError: string | null;
}

export const getBackupStatus = () => invoke<BackupStatus>("backup_status");

export const saveBackupSettings = (s: Pick<BackupStatus, "enabled" | "folder" | "keep">) =>
  invoke<BackupStatus>("set_backup_settings", s);

export const openBackupFolder = () => invoke("open_backup_folder");

/** Today in local time, as YYYY-MM-DD; one backup per day is named by it. */
export function today(now = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

let running: Promise<BackupStatus> | null = null;

/** Backs up now, replacing today's backup if there is one. Never runs twice at once. */
export function backUpNow(): Promise<BackupStatus> {
  return (running ??= run().finally(() => (running = null)));
}

async function run() {
  let temp: string;
  try {
    temp = await invoke<string>("backup_begin");
  } catch {
    // Rust has recorded why (e.g. the folder is on a USB drive that's unplugged).
    return getBackupStatus();
  }
  let error: string | null = null;
  try {
    await vacuumInto(temp);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  return invoke<BackupStatus>("backup_finish", { date: today(), error });
}

/** Backs up if automatic backups are on and none has worked yet today. */
async function backUpIfDue() {
  const s = await getBackupStatus();
  if (!s.enabled || s.lastDate === today()) return null;
  return backUpNow();
}

/**
 * The daily backup: when TWIG opens, and when its window comes back into focus
 * on a new day (it may be left open overnight). A failure shows once a day.
 */
export function useAutoBackup(ready: boolean, onOpenSettings: () => void) {
  const openSettings = useRef(onOpenSettings);
  openSettings.current = onOpenSettings;

  useEffect(() => {
    if (!ready) return;
    let warnedOn = "";
    const check = () =>
      backUpIfDue().then(
        (s) => {
          if (!s?.lastError || warnedOn === today()) return;
          warnedOn = today();
          toast.error("Today's backup didn't work", {
            description: s.lastError,
            action: { label: "Backup settings", onClick: () => openSettings.current() },
            duration: 15000,
          });
        },
        (e) => console.error("backup", e),
      );
    check();
    window.addEventListener("focus", check);
    return () => window.removeEventListener("focus", check);
  }, [ready]);
}

/** What a backup file holds, shown before restoring it. */
export interface BackupSummary {
  schoolYears: number;
  sections: number;
  learners: number;
  classes: number;
}

/**
 * Copies the chosen file next to the database and checks it: a TWIG database,
 * not damaged, and not from a newer TWIG. Throws a message for the teacher if not.
 */
export async function checkBackup(path: string): Promise<BackupSummary> {
  const { url, latestVersion } = await invoke<{ url: string; latestVersion: number }>("restore_stage", { from: path });
  const b = await Database.load(url);
  try {
    let version: number | null = null;
    try {
      const [row] = await b.select<{ v: number | null }[]>("SELECT MAX(version) AS v FROM _sqlx_migrations WHERE success");
      version = row?.v ?? null;
    } catch {
      // No migrations table: not a TWIG database.
    }
    if (version === null) throw new Error("This file isn't a TWIG backup.");
    if (version > latestVersion) {
      throw new Error("This backup was made by a newer version of TWIG. Update TWIG first, then restore it.");
    }
    const [check] = await b.select<{ quick_check: string }[]>("PRAGMA quick_check");
    if (check?.quick_check !== "ok") throw new Error("This backup is damaged. Try an older one.");

    const count = async (table: string) => {
      try {
        const [row] = await b.select<{ n: number }[]>(`SELECT COUNT(*) AS n FROM ${table}`);
        return row?.n ?? 0;
      } catch {
        return 0; // Tables added after this backup was made.
      }
    };
    return {
      schoolYears: await count("school_years"),
      sections: await count("sections"),
      learners: await count("learners"),
      classes: await count("classes"),
    };
  } finally {
    await b.close(url);
  }
}

/**
 * Restores the backup last checked: saves the current records as
 * "TWIG before restore <date time>.db" in the backup folder, then swaps the
 * backup in and restarts TWIG. Only returns if something went wrong.
 */
export async function restoreBackup() {
  await saveSafetyCopy(false);
  await closeDatabase();
  await invoke("restore_apply");
}

/** Saves the current records to the backup folder; returns the file's path. */
async function saveSafetyCopy(reset: boolean) {
  const now = new Date();
  const stamp = `${today(now)} ${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}`;
  const path = await invoke<string>("restore_safety_path", { stamp, reset });
  await vacuumInto(path);
  return path;
}

/**
 * Clears everything: saves the current records as "TWIG before reset <date time>.db"
 * in the backup folder, deletes the database and restarts TWIG empty, at the
 * profile setup. Only returns if something went wrong.
 */
export async function resetEverything() {
  await saveSafetyCopy(true);
  await closeDatabase();
  // Drafts kept in the browser storage (an unkept import, certificate awards) go too.
  localStorage.clear();
  await invoke("reset_apply");
}
