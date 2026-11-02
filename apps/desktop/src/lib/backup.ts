import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { vacuumInto } from "@/lib/db";

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
