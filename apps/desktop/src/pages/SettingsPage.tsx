import { useEffect, useState } from "react";
import { BackupCard } from "@/components/backup-card";
import { Field } from "@/components/field";
import { PageHeader, PageSkeleton } from "@/components/page";
import { ResetCard } from "@/components/reset-card";
import { UpdateCard } from "@/components/update-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SettingsTab } from "@/app/router";
import { getProfile, saveProfile, type SchoolProfile } from "@/lib/db";
import { toast } from "sonner";

type ProfileField = [keyof SchoolProfile, string, string?];

const SECTIONS: { tab: SettingsTab; label: string; title: string; description: string; fields: ProfileField[] }[] = [
  {
    tab: "teacher",
    label: "Teacher",
    title: "You",
    description: "Prepared by on lesson plans; adviser on report cards and certificates.",
    fields: [
      ["teacher_name", "Teacher", "e.g. Juan D. Dela Cruz"],
      ["teacher_position", "Position", "e.g. Teacher III"],
    ],
  },
  {
    tab: "school",
    label: "School",
    title: "School",
    description: "The header of class records, report cards, lesson plans and quizzes.",
    fields: [
      ["school_name", "School name"],
      ["school_acronym", "Acronym (optional)", "e.g. FGNMHS"],
      ["school_id", "School ID"],
      ["address", "School address", "e.g. Citicenter, Pandan, Angeles City"],
      ["district", "District", "Name only, e.g. Angeles City North"],
      ["division", "Division"],
      ["region", "Region", "e.g. Region III, NCR, MIMAROPA"],
    ],
  },
  {
    tab: "signatories",
    label: "Signatories",
    title: "Signatories",
    description: "Filled in on report cards, certificates and new lesson plans.",
    fields: [
      ["school_head", "School head", "Signs report cards; Noted by on lesson plans"],
      ["school_head_position", "School head's position", "e.g. Principal IV"],
      ["checker_name", "Lesson plans checked by", "e.g. your head teacher"],
      ["checker_position", "Checker's position", "e.g. Head Teacher III"],
    ],
  },
];

export function SettingsPage({
  tab: initialTab,
  onSaved,
  onError,
}: {
  tab?: SettingsTab;
  onSaved: () => Promise<void>;
  onError: (e: unknown) => void;
}) {
  const [profile, setProfile] = useState<SchoolProfile | null>(null);
  const [tab, setTab] = useState<SettingsTab>(initialTab ?? "teacher");

  useEffect(() => {
    getProfile().then(setProfile, onError);
  }, [onError]);

  // A link to another tab (e.g. from report cards) while already here.
  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);

  if (!profile) return <PageSkeleton className="page-narrow" rows={3} />;

  // Saves the whole profile, so edits made on other tabs are kept too.
  const save = async () => {
    try {
      await saveProfile(profile);
      await onSaved();
      toast.success("Settings saved");
    } catch (e) {
      onError(e);
    }
  };

  return (
    <div className="page-narrow">
      <PageHeader title="Settings" description="Your details, your school, backups and app updates." />
      <Tabs value={tab} onValueChange={(v) => setTab(v as SettingsTab)} className="mt-6">
        <TabsList>
          {SECTIONS.map((s) => (
            <TabsTrigger key={s.tab} value={s.tab}>
              {s.label}
            </TabsTrigger>
          ))}
          <TabsTrigger value="backup">Backup</TabsTrigger>
          <TabsTrigger value="updates">Updates</TabsTrigger>
          <TabsTrigger value="reset">Reset</TabsTrigger>
        </TabsList>
        {SECTIONS.map((section) => (
          <TabsContent key={section.tab} value={section.tab}>
            <Card className="mt-2">
              <CardHeader>
                <CardTitle>{section.title}</CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                {section.fields.map(([key, label, placeholder]) => (
                  <Field key={key} label={label}>
                    <Input
                      placeholder={placeholder}
                      value={profile[key]}
                      onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}
                    />
                  </Field>
                ))}
              </CardContent>
              <CardFooter>
                <Button onClick={save}>Save</Button>
              </CardFooter>
            </Card>
          </TabsContent>
        ))}
        <TabsContent value="backup" className="[&>*]:mt-2">
          <BackupCard />
        </TabsContent>
        <TabsContent value="updates" className="[&>*]:mt-2">
          <UpdateCard />
        </TabsContent>
        <TabsContent value="reset" className="[&>*]:mt-2">
          <ResetCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
