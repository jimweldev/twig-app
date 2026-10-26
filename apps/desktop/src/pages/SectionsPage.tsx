import { Fragment, useState } from "react";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { useSchool } from "@/app/school";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Field } from "@/components/field";
import { EmptyState, PageHeader } from "@/components/page";
import { GRADE_OPTIONS, SimpleSelect } from "@/components/simple-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createSection,
  deleteSection,
  updateSection,
  type SchoolYear,
  type Section,
  type SectionInput,
} from "@/lib/db";
import { gradeLabel } from "@/ecr/levels";

type Editing = { id: number | null; form: SectionInput };

export function SectionsPage({
  schoolYear,
  sections,
  onOpen,
  onChanged,
  onError,
}: {
  schoolYear: SchoolYear;
  sections: Section[];
  onOpen: (sectionId: number) => void;
  onChanged: () => Promise<void>;
  onError: (e: unknown) => void;
}) {
  const { profile } = useSchool();
  const [editing, setEditing] = useState<Editing | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await onChanged();
      return true;
    } catch (e) {
      onError(e);
      return false;
    }
  };

  const openNew = (grade_level = 7) =>
    setEditing({
      id: null,
      form: { school_year_id: schoolYear.id, grade_level, name: "", adviser: "", is_advisory: false },
    });

  const form = editing?.form;
  const otherAdvisory = sections.find((s) => s.is_advisory && s.id !== editing?.id);
  const duplicate =
    !!form &&
    sections.some(
      (s) =>
        s.id !== editing?.id &&
        s.grade_level === form.grade_level &&
        s.name.toLowerCase() === form.name.trim().toLowerCase(),
    );
  const valid = !!form && form.name.trim() !== "" && !duplicate;

  const save = async () => {
    if (!editing || !valid) return;
    const f = { ...editing.form, name: editing.form.name.trim(), adviser: editing.form.adviser.trim() };
    const ok = await run(() => (editing.id === null ? createSection(f) : updateSection(editing.id, f)));
    if (ok) setEditing(null);
  };

  const grades = [...new Set(sections.map((s) => s.grade_level))];

  return (
    <div className="mx-auto max-w-4xl p-8">
      <PageHeader
        title="Sections"
        description={`SY ${schoolYear.name}${schoolYear.is_active ? " · active" : ""}`}
        actions={
          <Button onClick={() => openNew()}>
            <Plus /> Add section
          </Button>
        }
      />

      <div className="mt-6">
        {sections.length === 0 ? (
          <EmptyState title={`No sections in SY ${schoolYear.name}`}>
            Add the sections you handle, then create a class record for each learning area you teach them.
          </EmptyState>
        ) : (
          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Section</TableHead>
                  <TableHead>Adviser</TableHead>
                  <TableHead>Learners</TableHead>
                  <TableHead>Class records</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {grades.map((g) => (
                  <Fragment key={g}>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableCell colSpan={5} className="pl-4 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        {gradeLabel(g)}
                      </TableCell>
                    </TableRow>
                    {sections
                      .filter((s) => s.grade_level === g)
                      .map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="pl-4 font-medium">
                            <button type="button" className="hover:underline" onClick={() => onOpen(s.id)}>
                              {s.name}
                            </button>
                            {s.is_advisory && <Badge className="ml-2">Advisory</Badge>}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{s.adviser || "—"}</TableCell>
                          <TableCell>{s.learner_count}</TableCell>
                          <TableCell>{s.class_count}</TableCell>
                          <TableCell className="pr-4 text-right">
                            <Button variant="ghost" size="sm" onClick={() => onOpen(s.id)}>
                              <Users /> Learners
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Edit"
                              onClick={() =>
                                setEditing({
                                  id: s.id,
                                  form: {
                                    school_year_id: s.school_year_id,
                                    grade_level: s.grade_level,
                                    name: s.name,
                                    adviser: s.adviser,
                                    is_advisory: s.is_advisory,
                                  },
                                })
                              }
                            >
                              <Pencil />
                            </Button>
                            <ConfirmDelete
                              title={`Delete ${gradeLabel(s.grade_level)} – ${s.name}?`}
                              description={
                                s.class_count > 0
                                  ? `This also deletes its ${s.learner_count} learner(s) and ${s.class_count} class record(s) with all scores. This cannot be undone.`
                                  : `This also deletes its ${s.learner_count} learner(s). It has no class records.`
                              }
                              onConfirm={() => run(() => deleteSection(s.id))}
                              trigger={
                                <Button variant="ghost" size="icon-sm" title="Delete">
                                  <Trash2 />
                                </Button>
                              }
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id === null ? "Add section" : "Edit section"}</DialogTitle>
          </DialogHeader>
          {form && (
            <form
              id="section-form"
              className="grid grid-cols-2 gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <Field label="Grade level">
                <SimpleSelect
                  value={String(form.grade_level)}
                  onValueChange={(v) => setEditing({ ...editing!, form: { ...form, grade_level: Number(v) } })}
                  options={GRADE_OPTIONS}
                  disabled={editing?.id !== null && sections.find((s) => s.id === editing?.id)!.class_count > 0}
                />
              </Field>
              <Field label="Section name" hint={duplicate ? "This grade already has a section with that name." : undefined}>
                <Input
                  value={form.name}
                  autoFocus
                  placeholder="e.g. Sampaguita"
                  aria-invalid={duplicate}
                  onChange={(e) => setEditing({ ...editing!, form: { ...form, name: e.target.value } })}
                />
              </Field>
              <label className="col-span-2 flex items-start justify-between gap-4 rounded-lg border p-3">
                <div>
                  <div className="text-sm font-medium">My advisory class</div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {form.is_advisory && otherAdvisory
                      ? `Replaces ${gradeLabel(otherAdvisory.grade_level)} – ${otherAdvisory.name} as your advisory class.`
                      : "You can import subject teachers' grade files and see the section's consolidated grades. One per school year."}
                  </p>
                </div>
                <Switch
                  checked={form.is_advisory}
                  onCheckedChange={(is_advisory) =>
                    setEditing({
                      ...editing!,
                      form: {
                        ...form,
                        is_advisory,
                        // You advise it, so you're the adviser unless someone else was named.
                        adviser: is_advisory && !form.adviser.trim() ? (profile?.teacher_name ?? "") : form.adviser,
                      },
                    })
                  }
                />
              </label>
              <Field label="Class adviser" className="col-span-2">
                <Input
                  value={form.adviser}
                  placeholder="Optional"
                  onChange={(e) => setEditing({ ...editing!, form: { ...form, adviser: e.target.value } })}
                />
              </Field>
              {editing?.id !== null && sections.find((s) => s.id === editing?.id)!.class_count > 0 && (
                <p className="col-span-2 text-xs text-muted-foreground">
                  Grade level is locked because this section already has class records.
                </p>
              )}
            </form>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" form="section-form" disabled={!valid}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
