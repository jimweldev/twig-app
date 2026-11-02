import { useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { ArrowRight, CircleCheck, GitCompare, ClipboardPaste, Download, FileUp, Info, TriangleAlert } from "lucide-react";
import { SimpleSelect } from "@/components/simple-select";
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
  addLearners,
  clearReceivedTerms,
  replaceTermScores,
  snapshotImport,
  listLearners,
  saveReceived,
  type ImportedActivity,
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
  packetTerms,
  parsePacket,
  PasswordRequiredError,
  readGradeText,
  scoreTerms,
  type GradePacket,
} from "@/ecr/exchange";
import { areasForGrade, gradeLabel, isSeniorHigh, KINDER_RECORD, partArea, partsOf, type AreaPart } from "@/ecr/levels";
import { displayName } from "@/lib/names";
import { ImportChanges } from "./ImportChanges";
import type { ImportResult } from "./ImportReviewBar";

type Step =
  | { kind: "closed" }
  | { kind: "source"; error?: string }
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
  learningArea,
  classId,
  shownTerm,
  parts = [],
  shownPart,
  disabled,
  lockedTerms = [],
  onImported,
  onError,
}: {
  schoolYear: SchoolYear;
  section: Section;
  learners: Learner[];
  received: ReceivedGrade[];
  localClasses: ClassRecord[];
  /** Set when importing from a class record: the grades are saved for this learning area, whatever the file says. */
  learningArea?: string;
  /** A numerically graded class record: terms with raw scores in the file rebuild its sheets. */
  classId?: number;
  /** The term tab open in the class record: a one-term file goes there by default. */
  shownTerm?: number | null;
  /** The class record's parts (MAPEH): grades can go into one of them. */
  parts?: AreaPart[];
  /** The part sheet open in the class record: the import goes there by default. */
  shownPart?: string;
  /** While an earlier import waits to be kept or undone. */
  disabled?: boolean;
  /** Finalized terms of the class record; nothing can be imported into them. */
  lockedTerms?: number[];
  /** Called after the import is saved, with what it changed so the page can offer to undo it. */
  onImported: (result: ImportResult) => Promise<void>;
  onError: (e: unknown) => void;
}) {
  const [step, setStep] = useState<Step>({ kind: "closed" });
  const [pasted, setPasted] = useState("");
  const [password, setPassword] = useState("");
  // For each term in the file, the term it goes into here; 0 skips it. Terms not written to stay as they are.
  const [targets, setTargets] = useState<Record<number, number>>({});
  const [addMissing, setAddMissing] = useState(true);
  // MAPEH: the part the grades go into; "" for the whole learning area.
  const [intoPart, setIntoPart] = useState("");
  // The file's part to copy from, when the file is from a MAPEH record; "" picks one.
  const [fromPart, setFromPart] = useState("");
  const [busy, setBusy] = useState(false);
  // The current-vs-new table, opened on request.
  const [comparing, setComparing] = useState(false);

  const load = async (text: string, pw?: string) => {
    try {
      const packet = await parsePacket(text, pw);
      const terms = packetTerms(packet);
      setTargets(Object.fromEntries(terms.map((t) => [t, terms.length === 1 && shownTerm ? shownTerm : t])));
      setIntoPart(parts.some((x) => x.id === shownPart) ? shownPart! : "");
      setFromPart("");
      setComparing(false);
      setStep({ kind: "preview", packet, checksum: await packetChecksum(packet) });
    } catch (e) {
      if (e instanceof PasswordRequiredError) setStep({ kind: "password", text, error: pw ? e.message : undefined });
      else if (e instanceof GradeFileError) setStep({ kind: "error", message: e.message });
      else onError(e);
    }
  };

  /** Opens grades from pasted text or a file's contents. */
  const open = async (raw: string) => {
    setPassword("");
    setAddMissing(true);
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
        filters: [{ name: "TWIG grade file", extensions: [FILE_EXTENSION, "txt"] }],
      });
      if (!path) return;
      await open(await readTextFile(path));
    } catch (e) {
      onError(e);
    }
  };

  const start = () => {
    setPasted("");
    setStep({ kind: "source" });
  };

  const close = () => setStep({ kind: "closed" });

  // ---- Preview checks ----
  const preview = step.kind === "preview" ? step : null;
  const p = preview?.packet;
  const blockers: string[] = [];
  // Short notes, each worth a second look before importing.
  const warnings: string[] = [];
  let match: ReturnType<typeof matchLearners<Learner>> | null = null;
  let existing: ReceivedGrade | undefined;

  // Where the grades are saved: the class record's subject, else the file's.
  const area = learningArea ?? p?.learning_area ?? "";
  const part = parts.find((x) => x.id === intoPart);
  // Term grades for one part are kept apart from the whole learning area's.
  const savedArea = part ? partArea(area, part.id) : area;
  // A file from a MAPEH record has its own parts. Copy the one with scores, else the same part.
  const fileActs = p?.activities ?? [];
  const fileParts = p ? partsOf(p.learning_area).filter((x) => fileActs.some((a) => a.part === x.id)) : [];
  const scoredParts = fileParts.filter((x) =>
    fileActs.some((a, i) => a.part === x.id && p!.learners.some((l) => (l.scores?.[i] ?? null) !== null)),
  );
  const source = !part
    ? ""
    : fileParts.some((x) => x.id === fromPart)
      ? fromPart
      : scoredParts.length === 1
        ? scoredParts[0].id
        : fileParts.some((x) => x.id === part.id)
          ? part.id
          : (fileParts[0]?.id ?? "");
  const sourceLabel = fileParts.find((x) => x.id === source)?.label;
  const target = part ? `${area} – ${part.label}` : area;
  // Terms rebuilt from raw scores; the rest are imported as term grades.
  const scored = classId && p ? scoreTerms(p) : [];

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
    else if (
      !learningArea &&
      !isSeniorHigh(section.grade_level) &&
      !areasForGrade(section.grade_level).some((a) => a.name === p.learning_area)
    )
      blockers.push(`${p.learning_area} is not a learning area for ${gradeLabel(section.grade_level)}.`);
    if (p.learning_area !== area)
      warnings.push(`Different subject: the file is ${p.learning_area}, this record is ${area}`);
    if (p.section.trim().toLowerCase() !== section.name.trim().toLowerCase())
      warnings.push(`Different section: ${p.section} → ${section.name}`);

    existing = received.find((r) => r.learning_area === savedArea);
    if (existing?.checksum === preview.checksum) warnings.push("Already imported once");
    // A one-term file is expected to be older than the last term's import.
    else if (existing && existing.exported_at > p.exported_at && packetTerms(p).length === 3)
      warnings.push(`Older than the grades already imported (${formatDateTime(existing.exported_at)})`);

    match = matchLearners(p.learners, learners);
  }

  // Each ticked file term and where it goes.
  const pairs = p
    ? packetTerms(p)
        .map((from) => ({ from, to: targets[from] ?? 0 }))
        .filter((x) => x.to > 0)
    : [];
  // A one-term file defaults to the term tab open here, which may not be the file's term.
  for (const x of pairs)
    if (x.from !== x.to) warnings.push(`Different term: the file's Term ${x.from} goes into your Term ${x.to}`);
  const clash = new Set(pairs.map((x) => x.to)).size !== pairs.length;
  const intoLocked = pairs.filter((x) => lockedTerms.includes(x.to)).map((x) => x.to);
  const hasOwnRecord = localClasses.some((c) => c.learning_area === area);

  const doImport = async () => {
    if (!p || !preview) return;
    setBusy(true);
    try {
      const fromScores = pairs.filter((x) => scored.includes(x.from));
      const fromGrades = pairs.filter((x) => !scored.includes(x.from));
      const snapshot = await snapshotImport(
        section.id,
        savedArea,
        classId,
        fromScores.map((x) => x.to as 1 | 2 | 3),
      );
      let current = learners;
      if (addMissing && match && match.unmatched.length > 0) {
        await addLearners(section.id, match.unmatched);
        current = await listLearners(section.id);
      }
      const final = matchLearners(p.learners, current);
      if (classId && fromScores.length > 0) {
        for (const { from, to } of fromScores) {
          // Into one part: the chosen part's columns when the file has parts, else all of them.
          const acts: ImportedActivity[] = fileActs.flatMap((a, i) =>
            a.term !== from || (source && a.part !== source)
              ? []
              : [
                  {
                    component: a.component,
                    position: a.position,
                    highest_score: a.highest_score,
                    part: part?.id ?? a.part,
                    scores: new Map(
                      final.matched.flatMap((m) => {
                        const s = m.incoming.scores?.[i] ?? null;
                        return s === null ? [] : [[m.learner.id, s] as [number, number]];
                      }),
                    ),
                  },
                ],
          );
          await replaceTermScores(classId, to as 1 | 2 | 3, acts, part?.id);
        }
        await clearReceivedTerms(
          section.id,
          savedArea,
          fromScores.map((x) => x.to),
        );
      }
      if (fromGrades.length > 0)
        await saveReceived({
          section_id: section.id,
          learning_area: savedArea,
          teacher_name: p.teacher_name,
          exported_at: p.exported_at,
          checksum: preview.checksum,
          terms: fromGrades.map((x) => x.to),
          rows: final.matched.map((m) => {
            const terms: (number | string | null)[] = [null, null, null];
            for (const { from, to } of fromGrades) terms[to - 1] = m.incoming.terms[from - 1] ?? null;
            // The sender's final only fits when terms land where they came from.
            const same = pairs.every((x) => x.from === x.to);
            return { learner_id: m.learner.id, terms, final: same ? m.incoming.final : null };
          }),
        });
      const moves = (xs: typeof pairs) =>
        xs
          .map(
            (x) =>
              `${p.learning_area}${sourceLabel ? ` – ${sourceLabel}` : ""} Term ${x.from} → ${target} Term ${x.to}`,
          )
          .join(", ");
      close();
      await onImported({
        title: `${target} grades imported`,
        focusTerm: pairs[0]?.to,
        snapshot,
        summary: [
          ...(fromScores.length && classId ? [`Scores: ${moves(fromScores)}`] : []),
          ...(fromGrades.length ? [`Term grades: ${moves(fromGrades)}`] : []),
          `${final.matched.length} learners matched`,
        ],
      });
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
        disabled={disabled}
        title={disabled ? "Keep or undo the last import first" : undefined}
        onClick={start}
      >
        <Download /> Import grades
      </Button>

      <Dialog open={step.kind !== "closed"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-lg">
          {step.kind === "source" && (
            <>
              <DialogHeader>
                <DialogTitle>Import grades</DialogTitle>
                <DialogDescription>
                  Paste the grades text a subject teacher sent you, or open the grade file they sent.
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
                <Button disabled={!pasted.trim()} onClick={() => open(pasted)}>
                  <ClipboardPaste /> Read pasted text
                </Button>
              </DialogFooter>
            </>
          )}

          {step.kind === "password" && (
            <>
              <DialogHeader>
                <DialogTitle>Password needed</DialogTitle>
                <DialogDescription>Ask the teacher who sent the grades for the password.</DialogDescription>
              </DialogHeader>
              <form
                id="pw-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  load(step.text, password);
                }}
              >
                <Field label="Password" required hint={step.error}>
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
                <DialogTitle>Can&rsquo;t import these grades</DialogTitle>
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
                <DialogTitle>Import grades</DialogTitle>
                <DialogDescription>Check where the grades go, then import.</DialogDescription>
              </DialogHeader>

              <div className="grid gap-3 text-sm">
                {blockers.map((b) => (
                  <p key={b} className="flex gap-2 rounded-md bg-destructive/10 p-2 text-destructive">
                    <TriangleAlert className="size-4 shrink-0" /> {b}
                  </p>
                ))}

                {blockers.length === 0 && (
                  <>
                    {/* Source and target, side by side, then each term's move. */}
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-3 gap-y-2 rounded-lg border p-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">From</p>
                        <p className="truncate font-semibold">{p.learning_area}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {p.teacher_name || "Unnamed teacher"} · {formatDateTime(p.exported_at)}
                        </p>
                      </div>
                      <ArrowRight className="size-4 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">To</p>
                        <p className="truncate font-semibold">{area}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {gradeLabel(section.grade_level)} – {section.name}
                        </p>
                      </div>

                      {parts.length > 0 && (
                        <div className="col-span-3 grid grid-cols-subgrid items-center border-t pt-2">
                          {part && fileParts.length > 0 ? (
                            <SimpleSelect
                              className="h-8 w-full"
                              value={source}
                              onValueChange={setFromPart}
                              options={fileParts.map((x) => ({
                                value: x.id,
                                label: scoredParts.includes(x) ? x.label : `${x.label} (no scores)`,
                              }))}
                            />
                          ) : (
                            <p className="font-medium">Into</p>
                          )}
                          <ArrowRight className="size-4 text-muted-foreground" />
                          <SimpleSelect
                            className="h-8 w-full"
                            value={intoPart || "all"}
                            onValueChange={(v) => setIntoPart(v === "all" ? "" : v)}
                            options={[
                              ...parts.map((x) => ({ value: x.id, label: x.label })),
                              { value: "all", label: `Whole ${area}` },
                            ]}
                          />
                        </div>
                      )}

                      {packetTerms(p).map((t) => {
                        const graded = p.learners.filter((l) => (l.terms[t - 1] ?? null) !== null).length;
                        const to = targets[t] ?? 0;
                        return (
                          <div key={t} className="col-span-3 grid grid-cols-subgrid items-center border-t pt-2">
                            <p>
                              <span className="font-medium">Term {t}</span>
                              <span className="text-xs text-muted-foreground"> · {graded} graded</span>
                            </p>
                            <ArrowRight className="size-4 text-muted-foreground" />
                            <SimpleSelect
                              className="h-8 w-full"
                              value={String(to)}
                              onValueChange={(v) => setTargets({ ...targets, [t]: Number(v) })}
                              options={[
                                ...[1, 2, 3].map((n) => ({ value: String(n), label: `Term ${n}` })),
                                // Only worth offering when the file carries more than one term.
                                ...(packetTerms(p).length > 1 ? [{ value: "0", label: "Skip" }] : []),
                              ]}
                            />
                          </div>
                        );
                      })}
                    </div>

                    {/* One short line per thing to know. */}
                    <ul className="grid gap-1.5">
                      <li className="flex items-center gap-2">
                        <CircleCheck className="size-4 shrink-0 text-primary" />
                        {match.matched.length} of {p.learners.length} learners matched
                      </li>
                      {pairs.map(({ from, to }) => (
                        <li key={from} className="flex items-center gap-2 text-muted-foreground">
                          <Info className="size-4 shrink-0" />
                          {scored.includes(from) && classId
                            ? `Replaces your Term ${to} ${part ? `${part.label} ` : ""}scores`
                            : hasOwnRecord
                              ? `Replaces Term ${to} ${part ? `${part.label} ` : ""}grades in your ${area} record`
                              : `Replaces Term ${to} ${target} grades`}
                        </li>
                      ))}
                      {warnings.map((w) => (
                        <li key={w} className="flex items-start gap-2 rounded-md bg-amber-50 p-2 text-amber-800">
                          <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {w}
                        </li>
                      ))}
                      {intoLocked.length > 0 && (
                        <li className="flex items-center gap-2 text-destructive">
                          <TriangleAlert className="size-4 shrink-0" /> Term {intoLocked.join(", ")} is finalized.
                          Unfinalize it or pick another term.
                        </li>
                      )}
                      {clash && (
                        <li className="flex items-center gap-2 text-destructive">
                          <TriangleAlert className="size-4 shrink-0" /> Two terms go into the same term. Pick different
                          ones.
                        </li>
                      )}
                    </ul>

                    {pairs.length > 0 &&
                      // One part copied from a file with parts: the file's term grades are the whole area's.
                      !(part && fileParts.length > 0) &&
                      (comparing ? (
                        <ImportChanges
                          section={section}
                          learners={learners}
                          localClasses={localClasses}
                          area={area}
                          partId={part?.id}
                          pairs={pairs}
                          matched={match.matched}
                          onError={onError}
                        />
                      ) : (
                        <Button variant="outline" size="sm" className="justify-self-start" onClick={() => setComparing(true)}>
                          <GitCompare /> Compare current and new grades
                        </Button>
                      ))}

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
                <Button
                  disabled={busy || blockers.length > 0 || pairs.length === 0 || clash || intoLocked.length > 0}
                  onClick={doImport}
                >
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
