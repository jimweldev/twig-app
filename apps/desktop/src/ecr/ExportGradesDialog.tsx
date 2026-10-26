import { useEffect, useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { CheckCircle2, Send, TriangleAlert } from "lucide-react";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getProfile, type ClassRecord, type Learner } from "@/lib/db";
import { FILE_EXTENSION, packetFileName, serializePacket, type GradePacket } from "@/ecr/exchange";
import type { Term } from "@/ecr/grading";
import type { LearnerGrades } from "./classGrades";
import { gradeLabel } from "./levels";

export function ExportGradesDialog({
  classRecord,
  learners,
  grades,
  terms,
  onError,
}: {
  classRecord: ClassRecord;
  learners: Learner[];
  /** Term and final grades per learner: numbers, or codes for descriptive grading. */
  grades: Map<number, LearnerGrades>;
  /** Terms the subject runs. */
  terms: Term[];
  onError: (e: unknown) => void;
}) {
  const [open, setOpen] = useState(false);
  const [teacher, setTeacher] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [savedTo, setSavedTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSavedTo(null);
    setPassword("");
    setConfirm("");
    getProfile().then((p) => setTeacher(p.teacher_name), onError);
  }, [open, onError]);

  const termCounts = terms.map((t) => learners.filter((l) => (grades.get(l.id)?.terms[t - 1] ?? null) !== null).length);
  const noLrn = learners.filter((l) => !l.lrn.trim()).length;
  const passwordOk = password === confirm;

  const exportFile = async () => {
    setBusy(true);
    try {
      const packet: GradePacket = {
        exported_at: new Date().toISOString(),
        teacher_name: teacher.trim(),
        school_name: "",
        school_id: "",
        school_year: classRecord.school_year,
        grade_level: classRecord.grade_level,
        section: classRecord.section,
        learning_area: classRecord.learning_area,
        subject_type: classRecord.subject_type || undefined,
        learners: learners.map((l) => ({
          lrn: l.lrn,
          last_name: l.last_name,
          first_name: l.first_name,
          middle_name: l.middle_name,
          sex: l.sex,
          terms: grades.get(l.id)?.terms ?? [null, null, null],
          final: grades.get(l.id)?.final ?? null,
        })),
      };
      const profile = await getProfile();
      packet.school_name = profile.school_name;
      packet.school_id = profile.school_id;

      const path = await save({
        defaultPath: packetFileName(packet),
        filters: [{ name: "TWIG grade file", extensions: [FILE_EXTENSION] }],
      });
      if (!path) return;
      await writeTextFile(path, await serializePacket(packet, password || undefined));
      setSavedTo(path);
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Send /> Send grades
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Send grades to the adviser</DialogTitle>
          <DialogDescription>
            Saves a grade file you can send any way you like — Messenger, email, or a USB drive. The adviser imports it
            in TWIG under Sections.
          </DialogDescription>
        </DialogHeader>

        {savedTo ? (
          <div className="flex gap-3 rounded-lg bg-primary/10 p-4 text-sm">
            <CheckCircle2 className="size-5 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="font-medium">Grade file saved</p>
              <p className="mt-1 break-all text-muted-foreground">{savedTo}</p>
              <p className="mt-2">
                Send this file to the adviser of {gradeLabel(classRecord.grade_level)} – {classRecord.section}.
                {password && " Tell them the password separately, not in the same message."}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="rounded-lg border p-3 text-sm">
              <div className="font-medium">
                {classRecord.learning_area} · {gradeLabel(classRecord.grade_level)} – {classRecord.section} · SY{" "}
                {classRecord.school_year}
              </div>
              <div className="mt-1 text-muted-foreground">
                {learners.length} learners ·{" "}
                {terms.map((t, i) => `Term ${t}: ${termCounts[i]} graded`).join(" · ")}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Only term and final grades are sent. Raw scores stay on this computer.
              </p>
            </div>

            {noLrn > 0 && (
              <p className="flex gap-2 text-xs text-amber-700">
                <TriangleAlert className="size-4 shrink-0" />
                {noLrn} learner(s) have no LRN, so the adviser's TWIG will match them by full name instead. Spelling must
                match.
              </p>
            )}

            <Field label="Sent by" hint={teacher.trim() ? undefined : "Add your name so the adviser knows who sent it."}>
              <Input value={teacher} onChange={(e) => setTeacher(e.target.value)} placeholder="Your name" />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Password (optional)">
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
              <Field label="Confirm password" hint={passwordOk ? undefined : "Passwords don't match."}>
                <Input
                  type="password"
                  value={confirm}
                  aria-invalid={!passwordOk}
                  disabled={!password}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </Field>
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">
              A password keeps learner grades private if the file is forwarded to the wrong person. It can't be
              recovered if forgotten.
            </p>
          </div>
        )}

        <DialogFooter>
          {savedTo ? (
            <Button onClick={() => setOpen(false)}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button disabled={busy || learners.length === 0 || !passwordOk} onClick={exportFile}>
                Save grade file…
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
