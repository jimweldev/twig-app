import { useState } from "react";
import { open as openDialog, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import {
  ArrowRight,
  CheckCircle2,
  CircleCheck,
  ClipboardPaste,
  Copy,
  FileDown,
  FileUp,
  Info,
  Send,
  TriangleAlert,
  UserPlus,
} from "lucide-react";
import { useSchool } from "@/app/school";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  FILE_EXTENSION,
  fileToText,
  GradeFileError,
  isEncrypted,
  learnerListFileName,
  matchLearners,
  parseLearnerList,
  PasswordRequiredError,
  readGradeText,
  serializeLearnerList,
  type LearnerListPacket,
} from "@/ecr/exchange";
import { gradeLabel } from "@/ecr/levels";
import { addLearners, type Learner, type SchoolYear, type Section } from "@/lib/db";
import { displayName } from "@/lib/names";

/** Copies to the clipboard; false when the system refused, so the teacher can copy by hand. */
async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Learner lists carry no grades; matching only needs names and LRNs. */
const asMatchable = (list: LearnerListPacket) => list.learners.map((l) => ({ ...l, terms: [], final: null }));

type Sent = { kind: "file"; path: string } | { kind: "text"; text: string; copied: boolean };

/** Sends this section's class list to another teacher, as text or a file. */
export function SendLearnersDialog({
  schoolYear,
  section,
  learners,
}: {
  schoolYear: SchoolYear;
  section: Section;
  learners: Learner[];
}) {
  const { profile, onError } = useSchool();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [sent, setSent] = useState<Sent | null>(null);
  const [busy, setBusy] = useState(false);
  const passwordOk = password === confirm;

  const packet = (): LearnerListPacket => ({
    exported_at: new Date().toISOString(),
    teacher_name: profile?.teacher_name ?? "",
    school_year: schoolYear.name,
    grade_level: section.grade_level,
    section: section.name,
    learners: learners.map((l) => ({
      lrn: l.lrn,
      last_name: l.last_name,
      first_name: l.first_name,
      middle_name: l.middle_name,
      sex: l.sex,
      birthdate: l.birthdate,
    })),
  });

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
      const text = await fileToText(await serializeLearnerList(packet(), password || undefined));
      setSent({ kind: "text", text, copied: await copy(text) });
    });

  const saveFile = () =>
    run(async () => {
      const p = packet();
      const path = await save({
        defaultPath: learnerListFileName(p),
        filters: [{ name: "TWIG learner list", extensions: [FILE_EXTENSION] }],
      });
      if (!path) return;
      await writeTextFile(path, await serializeLearnerList(p, password || undefined));
      setSent({ kind: "file", path });
    });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setSent(null);
          setPassword("");
          setConfirm("");
        }
      }}
    >
      <Button variant="outline" disabled={learners.length === 0} onClick={() => setOpen(true)}>
        <Send /> Send learners
      </Button>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Send the class list</DialogTitle>
          <DialogDescription>
            Another teacher imports it to get the same learners. Copy it as text for Messenger, or save a file.
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <div className="flex gap-3 rounded-lg bg-primary/10 p-4 text-sm">
            <CheckCircle2 className="size-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              {sent.kind === "file" ? (
                <>
                  <p className="font-medium">Class list file saved</p>
                  <p className="mt-1 break-all text-muted-foreground">{sent.path}</p>
                </>
              ) : (
                <>
                  <p className="font-medium">
                    {sent.copied ? "Class list copied as text" : "Couldn't copy. Copy the text below."}
                  </p>
                  <textarea
                    readOnly
                    rows={3}
                    aria-label="Class list text"
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
                  <p className="mt-2">Send the whole text in one message, without changing it.</p>
                </>
              )}
              {password && <p className="mt-2">Tell them the password separately, not in the same message.</p>}
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="rounded-lg border p-3 text-sm">
              <p className="font-medium">
                {gradeLabel(section.grade_level)} – {section.name} · SY {schoolYear.name}
              </p>
              <p className="mt-1 text-muted-foreground">{learners.length} learners · names, LRN, sex and birthdate</p>
            </div>
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
              LRNs and birthdates are personal data. A password keeps them private if the message is forwarded.
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
              <Button variant="outline" disabled={busy || !passwordOk} onClick={saveFile}>
                <FileDown /> Save file…
              </Button>
              <Button disabled={busy || !passwordOk} onClick={copyText}>
                <Copy /> Copy as text
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Step =
  | { kind: "closed" }
  | { kind: "source"; error?: string }
  | { kind: "password"; text: string; error?: string }
  | { kind: "preview"; list: LearnerListPacket };

/** Adds the learners from another teacher's class list that this section doesn't have yet. */
export function ImportLearnersDialog({
  schoolYear,
  section,
  learners,
  onImported,
}: {
  schoolYear: SchoolYear;
  section: Section;
  learners: Learner[];
  onImported: () => Promise<void>;
}) {
  const { onError } = useSchool();
  const [step, setStep] = useState<Step>({ kind: "closed" });
  const [pasted, setPasted] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const close = () => setStep({ kind: "closed" });

  const load = async (text: string, pw?: string) => {
    try {
      setStep({ kind: "preview", list: await parseLearnerList(text, pw) });
    } catch (e) {
      if (e instanceof PasswordRequiredError) setStep({ kind: "password", text, error: pw ? e.message : undefined });
      else if (e instanceof GradeFileError) setStep({ kind: "source", error: e.message });
      else onError(e);
    }
  };

  const openText = async (raw: string) => {
    setPassword("");
    try {
      const text = await readGradeText(raw);
      if (isEncrypted(text)) setStep({ kind: "password", text });
      else await load(text);
    } catch (e) {
      if (e instanceof GradeFileError) setStep({ kind: "source", error: e.message });
      else onError(e);
    }
  };

  const pickFile = async () => {
    try {
      const path = await openDialog({
        multiple: false,
        directory: false,
        filters: [{ name: "TWIG learner list", extensions: [FILE_EXTENSION, "txt"] }],
      });
      if (path) await openText(await readTextFile(path));
    } catch (e) {
      onError(e);
    }
  };

  const list = step.kind === "preview" ? step.list : null;
  const matchable = list ? asMatchable(list) : [];
  const match = list ? matchLearners(matchable, learners) : null;
  // matchLearners hands back the objects it was given, so new learners are found by identity.
  const newOnes = list && match ? list.learners.filter((_, i) => match.unmatched.includes(matchable[i])) : [];
  const warnings = list
    ? [
        ...(list.school_year !== schoolYear.name
          ? [`Different school year: ${list.school_year} → ${schoolYear.name}`]
          : []),
        ...(list.grade_level !== section.grade_level
          ? [`Different grade: ${gradeLabel(list.grade_level)} → ${gradeLabel(section.grade_level)}`]
          : []),
        ...(list.section.trim().toLowerCase() !== section.name.trim().toLowerCase()
          ? [`Different section: ${list.section} → ${section.name}`]
          : []),
      ]
    : [];

  const doImport = async () => {
    setBusy(true);
    try {
      await addLearners(
        section.id,
        newOnes.map((l) => ({
          lrn: l.lrn,
          last_name: l.last_name,
          first_name: l.first_name,
          middle_name: l.middle_name,
          sex: l.sex,
          birthdate: l.birthdate,
        })),
      );
      await onImported();
      close();
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setPasted("");
          setStep({ kind: "source" });
        }}
      >
        <UserPlus /> Import learners
      </Button>

      <Dialog open={step.kind !== "closed"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-lg">
          {step.kind === "source" && (
            <>
              <DialogHeader>
                <DialogTitle>Import learners</DialogTitle>
                <DialogDescription>
                  Paste the class list text another teacher sent, or open their file.
                </DialogDescription>
              </DialogHeader>
              <Textarea
                autoFocus
                rows={5}
                className="max-h-48 font-mono text-xs break-all md:text-xs"
                placeholder="TWIG1:H4sIAAAA…~"
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
              />
              {step.error && <p className="text-sm text-destructive">{step.error}</p>}
              <DialogFooter className="sm:justify-between">
                <Button variant="outline" onClick={pickFile}>
                  <FileUp /> Open a file instead…
                </Button>
                <Button disabled={!pasted.trim()} onClick={() => openText(pasted)}>
                  <ClipboardPaste /> Read pasted text
                </Button>
              </DialogFooter>
            </>
          )}

          {step.kind === "password" && (
            <>
              <DialogHeader>
                <DialogTitle>Password needed</DialogTitle>
                <DialogDescription>Ask the teacher who sent the class list for the password.</DialogDescription>
              </DialogHeader>
              <form
                id="learners-pw-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  load(step.text, password);
                }}
              >
                <Field label="Password" hint={step.error}>
                  <Input
                    type="password"
                    autoFocus
                    value={password}
                    aria-invalid={!!step.error}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </Field>
              </form>
              <DialogFooter>
                <Button variant="outline" onClick={close}>
                  Cancel
                </Button>
                <Button type="submit" form="learners-pw-form" disabled={!password}>
                  Open
                </Button>
              </DialogFooter>
            </>
          )}

          {list && match && (
            <>
              <DialogHeader>
                <DialogTitle>Import learners</DialogTitle>
                <DialogDescription>Only learners not in this section yet are added.</DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-lg border p-3 text-sm">
                <div className="min-w-0">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">From</p>
                  <p className="truncate font-semibold">
                    {gradeLabel(list.grade_level)} – {list.section}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{list.teacher_name || "Unnamed teacher"}</p>
                </div>
                <ArrowRight className="size-4 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">To</p>
                  <p className="truncate font-semibold">
                    {gradeLabel(section.grade_level)} – {section.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">SY {schoolYear.name}</p>
                </div>
              </div>

              <ul className="grid gap-1.5 text-sm">
                <li className="flex items-center gap-2">
                  <CircleCheck className="size-4 shrink-0 text-primary" />
                  {newOnes.length} new {newOnes.length === 1 ? "learner" : "learners"} to add
                </li>
                <li className="flex items-center gap-2 text-muted-foreground">
                  <Info className="size-4 shrink-0" />
                  {match.matched.length} already in {section.name}, skipped
                </li>
                {warnings.map((w) => (
                  <li key={w} className="flex items-center gap-2 text-amber-800">
                    <TriangleAlert className="size-4 shrink-0" /> {w}
                  </li>
                ))}
              </ul>

              {newOnes.length > 0 && (
                <ul className="max-h-40 overflow-auto rounded-lg border px-3 py-2 text-sm">
                  {newOnes.map((l, i) => (
                    <li key={i} className="py-0.5">
                      {displayName(l)}
                      {l.lrn && <span className="ml-1 font-mono text-xs text-muted-foreground">({l.lrn})</span>}
                    </li>
                  ))}
                </ul>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={close}>
                  Cancel
                </Button>
                <Button disabled={busy || newOnes.length === 0} onClick={doImport}>
                  <UserPlus /> Add {newOnes.length} {newOnes.length === 1 ? "learner" : "learners"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
