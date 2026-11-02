import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetEverything } from "@/lib/backup";

const WORD = "RESET";

/** Settings › Reset: clear every record and start over, after typing RESET. */
export function ResetCard() {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [resetting, setResetting] = useState(false);

  const reset = async () => {
    setResetting(true);
    try {
      await resetEverything(); // TWIG restarts when this works.
    } catch (e) {
      setResetting(false);
      setOpen(false);
      toast.error("TWIG wasn't reset", {
        description: `${e instanceof Error ? e.message : String(e)} Close TWIG and open it again; your records are unchanged.`,
        duration: Infinity,
      });
    }
  };

  return (
    <Card className="mt-6 border-destructive/30">
      <CardHeader>
        <CardTitle>Reset TWIG</CardTitle>
        <CardDescription>
          Deletes everything: your profile, school years, sections, learners, class records, attendance, lesson plans,
          quizzes, certificates and backup settings. TWIG restarts empty, with automatic backup off.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-2">
        <Button
          variant="destructive"
          onClick={() => {
            setTyped("");
            setOpen(true);
          }}
        >
          <Trash2 /> Reset and clear all…
        </Button>
        <p className="text-xs text-muted-foreground">
          A copy is saved first as “TWIG before reset” in your backup folder, in case you need it back.
        </p>
      </CardContent>

      <AlertDialog open={open} onOpenChange={(o) => !resetting && setOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear everything in TWIG?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="flex flex-col gap-3">
                <p>
                  All your records are deleted and TWIG restarts at the welcome page. A copy is saved first as “TWIG
                  before reset” in your backup folder; you can bring it back with Restore.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <form
            className="flex flex-col gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              if (typed === WORD) reset();
            }}
          >
            <Label htmlFor="reset-confirm">
              Type <span className="font-mono font-semibold">{WORD}</span> to confirm
            </Label>
            <Input
              id="reset-confirm"
              autoFocus
              autoComplete="off"
              value={typed}
              disabled={resetting}
              onChange={(e) => setTyped(e.target.value)}
            />
            <AlertDialogFooter className="mt-3">
              <AlertDialogCancel type="button" disabled={resetting}>
                Cancel
              </AlertDialogCancel>
              <Button type="submit" variant="destructive" disabled={typed !== WORD || resetting}>
                {resetting ? "Resetting…" : "Clear everything"}
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
