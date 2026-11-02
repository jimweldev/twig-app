import { useCallback, useEffect, useState } from "react";
import { FileDown, ImageUp, Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "cn";
import { useRouter } from "@/app/router";
import { useSchool } from "@/app/school";
import { CertificateCanvas } from "@/certificates/CertificateCanvas";
import { applyKind, CERT_KINDS, kindInfo, type CertKind } from "@/certificates/fields";
import { CertificateImagePicker } from "@/certificates/CertificateImagePicker";
import { templateNameFromFile } from "@/certificates/image";
import { PrintCertificatesDialog } from "@/certificates/PrintCertificatesDialog";
import { ConfirmDelete } from "@/components/confirm-delete";
import { CardGridSkeleton, EmptyState, PageHeader } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import {
  createCertificateTemplate,
  deleteCertificateTemplate,
  listCertificateTemplates,
  type CertificateImage,
  type CertificateTemplate,
} from "@/lib/db";

/** Starts a template: pick what it's for, then its design image. */
function NewTemplateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { navigate } = useRouter();
  const [kind, setKind] = useState<CertKind>("honors");

  const create = async (img: CertificateImage, file: File) => {
    const id = await createCertificateTemplate(templateNameFromFile(file), img, { ...applyKind([], kind), kind });
    navigate({ page: "certificate", id });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New certificate template</DialogTitle>
          <DialogDescription>Pick what it&rsquo;s for. You can change it later in the editor.</DialogDescription>
        </DialogHeader>
        <div role="radiogroup" className="grid gap-2">
          {CERT_KINDS.map((k) => (
            <button
              key={k.value}
              type="button"
              role="radio"
              aria-checked={kind === k.value}
              className={cn(
                "rounded-lg border px-3 py-2 text-left hover:bg-muted/60",
                kind === k.value && "border-primary bg-primary/5 ring-1 ring-primary",
              )}
              onClick={() => setKind(k.value)}
            >
              <p className="text-sm font-medium">{k.label}</p>
              <p className="text-xs text-muted-foreground">{k.hint}</p>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Then choose the design: a PNG or JPG made in Canva, Word or PowerPoint, with the name left blank.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <CertificateImagePicker onImage={create}>
            <ImageUp /> Choose design image…
          </CertificateImagePicker>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CertificatesPage() {
  const { navigate } = useRouter();
  const { onError } = useSchool();
  const [templates, setTemplates] = useState<CertificateTemplate[] | null>(null);
  const [printing, setPrinting] = useState<CertificateTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<CertKind | "all">("all");

  const reload = useCallback(() => listCertificateTemplates().then(setTemplates, onError), [onError]);
  useEffect(() => {
    reload();
  }, [reload]);

  // Only types that have templates are worth filtering by.
  const kinds = CERT_KINDS.filter((k) => templates?.some((t) => t.kind === k.value));
  const shown = templates?.filter((t) => filter === "all" || t.kind === filter);

  return (
    <div className="page">
      <PageHeader
        title="Certificates"
        description="Upload your certificate design, place the learner's name, award, grades, date and other details on it, and print one for each learner."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus /> New template
          </Button>
        }
      />

      {kinds.length > 1 && (
        <div className="mt-6 flex flex-wrap gap-1.5">
          {[{ value: "all" as const, label: "All" }, ...kinds].map((k) => (
            <Button
              key={k.value}
              size="sm"
              variant={filter === k.value ? "default" : "outline"}
              onClick={() => setFilter(k.value)}
            >
              {k.label}
              <span className="tabular-nums opacity-70">
                {k.value === "all" ? templates?.length : templates?.filter((t) => t.kind === k.value).length}
              </span>
            </Button>
          ))}
        </div>
      )}

      {templates === null && (
        <div className="mt-6">
          <CardGridSkeleton count={3} />
        </div>
      )}

      {templates && templates.length === 0 && (
        <div className="mt-6">
          <EmptyState title="No certificate templates yet">
            <p>
              Make the certificate in Canva, Word or PowerPoint with the name left blank, save it as a PNG or JPG, then
              upload it here.
            </p>
            <div className="mt-4 flex justify-center">
              <Button onClick={() => setCreating(true)}>
                <Plus /> New template
              </Button>
            </div>
          </EmptyState>
        </div>
      )}

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {shown?.map((t) => (
          <Card key={t.id} className="gap-3 overflow-hidden pt-0">
            <button
              type="button"
              className="block border-b bg-muted/50"
              title="Edit template"
              onClick={() => navigate({ page: "certificate", id: t.id })}
            >
              <CertificateCanvas template={t} className="w-full" />
            </button>
            <CardContent className="flex items-center gap-1">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium" title={t.name}>
                  {t.name}
                </p>
                <Badge variant="secondary" className="mt-0.5 font-normal">
                  {kindInfo(t.kind).label}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                title="Edit"
                onClick={() => navigate({ page: "certificate", id: t.id })}
              >
                <Pencil />
              </Button>
              <Button variant="ghost" size="icon-sm" title="Download PDF" onClick={() => setPrinting(t)}>
                <FileDown />
              </Button>
              <ConfirmDelete
                title={`Delete “${t.name}”?`}
                description="This removes the template and its field placements. Certificates you already printed are not affected."
                onConfirm={() => deleteCertificateTemplate(t.id).then(reload, onError)}
                trigger={
                  <Button variant="ghost" size="icon-sm" title="Delete">
                    <Trash2 />
                  </Button>
                }
              />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Mounted only while open, so each opening starts on the first type. */}
      {creating && <NewTemplateDialog open onOpenChange={setCreating} />}

      {printing && (
        <PrintCertificatesDialog template={printing} open onOpenChange={(open) => !open && setPrinting(null)} />
      )}
    </div>
  );
}
