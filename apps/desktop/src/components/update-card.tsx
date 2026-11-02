import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { CheckCircle2, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { checkForUpdate, installUpdate, useUpdateState } from "@/lib/updates";

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/** A download bar; without a known size it shows how much has arrived and slides. */
export function DownloadProgress({ done, total }: { done: number; total: number }) {
  const percent = total ? Math.min(100, Math.round((done / total) * 100)) : null;
  return (
    <div className="flex w-full flex-col gap-1.5">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? undefined}
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className={percent === null ? "h-full w-1/3 animate-pulse rounded-full bg-primary" : "h-full rounded-full bg-primary transition-[width] duration-200"}
          style={percent === null ? undefined : { width: `${percent}%` }}
        />
      </div>
      <p className="flex justify-between text-xs text-muted-foreground tabular-nums">
        <span>{total ? `${mb(done)} of ${mb(total)}` : done ? mb(done) : "Starting…"}</span>
        {percent !== null && <span className="font-medium text-foreground">{percent}%</span>}
      </p>
    </div>
  );
}

/** Settings › Updates. TWIG checks quietly when it opens; this checks again on request and installs. */
export function UpdateCard() {
  const [version, setVersion] = useState("");
  const state = useUpdateState();

  useEffect(() => {
    getVersion().then(setVersion, () => setVersion(""));
  }, []);

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>App updates</CardTitle>
        <CardDescription>
          {version ? `You have TWIG ${version}. ` : ""}TWIG looks for a new version when it opens, if you're online.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        {state.kind === "available" ? (
          <>
            <p className="text-sm">
              <span className="font-medium">TWIG {state.update.version}</span> is available.
            </p>
            <Button onClick={() => installUpdate(state.update)}>
              <Download /> Download and install
            </Button>
            <p className="w-full text-xs text-muted-foreground">
              TWIG closes while the update installs. Your records are kept.
            </p>
          </>
        ) : state.kind === "installing" ? (
          <>
            <p className="text-sm">
              Downloading <span className="font-medium">TWIG {state.version}</span>…
            </p>
            <DownloadProgress done={state.done} total={state.total} />
          </>
        ) : (
          <>
            <Button variant="outline" disabled={state.kind === "checking"} onClick={() => checkForUpdate()}>
              <RefreshCw className={state.kind === "checking" ? "animate-spin" : ""} />
              {state.kind === "checking" ? "Checking…" : "Check for updates"}
            </Button>
            {state.kind === "current" && (
              <span className="flex items-center gap-1.5 text-sm text-primary">
                <CheckCircle2 className="size-4" /> You have the latest version.
              </span>
            )}
            {state.kind === "error" && <span className="text-sm text-destructive">{state.message}</span>}
          </>
        )}
      </CardContent>
    </Card>
  );
}
