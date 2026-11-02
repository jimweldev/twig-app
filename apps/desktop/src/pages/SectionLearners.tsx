import { Fragment, useEffect, useState } from "react";
import { ClipboardPaste, Pencil, Trash2, UserPlus } from "lucide-react";
import { cn } from "cn";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Field } from "@/components/field";
import { SimpleSelect } from "@/components/simple-select";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { addLearners, deleteLearner, updateLearner, type Learner, type NewLearner, type Sex } from "@/lib/db";
import { ageOn, displayName, normalizeDate, parseLearnerLine } from "@/lib/names";
import { todayIso } from "@/attendance/calendar";
import { moveFocus } from "@/ecr/TermSheet";

const EMPTY: NewLearner = { lrn: "", last_name: "", first_name: "", middle_name: "", sex: "M" };
const SEX_OPTIONS = [
  { value: "M", label: "Male" },
  { value: "F", label: "Female" },
];

/** An LRN is up to 12 digits; blank is allowed. Null when the text isn't one. */
const parseLrn = (text: string) => {
  const t = text.replace(/\s/g, "");
  return /^\d{0,12}$/.test(t) ? t : null;
};

/** A birthdate typed like Excel shows it (3/9/2014) or as 2014-03-09; blank is allowed. */
const parseBirthdate = (text: string) => (text.trim() ? normalizeDate(text) || null : "");

/** "2014-03-09" -> "03/09/2014": month first, two digits each so the column lines up. */
const showDate = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[2]}/${m[3]}/${m[1]}` : "";
};

/**
 * A cell that works like Excel: type straight into it, Enter and the arrow keys move,
 * Esc puts back what was there, and a column copied from Excel fills this row and the
 * ones below. `parse` turns typed text into the stored value, or null when it doesn't fit.
 */
function SheetCell({
  value,
  shown,
  row,
  col,
  label,
  placeholder,
  invalidHint,
  className,
  parse,
  onCommit,
  onPasteColumn,
}: {
  value: string;
  /** How the stored value looks in the cell. */
  shown: string;
  row: number;
  col: number;
  label: string;
  placeholder: string;
  invalidHint: string;
  className?: string;
  parse: (text: string) => string | null;
  onCommit: (value: string) => void;
  onPasteColumn: (values: string[]) => void;
}) {
  const [text, setText] = useState(shown);
  useEffect(() => setText(shown), [shown]);
  const parsed = parse(text);
  // Shown red only after leaving the cell, so a half-typed date like "9/" isn't flagged.
  const [typing, setTyping] = useState(false);
  const invalid = parsed === null && !typing;

  return (
    <input
      data-cell={`${row}:${col}`}
      value={text}
      placeholder={placeholder}
      aria-label={label}
      aria-invalid={invalid}
      title={invalid ? invalidHint : undefined}
      className={cn(
        "h-8 rounded-sm bg-transparent px-2 text-xs outline-none placeholder:font-sans placeholder:text-muted-foreground/40 hover:bg-muted/60 focus:bg-background focus:ring-2 focus:ring-primary",
        invalid && "bg-red-50 text-destructive",
        className,
      )}
      onChange={(e) => setText(e.target.value)}
      onFocus={(e) => {
        setTyping(true);
        e.currentTarget.select();
      }}
      onBlur={() => {
        setTyping(false);
        if (parsed !== null && parsed !== value) onCommit(parsed);
        // Same value typed another way (9/8/2013): show it the standard way again.
        else if (parsed === value) setText(shown);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setText(shown);
          e.currentTarget.blur();
          return;
        }
        moveFocus(e, row, col);
      }}
      onPaste={(e) => {
        const lines = e.clipboardData.getData("text/plain").replace(/\r\n?/g, "\n").replace(/\n$/, "").split("\n");
        if (lines.length < 2) return;
        e.preventDefault();
        // Only the first cell of each copied row belongs to this column.
        onPasteColumn(lines.map((line) => line.split("\t")[0]));
      }}
    />
  );
}

/** Shared inputs for adding and editing a learner. */
function LearnerFields<T extends NewLearner>({ value, onChange }: { value: T; onChange: (v: T) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Last name" required className="col-span-2">
        <Input value={value.last_name} onChange={(e) => onChange({ ...value, last_name: e.target.value })} />
      </Field>
      <Field label="First name" required>
        <Input value={value.first_name} onChange={(e) => onChange({ ...value, first_name: e.target.value })} />
      </Field>
      <Field label="Middle name">
        <Input value={value.middle_name} onChange={(e) => onChange({ ...value, middle_name: e.target.value })} />
      </Field>
      <Field label="LRN">
        <Input value={value.lrn} maxLength={12} onChange={(e) => onChange({ ...value, lrn: e.target.value })} />
      </Field>
      <Field label="Sex">
        <SimpleSelect
          value={value.sex}
          onValueChange={(v) => onChange({ ...value, sex: v as Sex })}
          options={SEX_OPTIONS}
        />
      </Field>
      <Field label="Birthdate" className="col-span-2" hint="Prints the learner's age on the report card.">
        <Input
          type="date"
          value={value.birthdate ?? ""}
          onChange={(e) => onChange({ ...value, birthdate: e.target.value })}
        />
      </Field>
    </div>
  );
}

export function SectionLearners({
  sectionId,
  learners,
  reload,
  onError,
}: {
  sectionId: number;
  learners: Learner[];
  reload: () => Promise<void>;
  onError: (e: unknown) => void;
}) {
  const [form, setForm] = useState<NewLearner>(EMPTY);
  const [editing, setEditing] = useState<Learner | null>(null);
  const [bulk, setBulk] = useState("");
  // Blank until the teacher picks, so a list is never added under the wrong sex by default.
  const [bulkSex, setBulkSex] = useState<Sex | "">("");
  const [adding, setAdding] = useState(false);
  const [pasting, setPasting] = useState(false);
  // The last learner added, so the teacher sees it worked while adding the next one.
  const [added, setAdded] = useState("");

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await reload();
    } catch (e) {
      onError(e);
    }
  };

  const bulkParsed = bulk
    .split(/\r?\n/)
    .map((line) => parseLearnerLine(line, bulkSex || "M"))
    .filter((l): l is NewLearner => l !== null);

  const groups: [Sex, string][] = [
    ["M", "Male"],
    ["F", "Female"],
  ];
  // Rows in the order shown, so arrow keys and pasted columns run through both groups.
  const shown = groups.flatMap(([sex]) => learners.filter((l) => l.sex === sex));

  // A column pasted from Excel: each line updates the next learner shown; lines that don't fit are skipped.
  const pasteColumn = (from: number, key: "lrn" | "birthdate", texts: string[]) =>
    run(async () => {
      const parse = key === "lrn" ? parseLrn : parseBirthdate;
      for (const [i, text] of texts.entries()) {
        const l = shown[from + i];
        const value = parse(text);
        if (l && value !== null && value !== l[key]) await updateLearner({ ...l, [key]: value });
      }
    });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => {
            setBulk("");
            setBulkSex("");
            setPasting(true);
          }}
        >
          <ClipboardPaste /> Paste class list
        </Button>
        <Button
          onClick={() => {
            setAdded("");
            setAdding(true);
          }}
        >
          <UserPlus /> Add learner
        </Button>
      </div>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 pl-4">#</TableHead>
              <TableHead>Learner</TableHead>
              <TableHead>LRN</TableHead>
              <TableHead>Birthdate</TableHead>
              <TableHead>Age</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map(([sex, label]) => {
              const rows = learners.filter((l) => l.sex === sex);
              return (
                <Fragment key={sex}>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableCell
                      colSpan={6}
                      className="pl-4 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                    >
                      {label} ({rows.length})
                    </TableCell>
                  </TableRow>
                  {rows.map((l, i) => (
                    <TableRow key={l.id} className="group">
                      <TableCell className="pl-4 text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{displayName(l)}</TableCell>
                      <TableCell className="py-0">
                        <SheetCell
                          value={l.lrn}
                          shown={l.lrn}
                          row={shown.indexOf(l)}
                          col={0}
                          label="LRN"
                          placeholder="Type LRN"
                          invalidHint="An LRN is up to 12 digits"
                          className="w-36 font-mono"
                          parse={parseLrn}
                          onCommit={(lrn) => run(() => updateLearner({ ...l, lrn }))}
                          onPasteColumn={(texts) => pasteColumn(shown.indexOf(l), "lrn", texts)}
                        />
                      </TableCell>
                      <TableCell className="py-0">
                        <SheetCell
                          value={l.birthdate}
                          shown={showDate(l.birthdate)}
                          row={shown.indexOf(l)}
                          col={1}
                          label="Birthdate"
                          placeholder="mm/dd/yyyy"
                          invalidHint="Type a date like 09/08/2013"
                          className="w-28 tabular-nums"
                          parse={parseBirthdate}
                          onCommit={(birthdate) => run(() => updateLearner({ ...l, birthdate }))}
                          onPasteColumn={(texts) => pasteColumn(shown.indexOf(l), "birthdate", texts)}
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground tabular-nums">
                        {ageOn(l.birthdate, todayIso()) ?? "—"}
                      </TableCell>
                      <TableCell className="pr-4 text-right opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                        <Button variant="ghost" size="icon-sm" title="Edit" onClick={() => setEditing(l)}>
                          <Pencil />
                        </Button>
                        <ConfirmDelete
                          title={`Remove ${displayName(l)}?`}
                          description="Their scores in every class record of this section are deleted too."
                          confirmLabel="Remove"
                          onConfirm={() => run(() => deleteLearner(l.id))}
                          trigger={
                            <Button variant="ghost" size="icon-sm" title="Remove">
                              <Trash2 />
                            </Button>
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
        {learners.length === 0 && (
          <p className="px-4 pb-8 text-center text-sm text-muted-foreground">
            No learners yet. Add them one at a time or paste a class list.
          </p>
        )}
      </Card>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add learner</DialogTitle>
            <DialogDescription>
              {added ? `Added ${added}. Add the next one, or close when done.` : "Stays open so you can add several."}
            </DialogDescription>
          </DialogHeader>
          <form
            id="add-learner-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.last_name.trim() || !form.first_name.trim()) return;
              run(async () => {
                await addLearners(sectionId, [form]);
                setAdded(displayName(form));
                setForm({ ...EMPTY, sex: form.sex });
              });
            }}
          >
            <LearnerFields value={form} onChange={setForm} />
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdding(false)}>
              Close
            </Button>
            <Button type="submit" form="add-learner-form" disabled={!form.last_name.trim() || !form.first_name.trim()}>
              <UserPlus /> Add learner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pasting} onOpenChange={setPasting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Paste class list</DialogTitle>
            <DialogDescription>
              One learner per line: <code>Last, First, Middle</code>, or cells copied from Excel (
              <code>LRN · Last · First · Middle · Birthdate</code>).
            </DialogDescription>
          </DialogHeader>
          <Textarea
            autoFocus
            className="h-40 font-mono text-xs"
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            placeholder={"Dela Cruz, Juan, Mendoza\nSantos, Maria, Reyes"}
          />
          <DialogFooter className="sm:justify-between">
            <SimpleSelect
              className="w-44"
              value={bulkSex}
              onValueChange={(v) => setBulkSex(v as Sex)}
              placeholder="Male or female?"
              options={[
                { value: "M", label: "All male" },
                { value: "F", label: "All female" },
              ]}
            />
            <Button
              disabled={bulkParsed.length === 0 || !bulkSex}
              onClick={() =>
                run(async () => {
                  await addLearners(sectionId, bulkParsed);
                  setBulk("");
                  setPasting(false);
                })
              }
            >
              Add {bulkParsed.length || ""} learners
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit learner</DialogTitle>
          </DialogHeader>
          {editing && <LearnerFields value={editing} onChange={setEditing} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              disabled={!editing?.last_name.trim() || !editing?.first_name.trim()}
              onClick={() =>
                editing &&
                run(async () => {
                  await updateLearner(editing);
                  setEditing(null);
                })
              }
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
