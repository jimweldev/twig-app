import { useEffect, useState } from "react";
import { Field } from "@/components/field";
import { PageHeader } from "@/components/page";
import { UpdateCard } from "@/components/update-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getProfile, saveProfile, type SchoolProfile } from "@/lib/db";

const FIELDS: [keyof SchoolProfile, string][] = [
  ["teacher_name", "Teacher"],
  ["school_head", "School head (signs report cards)"],
  ["school_name", "School name"],
  ["school_id", "School ID"],
  ["district", "District"],
  ["division", "Division"],
  ["region", "Region"],
];

export function ProfilePage({ onSaved, onError }: { onSaved: () => Promise<void>; onError: (e: unknown) => void }) {
  const [profile, setProfile] = useState<SchoolProfile | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getProfile().then(setProfile, onError);
  }, [onError]);

  if (!profile) return null;

  const save = async () => {
    try {
      await saveProfile(profile);
      await onSaved();
      setSaved(true);
    } catch (e) {
      onError(e);
    }
  };

  return (
    <div className="mx-auto max-w-2xl p-8">
      <PageHeader title="School profile" description="Shown on the header of every class record." />
      <Card className="mt-6">
        <CardContent className="grid grid-cols-2 gap-4">
          {FIELDS.map(([key, label]) => (
            <Field key={key} label={label}>
              <Input
                value={profile[key]}
                onChange={(e) => {
                  setSaved(false);
                  setProfile({ ...profile, [key]: e.target.value });
                }}
              />
            </Field>
          ))}
        </CardContent>
        <CardFooter className="gap-3">
          <Button onClick={save}>Save profile</Button>
          {saved && <span className="text-sm text-primary">Saved</span>}
        </CardFooter>
      </Card>
      <UpdateCard />
    </div>
  );
}
