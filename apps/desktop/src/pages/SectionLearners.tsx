import { Fragment, useState } from "react";
import { Pencil, Trash2, UserPlus } from "lucide-react";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Field } from "@/components/field";
import { SimpleSelect } from "@/components/simple-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { addLearners, deleteLearner, updateLearner, type Learner, type NewLearner, type Sex } from "@/lib/db";
import { ageOn, displayName, parseLearnerLine } from "@/lib/names";
import { todayIso } from "@/attendance/calendar";

const EMPTY: NewLearner = { lrn: "", last_name: "", first_name: "", middle_name: "", sex: "M" };
const SEX_OPTIONS = [
  { value: "M", label: "Male" },
  { value: "F", label: "Female" },
];

/** Shared inputs for adding and editing a learner. */
function LearnerFields<T extends NewLearner>({ value, onChange }: { value: T; onChange: (v: T) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Last name" className="col-span-2">
        <Input value={value.last_name} onChange={(e) => onChange({ ...value, last_name: e.target.value })} />
      </Field>
      <Field label="First name">
        <Input value={value.first_name} onChange={(e) => onChange({ ...value, first_name: e.target.value })} />
      </Field>
      <Field label="Middle name">
        <Input value={value.middle_name} onChange={(e) => onChange({ ...value, middle_name: e.target.value })} />
      </Field>
      <Field label="LRN">
        <Input value={value.lrn} maxLength={12} onChange={(e) => onChange({ ...value, lrn: e.target.value })} />
      </Field>
      <Field label="Sex">
        <SimpleSelect value={value.sex} onValueChange={(v) => onChange({ ...value, sex: v as Sex })} options={SEX_OPTIONS} />
      </Field>
      <Field label="Birthdate" className="col-span-2" hint="Prints the learner's age on the report card.">
        <Input type="date" value={value.birthdate ?? ""} onChange={(e) => onChange({ ...value, birthdate: e.target.value })} />
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
  const [bulkSex, setBulkSex] = useState<Sex>("M");

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
    .map((line) => parseLearnerLine(line, bulkSex))
    .filter((l): l is NewLearner => l !== null);

  const groups: [Sex, string][] = [
    ["M", "Male"],
    ["F", "Female"],
  ];

  return (
    <div className="grid grid-cols-[1fr_22rem] items-start gap-6">
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 pl-4">#</TableHead>
              <TableHead>Learner</TableHead>
              <TableHead>LRN</TableHead>
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
                    <TableCell colSpan={5} className="pl-4 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      {label} ({rows.length})
                    </TableCell>
                  </TableRow>
                  {rows.map((l, i) => (
                    <TableRow key={l.id} className="group">
                      <TableCell className="pl-4 text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{displayName(l)}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{l.lrn}</TableCell>
                      <TableCell className="text-muted-foreground tabular-nums" title={l.birthdate || "No birthdate"}>
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

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Add learner</CardTitle>
          </CardHeader>
          <CardContent>
            <LearnerFields value={form} onChange={setForm} />
            <Button
              className="mt-4"
              disabled={!form.last_name.trim() || !form.first_name.trim()}
              onClick={() =>
                run(async () => {
                  await addLearners(sectionId, [form]);
                  setForm({ ...EMPTY, sex: form.sex });
                })
              }
            >
              <UserPlus /> Add learner
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Paste class list</CardTitle>
            <CardDescription>
              One learner per line: <code>LAST, FIRST, MIDDLE</code>, or cells copied from Excel
              (<code>LRN · Last · First · Middle · Birthdate</code>).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              className="h-32 font-mono text-xs"
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
              placeholder={"DELA CRUZ, Juan, Mendoza\nSANTOS, Maria, Reyes"}
            />
            <div className="mt-3 flex items-center gap-2">
              <SimpleSelect
                className="w-36"
                value={bulkSex}
                onValueChange={(v) => setBulkSex(v as Sex)}
                options={[
                  { value: "M", label: "All male" },
                  { value: "F", label: "All female" },
                ]}
              />
              <Button
                disabled={bulkParsed.length === 0}
                onClick={() =>
                  run(async () => {
                    await addLearners(sectionId, bulkParsed);
                    setBulk("");
                  })
                }
              >
                Add {bulkParsed.length || ""} learners
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

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
