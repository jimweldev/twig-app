import { useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { Download, Info, TriangleAlert } from "lucide-react";
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
import {
  addLearners,
  listLearners,
  saveReceived,
  type ClassRecord,
  type Learner,
  type ReceivedGrade,
  type SchoolYear,
  type Section,
} from "@/lib/db";
import {
  FILE_EXTENSION,
  GradeFileError,
  isEncrypted,
  matchLearners,
  packetChecksum,
  parsePacket,
  PasswordRequiredError,
  type GradePacket,
} from "@/ecr/exchange";
import { areasForGrade, gradeLabel, isSeniorHigh, KINDER_RECORD } from "@/ecr/levels";
import { displayName } from "@/lib/names";

type Step =
  | { kind: "closed" }
  | { kind: "password"; text: string; error?: string }
  | { kind: "error"; message: string }
  | { kind: "preview"; packet: GradePacket; checksum: string };

const formatDateTime = (iso: string) =>
  new Date(iso.includes("T") ? iso : `${iso.replace(" ", "T")}Z`).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });

export function ImportGradesDialog({
  schoolYear,
  section,
  learners,
  received,
  localClasses,
  onImported,
  onError,
}: {
  schoolYear: SchoolYear;
  section: Section;
  learners: Learner[];
  received: ReceivedGrade[];
  localClasses: ClassRecord[];
  onImported: () => Promise<void>;
  onError: (e: unknown) => void;
}) {
  const [step, setStep] = useState<Step>({ kind: "closed" });
  const [password, setPassword] = useState("");
  const [addMissing, setAddMissing] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async (text: string, pw?: string) => {
    try {
      const packet = await parsePacket(text, pw);
      setStep({ kind: "preview", packet, checksum: await packetChecksum(packet) });
    } catch (e) {
      if (e instanceof PasswordRequiredError) setStep({ kind: "password", text, error: pw ? e.message : undefined });
      else if (e instanceof GradeFileError) setStep({ kind: "error", message: e.message });
      else onError(e);
    }
  };

  const pickFile = async () => {
    try {
      const path = await openDialog({
        multiple: false,
        directory: false,
        filters: [{ name: "TWIG grade file", extensions: [FILE_EXTENSION] }],
      });
      if (!path) return;
      const text = await readTextFile(path);
      setPassword("");
      setAddMissing(true);
      if (isEncrypted(text)) setStep({ kind: "password", text });
      else await load(text);
    } catch (e) {
      onError(e);
    }
  };

  const close = () => setStep({ kind: "closed" });

  // ---- Preview checks ----
  const preview = step.kind === "preview" ? step : null;
  const p = preview?.packet;
  const blockers: string[] = [];
  const warnings: string[] = [];
  let match: ReturnType<typeof matchLearners<Learner>> | null = null;
  let existing: ReceivedGrade | undefined;

  if (p && preview) {
    if (p.school_year !== schoolYear.name)
      blockers.push(`This file is for SY ${p.school_year}, but this section is in SY ${schoolYear.name}.`);
    if (p.grade_level !== section.grade_level)
      blockers.push(
        `This file is for ${gradeLabel(p.grade_level)}, but this section is ${gradeLabel(section.grade_level)}.`,
      );
    // Senior High subjects are free-form; other grades must use a standard learning area.
    if (p.learning_area === KINDER_RECORD)
      blockers.push("Kindergarten progress isn't sent between teachers; it stays with the adviser's record.");
    else if (!isSeniorHigh(section.grade_level) && !areasForGrade(section.grade_level).some((a) => a.name === p.learning_area))
      blockers.push(`${p.learning_area} is not a learning area for ${gradeLabel(section.grade_level)}.`);
    if (p.section.trim().toLowerCase() !== section.name.trim().toLowerCase())
      warnings.push(`The file says section "${p.section}". Check it's meant for ${section.name} before importing.`);

    existing = received.find((r) => r.learning_area === p.learning_area);
    if (existing?.checksum === preview.checksum) warnings.push("This exact file was already imported.");
    else if (existing && existing.exported_at > p.exported_at)
      warnings.push(
        `This file is older than the ${p.learning_area} grades already imported (exported ${formatDateTime(existing.exported_at)}).`,
      );
    if (localClasses.some((c) => c.learning_area === p.learning_area))
      warnings.push(
        `You also have your own ${p.learning_area} class record for this section. The section's grades will keep using yours.`,
      );

    match = matchLearners(p.learners, learners);
  }

  const doImport = async () => {
    if (!p || !preview) return;
    setBusy(true);
    try {
      let current = learners;
      if (addMissing && match && match.unmatched.length > 0) {
        await addLearners(section.id, match.unmatched);
        current = await listLearners(section.id);
      }
      const final = matchLearners(p.learners, current);
      await saveReceived({
        section_id: section.id,
        learning_area: p.learning_area,
        teacher_name: p.teacher_name,
        exported_at: p.exported_at,
        checksum: preview.checksum,
        rows: final.matched.map((m) => ({
          learner_id: m.learner.id,
          terms: m.incoming.terms,
          final: m.incoming.final,
        })),
      });
      await onImported();
      close();
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };

  const byLrn = match?.matched.filter((m) => m.by === "lrn").length ?? 0;
  const byName = (match?.matched.length ?? 0) - byLrn;

  return (
    <>
      <Button variant="outline" onClick={pickFile}>
        <Download /> Import grades
      </Button>

      <Dialog open={step.kind !== "closed"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-lg">
          {step.kind === "password" && (
            <>
              <DialogHeader>
                <DialogTitle>Password needed</DialogTitle>
                <DialogDescription>Ask the teacher who sent the file for its password.</DialogDescription>
              </DialogHeader>
              <form
                id="pw-form"
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
                <Button type="submit" form="pw-form" disabled={!password}>
                  Open file
                </Button>
              </DialogFooter>
            </>
          )}

          {step.kind === "error" && (
            <>
              <DialogHeader>
                <DialogTitle>Can't import this file</DialogTitle>
                <DialogDescription>{step.message}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button onClick={close}>OK</Button>
              </DialogFooter>
            </>
          )}

          {p && match && (
            <>
              <DialogHeader>
                <DialogTitle>Import {p.learning_area} grades</DialogTitle>
                <DialogDescription>
                  From {p.teacher_name || "an unnamed teacher"} · exported {formatDateTime(p.exported_at)}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-3 text-sm">
                {blockers.map((b) => (
                  <p key={b} className="flex gap-2 rounded-md bg-destructive/10 p-2 text-destructive">
                    <TriangleAlert className="size-4 shrink-0" /> {b}
                  </p>
                ))}
                {warnings.map((w) => (
                  <p key={w} className="flex gap-2 rounded-md bg-amber-50 p-2 text-amber-800">
                    <Info className="size-4 shrink-0" /> {w}
                  </p>
                ))}

                {blockers.length === 0 && (
                  <>
                    <div className="rounded-lg border p-3">
                      <p>
                        <span className="font-medium">{match.matched.length}</span> of {p.learners.length} learners
                        matched
                        {match.matched.length > 0 && (
                          <span className="text-muted-foreground">
                            {" "}
                            ({byLrn} by LRN, {byName} by name)
                          </span>
                        )}
                      </p>
                      {existing && existing.checksum !== preview!.checksum && (
                        <p className="mt-1 text-muted-foreground">
                          Replaces the {p.learning_area} grades from {existing.teacher_name || "an unnamed teacher"}{" "}
                          imported {formatDateTime(existing.imported_at)}.
                        </p>
                      )}
                    </div>

                    {match.unmatched.length > 0 && (
                      <div className="rounded-lg border p-3">
                        <p className="font-medium">
                          {match.unmatched.length} learner(s) are not in {section.name}:
                        </p>
                        <ul className="mt-1 max-h-32 overflow-auto text-muted-foreground">
                          {match.unmatched.map((l, i) => (
                            <li key={i}>
                              {displayName(l)}
                              {l.lrn && <span className="ml-1 font-mono text-xs">({l.lrn})</span>}
                            </li>
                          ))}
                        </ul>
                        <label className="mt-2 flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="accent-primary"
                            checked={addMissing}
                            onChange={(e) => setAddMissing(e.target.checked)}
                          />
                          Add them to {section.name} and import their grades
                        </label>
                        {!addMissing && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Their grades will be skipped. Fix name spellings or LRNs, then import again.
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={close}>
                  Cancel
                </Button>
                <Button disabled={busy || blockers.length > 0} onClick={doImport}>
                  Import grades
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
