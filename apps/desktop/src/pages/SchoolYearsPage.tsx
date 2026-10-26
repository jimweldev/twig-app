import { useState } from "react";
import { CheckCircle2, Pencil, Plus, Trash2 } from "lucide-react";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Field } from "@/components/field";
import { EmptyState, PageHeader } from "@/components/page";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createSchoolYear,
  deleteSchoolYear,
  setActiveSchoolYear,
  updateSchoolYear,
  type SchoolYear,
  type SchoolYearInput,
} from "@/lib/db";
import { isValidSchoolYear, suggestSchoolYear } from "@/lib/names";

type Editing = { id: number | null; form: SchoolYearInput };

const formatDate = (d: string) =>
  d ? new Date(`${d}T00:00`).toLocaleDateString("en-PH", { dateStyle: "medium" }) : "—";

export function SchoolYearsPage({
  schoolYears,
  onChanged,
  onError,
}: {
  schoolYears: SchoolYear[];
  onChanged: () => Promise<void>;
  onError: (e: unknown) => void;
}) {
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

  const openNew = () =>
    setEditing({
      id: null,
      form: { name: suggestSchoolYear(schoolYears.map((y) => y.name)), start_date: "", end_date: "" },
    });

  const save = async () => {
    if (!editing) return;
    const form = { ...editing.form, name: editing.form.name.trim() };
    const ok = await run(() =>
      editing.id === null ? createSchoolYear(form) : updateSchoolYear(editing.id, form),
    );
    if (ok) setEditing(null);
  };

  const form = editing?.form;
  const duplicate =
    !!form && schoolYears.some((y) => y.name === form.name.trim() && y.id !== editing?.id);
  const datesValid = !form?.start_date || !form?.end_date || form.start_date < form.end_date;
  const valid = !!form && isValidSchoolYear(form.name) && !duplicate && datesValid;

  return (
    <div className="mx-auto max-w-4xl p-8">
      <PageHeader
        title="School years"
        description="Only one school year is active at a time. Sections, learners and class records across TWIG show the active year; switch it here to open a past year."
        actions={
          <Button onClick={openNew}>
            <Plus /> Add school year
          </Button>
        }
      />

      <div className="mt-6">
        {schoolYears.length === 0 ? (
          <EmptyState title="No school years yet">
            Add the current school year to start creating sections and class records.
          </EmptyState>
        ) : (
          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">School year</TableHead>
                  <TableHead>Opening</TableHead>
                  <TableHead>Closing</TableHead>
                  <TableHead>Sections</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {schoolYears.map((y) => (
                  <TableRow key={y.id}>
                    <TableCell className="pl-4 font-medium">SY {y.name}</TableCell>
                    <TableCell>{formatDate(y.start_date)}</TableCell>
                    <TableCell>{formatDate(y.end_date)}</TableCell>
                    <TableCell>{y.section_count}</TableCell>
                    <TableCell>
                      {y.is_active ? (
                        <Badge>
                          <CheckCircle2 /> Active
                        </Badge>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => run(() => setActiveSchoolYear(y.id))}>
                          Set as active
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Edit"
                        onClick={() =>
                          setEditing({
                            id: y.id,
                            form: { name: y.name, start_date: y.start_date, end_date: y.end_date },
                          })
                        }
                      >
                        <Pencil />
                      </Button>
                      <ConfirmDelete
                        title={`Delete SY ${y.name}?`}
                        description={
                          y.section_count > 0
                            ? `This also deletes its ${y.section_count} section(s) and every class record, learner and score in them. This cannot be undone.`
                            : "This school year has no sections."
                        }
                        onConfirm={() => run(() => deleteSchoolYear(y.id))}
                        trigger={
                          <Button variant="ghost" size="icon-sm" title="Delete">
                            <Trash2 />
                          </Button>
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id === null ? "Add school year" : "Edit school year"}</DialogTitle>
            <DialogDescription>Dates are optional and only used for reference.</DialogDescription>
          </DialogHeader>
          {form && (
            <form
              id="school-year-form"
              className="grid grid-cols-2 gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (valid) save();
              }}
            >
              <Field
                label="School year"
                className="col-span-2"
                hint={
                  duplicate
                    ? "This school year already exists."
                    : !isValidSchoolYear(form.name)
                      ? "Use the format 2026-2027."
                      : undefined
                }
              >
                <Input
                  value={form.name}
                  autoFocus
                  aria-invalid={!isValidSchoolYear(form.name) || duplicate}
                  onChange={(e) => setEditing({ ...editing!, form: { ...form, name: e.target.value } })}
                />
              </Field>
              <Field label="Opening of classes">
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setEditing({ ...editing!, form: { ...form, start_date: e.target.value } })}
                />
              </Field>
              <Field label="End of school year" hint={datesValid ? undefined : "Must be after the opening."}>
                <Input
                  type="date"
                  value={form.end_date}
                  aria-invalid={!datesValid}
                  onChange={(e) => setEditing({ ...editing!, form: { ...form, end_date: e.target.value } })}
                />
              </Field>
            </form>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" form="school-year-form" disabled={!valid}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
