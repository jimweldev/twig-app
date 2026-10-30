import { useEffect, useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { CheckCircle2, Copy, FileDown, Send, TriangleAlert } from "lucide-react";
import { Field } from "@/components/field";
import { SimpleSelect } from "@/components/simple-select";
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
import { getProfile, scoreKey, type Activity, type ClassRecord, type Learner } from "@/lib/db";
import { FILE_EXTENSION, packetFileName, packetToText, serializePacket, type GradePacket } from "@/ecr/exchange";
import type { Term } from "@/ecr/grading";
import type { LearnerGrades } from "./classGrades";
import { gradeLabel } from "./levels";

/** Long chat messages get cut or refused; past this, suggest a file instead. */
const LONG_TEXT = 15_000;

type Sent = { kind: "file"; path: string } | { kind: "text"; text: string; copied: boolean };

/** Copies to the clipboard; false when the system refused, so the teacher can copy by hand. */
async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function ExportGradesDialog({
  classRecord,
  learners,
  grades,
  terms,
  raw,
  shownTerm,
  onError,
}: {
  classRecord: ClassRecord;
  learners: Learner[];
  /** Term and final grades per learner: numbers, or codes for descriptive grading. */
  grades: Map<number, LearnerGrades>;
  /** Terms the subject runs. */
  terms: Term[];
  /** The class record's activities and scores (numeric grading), so another class record can rebuild its sheets. */
  raw?: { activities: Activity[]; scores: Map<string, number> };
  /** The term tab the teacher has open, sent by default; null for the summary (all terms). */
  shownTerm?: Term | null;
  onError: (e: unknown) => void;
}) {
  const termCounts = terms.map((t) => learners.filter((l) => (grades.get(l.id)?.terms[t - 1] ?? null) !== null).length);
  // The open term tab, else the latest term with grades, is usually the one being sent.
  const latest = [...terms].reverse().find((_, i) => termCounts[terms.length - 1 - i] > 0) ?? terms[0];
  const initial =
    shownTerm === undefined
      ? String(latest)
      : shownTerm === null && terms.length > 1
        ? "all"
        : String(shownTerm ?? latest);

  const [open, setOpen] = useState(false);
  const [teacher, setTeacher] = useState("");
  const [which, setWhich] = useState<string>(initial);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [sent, setSent] = useState<Sent | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSent(null);
    setPassword("");
    setConfirm("");
    setWhich(initial);
    getProfile().then((p) => setTeacher(p.teacher_name), onError);
  }, [open, initial, onError]);

  const noLrn = learners.filter((l) => !l.lrn.trim()).length;
  const passwordOk = password === confirm;
  const chosenTerms: Term[] = which === "all" ? terms : [Number(which) as Term];

  const buildPacket = async (): Promise<GradePacket> => {
    const profile = await getProfile();
    const acts = raw?.activities.filter((a) => chosenTerms.includes(a.term)) ?? [];
    return {
      exported_at: new Date().toISOString(),
      teacher_name: teacher.trim(),
      school_name: profile.school_name,
      school_id: profile.school_id,
      school_year: classRecord.school_year,
      grade_level: classRecord.grade_level,
      section: classRecord.section,
      learning_area: classRecord.learning_area,
      subject_type: classRecord.subject_type || undefined,
      terms_included: chosenTerms,
      activities: raw
        ? acts.map((a) => ({
            term: a.term,
            component: a.component,
            position: a.position,
            highest_score: a.highest_score,
          }))
        : undefined,
      learners: learners.map((l) => {
        const g = grades.get(l.id);
        return {
          lrn: l.lrn,
          last_name: l.last_name,
          first_name: l.first_name,
          middle_name: l.middle_name,
          sex: l.sex,
          // Only the chosen terms; the adviser keeps what they already have for the others.
          terms: [1, 2, 3].map((t) => (chosenTerms.includes(t as Term) ? (g?.terms[t - 1] ?? null) : null)),
          final: g?.final ?? null,
          scores: raw ? acts.map((a) => raw.scores.get(scoreKey(a.id, l.id)) ?? null) : undefined,
        };
      }),
    };
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };

  const copyText = () =>
    run(async () => {
      const text = await packetToText(await buildPacket(), password || undefined);
      setSent({ kind: "text", text, copied: await copy(text) });
    });

  const saveFile = () =>
    run(async () => {
      const packet = await buildPacket();
      const path = await save({
        defaultPath: packetFileName(packet),
        filters: [{ name: "TWIG grade file", extensions: [FILE_EXTENSION] }],
      });
      if (!path) return;
      await writeTextFile(path, await serializePacket(packet, password || undefined));
      setSent({ kind: "file", path });
    });

  const what = which === "all" ? "All terms" : `Term ${which}`;
  const adviser = `the adviser of ${gradeLabel(classRecord.grade_level)} – ${classRecord.section}`;

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
            Copy the grades as text to paste in Messenger, or save a file to send by email or USB. They import it with
            Import grades in their class record.
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <div className="flex gap-3 rounded-lg bg-primary/10 p-4 text-sm">
            <CheckCircle2 className="size-5 shrink-0 text-primary" />
            <div className="min-w-0">
              {sent.kind === "file" ? (
                <>
                  <p className="font-medium">{what} grade file saved</p>
                  <p className="mt-1 break-all text-muted-foreground">{sent.path}</p>
                  <p className="mt-2">Send this file to {adviser}.</p>
                </>
              ) : (
                <>
                  <p className="font-medium">
                    {sent.copied
                      ? `${what} grades copied as text`
                      : `Couldn't copy the ${what} grades. Copy the text below.`}
                  </p>
                  <textarea
                    readOnly
                    rows={3}
                    aria-label="Grades text"
                    className="mt-2 w-full resize-none rounded-md border bg-background p-2 font-mono text-xs break-all"
                    value={sent.text}
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-1"
                    onClick={async () => setSent({ ...sent, copied: await copy(sent.text) })}
                  >
                    <Copy /> Copy again
                  </Button>
                  <p className="mt-2">
                    Paste it in a message to {adviser}. Send the whole text in one message, without changing it.
                  </p>
                  {sent.text.length > LONG_TEXT && (
                    <p className="mt-2 text-amber-700">
                      It's long ({sent.text.length.toLocaleString()} characters), so the chat app may cut it. If it
                      does, save a file instead.
                    </p>
                  )}
                  <p className="mt-2 text-muted-foreground">
                    If the message won't send, go back and save a file instead.
                  </p>
                </>
              )}
              {password && <p className="mt-2">Tell them the password separately, not in the same message.</p>}
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
                {learners.length} learners · {terms.map((t, i) => `Term ${t}: ${termCounts[i]} graded`).join(" · ")}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {raw
                  ? "Term grades and raw scores are sent. Advisers use the grades; a class record that imports it gets the scores too."
                  : "Only term and final grades are sent."}
              </p>
            </div>

            <Field
              label="What to send"
              hint={
                which === "all"
                  ? "Every term, replacing all of this subject's grades the adviser has."
                  : `Only Term ${which}. The adviser keeps the other terms they already imported.`
              }
            >
              <SimpleSelect
                value={which}
                onValueChange={setWhich}
                options={[
                  ...terms.map((t, i) => ({ value: String(t), label: `Term ${t} (${termCounts[i]} graded)` })),
                  ...(terms.length > 1 ? [{ value: "all", label: "All terms" }] : []),
                ]}
              />
            </Field>

            {noLrn > 0 && (
              <p className="flex gap-2 text-xs text-amber-700">
                <TriangleAlert className="size-4 shrink-0" />
                {noLrn} learner(s) have no LRN, so the adviser's TWIG will match them by full name instead. Spelling
                must match.
              </p>
            )}

            <Field
              label="Sent by"
              hint={teacher.trim() ? undefined : "Add your name so the adviser knows who sent it."}
            >
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
              A password keeps learner grades private if the message or file is forwarded to the wrong person. It can't
              be recovered if forgotten.
            </p>
          </div>
        )}

        <DialogFooter>
          {sent ? (
            <>
              <Button variant="outline" onClick={() => setSent(null)}>
                Back
              </Button>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </>
          ) : (
            <>
              <Button variant="outline" disabled={busy || learners.length === 0 || !passwordOk} onClick={saveFile}>
                <FileDown /> Save file…
              </Button>
              <Button disabled={busy || learners.length === 0 || !passwordOk} onClick={copyText}>
                <Copy /> Copy as text
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
