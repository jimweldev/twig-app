import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { CheckCircle2, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type State =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "current" }
  | { kind: "available"; update: Update }
  | { kind: "installing"; percent: number | null }
  | { kind: "error"; message: string };

/**
 * Manual update check. TWIG works offline, so it only contacts GitHub when
 * the teacher clicks the button. Updates are verified against the updater
 * public key in tauri.conf.json before they install.
 */
export function UpdateCard() {
  const [version, setVersion] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  useEffect(() => {
    getVersion().then(setVersion, () => setVersion(""));
  }, []);

  const runCheck = async () => {
    setState({ kind: "checking" });
    try {
      const update = await check();
      setState(update ? { kind: "available", update } : { kind: "current" });
    } catch (e) {
      console.error(e);
      setState({
        kind: "error",
        message: "Couldn't reach the update server. Check your internet connection and try again.",
      });
    }
  };

  const install = async (update: Update) => {
    let total = 0;
    let done = 0;
    setState({ kind: "installing", percent: null });
    try {
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") total = event.data.contentLength ?? 0;
        if (event.event === "Progress") {
          done += event.data.chunkLength;
          setState({ kind: "installing", percent: total ? Math.round((done / total) * 100) : null });
        }
      });
      // On Windows the installer closes TWIG itself; elsewhere restart into the new version.
      await relaunch();
    } catch (e) {
      console.error(e);
      setState({ kind: "error", message: "The update couldn't be installed. Try again, or download it from the website." });
    }
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>App updates</CardTitle>
        <CardDescription>
          {version ? `You have TWIG ${version}. ` : ""}TWIG only goes online when you check for updates.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        {state.kind === "available" ? (
          <>
            <p className="text-sm">
              <span className="font-medium">TWIG {state.update.version}</span> is available.
            </p>
            <Button onClick={() => install(state.update)}>
              <Download /> Download and install
            </Button>
            <p className="w-full text-xs text-muted-foreground">
              TWIG closes while the update installs. Your records are kept.
            </p>
          </>
        ) : state.kind === "installing" ? (
          <p className="text-sm text-muted-foreground">
            Downloading the update{state.percent !== null ? ` · ${state.percent}%` : "…"}
          </p>
        ) : (
          <>
            <Button variant="outline" disabled={state.kind === "checking"} onClick={runCheck}>
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
