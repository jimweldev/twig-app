import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { AlertCircle, CheckCircle2, FolderOpen, HardDriveDownload } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/field";
import { SimpleSelect } from "@/components/simple-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  backUpNow,
  getBackupStatus,
  openBackupFolder,
  saveBackupSettings,
  today,
  type BackupStatus,
} from "@/lib/backup";

const KEEP_OPTIONS = [7, 14, 30, 60].map((n) => ({ value: String(n), label: `Last ${n} backups` }));

function describeDate(date: string) {
  if (date === today()) return "today";
  const d = new Date(`${date}T00:00:00`);
  return d.toLocaleDateString("en-PH", { dateStyle: "medium" });
}

/** Settings › Backup: the daily copy of all records to a folder the teacher picks. */
export function BackupCard() {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getBackupStatus().then(setStatus, (e) => toast.error(String(e)));
  }, []);

  if (!status) return null;

  const update = async (change: Partial<Pick<BackupStatus, "enabled" | "folder" | "keep">>) => {
    try {
      setStatus(await saveBackupSettings({ enabled: status.enabled, folder: status.folder, keep: status.keep, ...change }));
    } catch (e) {
      toast.error(String(e));
    }
  };

  const chooseFolder = async () => {
    const picked = await open({ directory: true, defaultPath: status.folderPath, title: "Choose the backup folder" });
    if (typeof picked === "string") await update({ folder: picked });
  };

  const runNow = async () => {
    setBusy(true);
    try {
      const s = await backUpNow();
      setStatus(s);
      if (!s.lastError) toast.success("Backup saved", { description: s.lastFile ?? undefined });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Backup</CardTitle>
        <CardDescription>
          Once a day, the first time you open TWIG, a copy of all your records is saved to the folder below.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <Switch
            id="backup-enabled"
            checked={status.enabled}
            onCheckedChange={(enabled) => update({ enabled })}
          />
          <Label htmlFor="backup-enabled">Back up automatically every day</Label>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Backup folder</Label>
          <p className="rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs break-all">{status.folderPath}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={chooseFolder}>
              Change folder…
            </Button>
            <Button variant="outline" size="sm" onClick={() => openBackupFolder().catch((e) => toast.error(String(e)))}>
              <FolderOpen /> Open folder
            </Button>
            {status.folder && (
              <Button variant="ghost" size="sm" onClick={() => update({ folder: null })}>
                Use Documents
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            To keep a copy off this computer, choose a folder inside OneDrive or Google Drive.
          </p>
        </div>

        <Field label="Keep" className="max-w-56">
          <SimpleSelect
            value={String(status.keep)}
            onValueChange={(v) => update({ keep: Number(v) })}
            options={KEEP_OPTIONS}
          />
        </Field>

        <div className="flex flex-wrap items-center gap-3 border-t pt-4">
          <Button onClick={runNow} disabled={busy}>
            <HardDriveDownload /> {busy ? "Backing up…" : "Back up now"}
          </Button>
          {status.lastError ? (
            <span className="flex items-start gap-1.5 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" /> Last backup failed: {status.lastError}
            </span>
          ) : status.lastDate ? (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-primary" /> Last backup {describeDate(status.lastDate)}
              {status.lastFile && ` · ${status.lastFile}`}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">No backup yet.</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
