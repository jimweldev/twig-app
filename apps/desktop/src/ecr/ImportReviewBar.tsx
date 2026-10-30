import { useEffect, useState } from "react";
import { Check, ClipboardCheck, Loader2, Undo2 } from "lucide-react";
import { useLeaveGuard } from "@/app/router";
import { Button } from "@/components/ui/button";
import { restoreImport, type ImportSnapshot } from "@/lib/db";
import { clearPendingImport, savePendingImport } from "./pendingImport";

/** What an import changed, kept until the teacher keeps or undoes it. */
export interface ImportResult {
  title: string;
  summary: string[];
  snapshot: ImportSnapshot;
  /** The term the import wrote to, so the page can show it. */
  focusTerm?: number;
}

/**
 * Shown on the page after an import, so the teacher can look over the imported
 * grades and then keep them or undo the import. Until they click Keep it, the import
 * is undone if they leave without choosing or TWIG closes.
 */
export function ImportReviewBar({
  result,
  onUndone,
  onKeep,
  onError,
}: {
  result: ImportResult;
  onUndone: () => Promise<void>;
  onKeep: () => void;
  onError: (e: unknown) => void;
}) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    savePendingImport(result.snapshot);
  }, [result.snapshot]);

  const keep = () => {
    clearPendingImport();
    onKeep();
  };

  const undo = async () => {
    setBusy(true);
    try {
      await restoreImport(result.snapshot);
      clearPendingImport();
      await onUndone();
      onKeep();
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };

  useLeaveGuard({
    title: "Keep the imported grades?",
    description: "You haven't kept or undone the import yet. Choose before moving on.",
    keepLabel: "Keep and continue",
    discardLabel: "Undo and continue",
    onKeep: keep,
    onDiscard: undo,
  });

  return (
    <div
      role="status"
      className="flex animate-in flex-wrap items-center gap-4 border-y-2 border-amber-400 bg-amber-100 px-6 py-3 text-amber-950 duration-300 fade-in-0 slide-in-from-top-2"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-400 text-amber-950">
        <ClipboardCheck className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-base font-semibold">
          Review the imported grades
          <span className="animate-pulse rounded-full bg-amber-600 px-2 py-0.5 text-xs font-semibold text-white">
            Not saved yet
          </span>
        </p>
        <p className="mt-0.5 text-sm">{result.summary.join(" · ")}</p>
        <p className="text-xs text-amber-900/80">Check the sheet below, then keep or undo.</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variant="outline" className="border-amber-500 bg-white/60" disabled={busy} onClick={undo}>
          {busy ? <Loader2 className="animate-spin" /> : <Undo2 />} Undo import
        </Button>
        <Button disabled={busy} onClick={keep}>
          <Check /> Keep it
        </Button>
      </div>
    </div>
  );
}
