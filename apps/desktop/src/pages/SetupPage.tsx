import { useState, type FormEvent } from "react";
import { ArrowRight, History } from "lucide-react";
import { useSchool } from "@/app/school";
import { BackupCard } from "@/components/backup-card";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { saveProfile, type SchoolProfile } from "@/lib/db";
import lockup from "@/assets/twig-lockup.svg";

type SetupField = [keyof SchoolProfile, string, string?, boolean?];

/** The details every printout needs; the rest can wait for Settings. */
const FIELDS: SetupField[] = [
  ["teacher_name", "Your name", "e.g. Juan D. Dela Cruz", true],
  ["teacher_position", "Position", "e.g. Teacher III"],
  ["school_name", "School name", undefined, true],
  ["school_id", "School ID"],
  ["division", "Division"],
  ["region", "Region", "e.g. Region III, NCR, MIMAROPA"],
];

/** Your name and school are on every printout, so a new TWIG asks for them before anything else. */
export const needsSetup = (p: SchoolProfile | null) => !!p && (!p.teacher_name.trim() || !p.school_name.trim());

/** First run: set up your profile before the rest of TWIG opens. */
export function SetupPage() {
  const { profile, refresh, onError } = useSchool();
  const [form, setForm] = useState<SchoolProfile>(profile!);
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const ready = !!form.teacher_name.trim() && !!form.school_name.trim();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setSaving(true);
    try {
      await saveProfile({ ...form, teacher_name: form.teacher_name.trim(), school_name: form.school_name.trim() });
      await refresh();
    } catch (err) {
      onError(err);
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-col items-start gap-3">
        <img src={lockup} alt="TWIG" className="h-9" />
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Welcome! Let's set up your profile.</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your name and school go on class records, report cards and lesson plans. You can change them later in
            Settings.
          </p>
        </div>
      </div>

      <form onSubmit={submit}>
        <Card>
          <CardHeader>
            <CardTitle>You and your school</CardTitle>
            <CardDescription>Fields with * are required.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            {FIELDS.map(([key, label, placeholder, required]) => (
              <Field key={key} label={label} required={required}>
                <Input
                  autoFocus={key === "teacher_name"}
                  placeholder={placeholder}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </Field>
            ))}
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit" disabled={!ready || saving}>
              {saving ? "Saving…" : "Start using TWIG"} <ArrowRight />
            </Button>
          </CardFooter>
        </Card>
      </form>

      {restoring ? (
        <BackupCard />
      ) : (
        <Button variant="ghost" className="self-center text-muted-foreground" onClick={() => setRestoring(true)}>
          <History /> Moving from another computer? Restore a backup instead
        </Button>
      )}
    </div>
  );
}
