import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Lock, LockOpen } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { finalizeTerm, listFinalizedTerms, unfinalizeTerm } from "@/lib/db";
import { toast } from "sonner";

const formatDate = (d: string) =>
  new Date(`${d.replace(" ", "T")}Z`).toLocaleDateString("en-PH", { month: "short", day: "numeric" });

/** A class record's finalized terms (term -> when), with finalize and unfinalize. */
export function useFinalizedTerms(classId: number, onError: (e: unknown) => void) {
  const [finalized, setFinalized] = useState<Map<number, string>>(new Map());

  const reload = useCallback(() => listFinalizedTerms(classId).then(setFinalized, onError), [classId, onError]);
  useEffect(() => {
    reload();
  }, [reload]);

  const finalize = (term: number) =>
    finalizeTerm(classId, term)
      .then(reload)
      .then(() => toast.success(`Term ${term} finalized`, { description: "Its grades are locked." }), onError);
  const unfinalize = (term: number) =>
    unfinalizeTerm(classId, term)
      .then(reload)
      .then(() => toast(`Term ${term} unfinalized`, { description: "Its grades can be edited again." }), onError);
  return { finalized, finalize, unfinalize, isLocked: (term: number) => finalized.has(term) };
}

function Confirm({
  trigger,
  title,
  description,
  action,
  onConfirm,
}: {
  trigger: ReactNode;
  title: string;
  description: string;
  action: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{action}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Finalize a term's grades, or, once finalized, show when and let the teacher
 * unfinalize to edit again.
 */
export function FinalizeTermControl({
  term,
  finalizedAt,
  onFinalize,
  onUnfinalize,
}: {
  term: number;
  finalizedAt: string | undefined;
  onFinalize: () => void;
  onUnfinalize: () => void;
}) {
  if (finalizedAt) {
    return (
      <span className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">
          <Lock className="size-3.5" /> Term {term} finalized · {formatDate(finalizedAt)}
        </span>
        <Confirm
          title={`Unfinalize Term ${term}?`}
          description="Its grades can be edited again. Finalize it again when you're done."
          action="Unfinalize"
          onConfirm={onUnfinalize}
          trigger={
            <Button variant="ghost" size="sm">
              <LockOpen /> Unfinalize
            </Button>
          }
        />
      </span>
    );
  }
  return (
    <Confirm
      title={`Finalize Term ${term}?`}
      description="Its scores and grades are locked so they can't be changed by mistake. You can unfinalize it later if you need to edit."
      action={`Finalize Term ${term}`}
      onConfirm={onFinalize}
      trigger={
        <Button variant="outline" size="sm">
          <Lock /> Finalize Term {term}
        </Button>
      }
    />
  );
}
