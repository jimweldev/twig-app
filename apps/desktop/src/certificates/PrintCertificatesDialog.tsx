import { useEffect, useMemo, useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { cn } from "cn";
import { useSchool } from "@/app/school";
import { Field } from "@/components/field";
import { SimpleSelect } from "@/components/simple-select";
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
import { gradeLabel } from "@/ecr/levels";
import { averageIn, useSectionGrades } from "@/ecr/useSectionGrades";
import { listLearners, type CertificateTemplate, type Learner, type Section } from "@/lib/db";
import { displayName } from "@/lib/names";
import { PdfRoot, usePdfDownload } from "@/lib/pdf";
import { CertificateCanvas } from "./CertificateCanvas";
import { GRADE_KEYS, HONOR_BANDS, honorBand, todayIso, type CertContext, type CertLearner } from "./fields";

/** Paper sizes in inches, portrait. Long bond is the 8.5 × 13 in "folio" sold in the Philippines. */
const PAPERS = {
  a4: { label: "A4", w: 8.27, h: 11.69 },
  letter: { label: "Letter (8.5 × 11 in)", w: 8.5, h: 11 },
  long: { label: "Long bond (8.5 × 13 in)", w: 8.5, h: 13 },
};
type Paper = keyof typeof PAPERS;

/** Which grades the average and honor come from. */
const PERIODS = [
  { value: "final", label: "Final grades" },
  { value: "0", label: "Term 1" },
  { value: "1", label: "Term 2" },
  { value: "2", label: "Term 3" },
];

/** Awards typed for a section, kept on this computer so closing the window doesn't lose them. */
const awardsKey = (templateId: number, sectionId: number) => `twig.certificateAwards.${templateId}.${sectionId}`;

function loadAwards(key: string): Record<number, string> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "{}");
    return parsed && typeof parsed === "object" ? (parsed as Record<number, string>) : {};
  } catch {
    return {};
  }
}

/** Page size for the template's orientation, and the largest certificate that fits on it. */
function layout(template: CertificateTemplate, paper: Paper) {
  const { w, h } = PAPERS[paper];
  const landscape = template.width >= template.height;
  const [pageW, pageH] = landscape ? [h, w] : [w, h];
  const certW = Math.min(pageW, (pageH * template.width) / template.height);
  return { pageW, pageH, certW };
}

/** Choose learners and paper, then download a PDF with one certificate per page. */
export function PrintCertificatesDialog({
  template,
  open,
  onOpenChange,
}: {
  template: CertificateTemplate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { sections } = useSchool();
  const [sectionId, setSectionId] = useState(() => (sections.find((s) => s.is_advisory) ?? sections[0])?.id ?? null);
  const section = sections.find((s) => s.id === sectionId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Download certificates</DialogTitle>
          <DialogDescription>One PDF with one certificate per page, ready to print.</DialogDescription>
        </DialogHeader>
        {section ? (
          <PrintBody key={section.id} template={template} section={section} onSectionChange={setSectionId} />
        ) : (
          <p className="text-sm text-muted-foreground">Add a section with learners in the active school year first.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PrintBody({
  template,
  section,
  onSectionChange,
}: {
  template: CertificateTemplate;
  section: Section;
  onSectionChange: (id: number) => void;
}) {
  const { sections, classes, profile, activeYear, onError } = useSchool();
  const [learners, setLearners] = useState<Learner[]>([]);
  const [period, setPeriod] = useState("final");
  const [chosen, setChosen] = useState<Set<number> | null>(null);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [paper, setPaper] = useState<Paper>("a4");
  const [date, setDate] = useState(todayIso);
  const storageKey = awardsKey(template.id, section.id);
  const [awards, setAwards] = useState(() => loadAwards(storageKey));

  useEffect(() => {
    listLearners(section.id).then(setLearners, onError);
  }, [section.id, onError]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(awards));
    } catch {
      // Awards then last only while the window is open.
    }
  }, [storageKey, awards]);

  const has = (key: string) => template.fields.some((f) => f.key === key);
  const forHonors = template.recipients === "honors";
  const needsGrades = forHonors || template.fields.some((f) => GRADE_KEYS.includes(f.key));
  // With an award field, typing an award is what picks the learner.
  const forAwards = has("award");
  const awardOf = (l: Learner) => awards[l.id]?.trim() ?? "";
  const context: CertContext = {
    date,
    schoolYear: activeYear?.name ?? "",
    gradeSection: `${gradeLabel(section.grade_level)} – ${section.name}`,
    adviser: section.adviser || (section.is_advisory ? (profile?.teacher_name ?? "") : ""),
    schoolHead: profile?.school_head ?? "",
  };
  const localClasses = useMemo(() => classes.filter((c) => c.section_id === section.id), [classes, section.id]);
  const { areas: allAreas, loading } = useSectionGrades(section, learners, localClasses, onError);

  // Each learner's average for the chosen period, like the report card's general average.
  const averages = useMemo(() => {
    const areas = allAreas.filter((a) => a.kind !== "missing");
    const p = period === "final" ? "final" : (Number(period) as 0 | 1 | 2);
    // A Senior High subject may not run every term.
    const skipEmpty = section.grade_level >= 11 && p !== "final";
    return new Map(learners.map((l) => [l.id, averageIn(areas, l.id, p, skipEmpty)]));
  }, [allAreas, learners, period, section.grade_level]);
  const certLearner = (l: Learner): CertLearner => ({ ...l, average: averages.get(l.id) ?? null, award: awardOf(l) });
  const hasHonor = (l: Learner) => honorBand(averages.get(l.id) ?? null) !== null;

  const eligible = forHonors ? learners.filter(hasHonor) : learners;
  // Everyone eligible is ticked until the teacher unticks someone, unless they pick by hand.
  const picked = chosen ?? new Set(template.recipients === "pick" ? [] : eligible.map((l) => l.id));
  const toPrint = eligible.filter((l) => (forAwards ? awardOf(l) !== "" : picked.has(l.id)));
  const preview = eligible.find((l) => l.id === previewId) ?? toPrint[0] ?? eligible[0];
  const allPicked = eligible.length > 0 && toPrint.length === eligible.length;
  const toggle = (id: number) => {
    const next = new Set(picked);
    if (!next.delete(id)) next.add(id);
    setChosen(next);
  };
  const { pageW, pageH, certW } = layout(template, paper);

  const pdf = usePdfDownload(onError);

  const withHonors = learners.filter(hasHonor).length;

  return (
    <>
      <div className={cn("grid gap-5", forAwards ? "md:grid-cols-[22rem_1fr]" : "md:grid-cols-[17rem_1fr]")}>
        <div className="flex min-w-0 flex-col gap-3">
          <Field label="Section">
            <SimpleSelect
              value={String(section.id)}
              onValueChange={(v) => onSectionChange(Number(v))}
              options={sections.map((s) => ({
                value: String(s.id),
                label: `${gradeLabel(s.grade_level)} – ${s.name}`,
              }))}
            />
          </Field>
          {needsGrades && (
            <Field label="Grades from" hint={`${withHonors} of ${learners.length} learners have honors (90 and up).`}>
              <SimpleSelect
                value={period}
                onValueChange={(v) => {
                  setPeriod(v);
                  setChosen(null);
                }}
                options={PERIODS}
              />
            </Field>
          )}
          {has("date") && (
            <Field label="Date on the certificate">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value || todayIso())} />
            </Field>
          )}
          <Field label="Paper">
            <SimpleSelect
              value={paper}
              onValueChange={(v) => setPaper(v as Paper)}
              options={Object.entries(PAPERS).map(([value, p]) => ({ value, label: p.label }))}
            />
          </Field>
          <div className="flex min-h-0 flex-col gap-1.5">
            {forAwards ? (
              <div className="text-sm font-medium">
                Awards ({toPrint.length} of {eligible.length})
                <p className="text-xs font-normal text-muted-foreground">Leave a learner blank to skip them.</p>
              </div>
            ) : (
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={allPicked}
                  disabled={eligible.length === 0}
                  onChange={() => setChosen(allPicked ? new Set() : new Set(eligible.map((l) => l.id)))}
                />
                {forHonors ? "Learners with honors" : "Learners"} ({toPrint.length} of {eligible.length})
              </label>
            )}
            <div className="max-h-64 overflow-y-auto rounded-md border">
              {eligible.length === 0 && (
                <p className="p-3 text-sm text-muted-foreground">
                  {learners.length === 0
                    ? "This section has no learners yet."
                    : loading
                      ? "Loading grades…"
                      : "No learner has a general average of 90 or higher for these grades."}
                </p>
              )}
              {eligible.map((l) => {
                const avg = averages.get(l.id) ?? null;
                const band = honorBand(avg);
                return (
                  <div
                    key={l.id}
                    className={cn(
                      "flex items-center gap-2 px-2.5 py-1 text-sm hover:bg-muted/60",
                      preview?.id === l.id && "bg-muted",
                    )}
                  >
                    {!forAwards && (
                      <input
                        type="checkbox"
                        className="size-4 shrink-0 accent-primary"
                        checked={picked.has(l.id)}
                        onChange={() => toggle(l.id)}
                        aria-label={`Print for ${displayName(l)}`}
                      />
                    )}
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate text-left"
                      title={band === null ? "Preview" : `Preview · ${HONOR_BANDS[band].label}`}
                      onClick={() => setPreviewId(l.id)}
                    >
                      {displayName(l)}
                    </button>
                    {needsGrades && (
                      <span
                        className={cn(
                          "shrink-0 text-xs tabular-nums",
                          band === null ? "text-muted-foreground" : "font-semibold text-amber-600",
                        )}
                      >
                        {loading ? "…" : (avg ?? "—")}
                      </span>
                    )}
                    {forAwards && (
                      <Input
                        className="h-7 w-36 shrink-0 text-xs md:text-xs"
                        placeholder="Award"
                        aria-label={`Award for ${displayName(l)}`}
                        value={awards[l.id] ?? ""}
                        onFocus={() => setPreviewId(l.id)}
                        onChange={(e) => setAwards({ ...awards, [l.id]: e.target.value })}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-col items-center justify-center rounded-lg border bg-muted/50 p-4">
          {/* The page as it prints, scaled to fit. */}
          <div
            className="flex max-w-full items-center justify-center bg-white shadow-md"
            style={{
              aspectRatio: `${pageW} / ${pageH}`,
              width: pageW > pageH ? "100%" : "auto",
              height: pageW > pageH ? "auto" : "26rem",
            }}
          >
            {preview && (
              <CertificateCanvas
                template={template}
                learner={certLearner(preview)}
                context={context}
                style={{ width: `${(certW / pageW) * 100}%` }}
              />
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {preview ? displayName(preview) : forHonors ? "No learners with honors" : "No learners"} ·{" "}
            {PAPERS[paper].label}, {pageW > pageH ? "landscape" : "portrait"}
          </p>
          {needsGrades && preview && !loading && averages.get(preview.id) === null && (
            <p className="mt-1 text-xs text-amber-600">
              This learner&rsquo;s grades are incomplete, so the average and honor print blank.
            </p>
          )}
        </div>
      </div>

      <DialogFooter>
        <Button
          disabled={toPrint.length === 0 || pdf.downloading || (needsGrades && loading)}
          onClick={() =>
            pdf.download(`${template.name} - ${gradeLabel(section.grade_level)} ${section.name}`, {
              widthIn: pageW,
              heightIn: pageH,
            })
          }
        >
          {pdf.downloading ? <Loader2 className="animate-spin" /> : <FileDown />} Download PDF (
          {toPrint.length === 1 ? "1 certificate" : `${toPrint.length} certificates`})
        </Button>
      </DialogFooter>

      <PdfRoot
        page={pdf.page}
        pageCss="#print-root .cert-page { break-after: page; } #print-root .cert-page:last-child { break-after: auto; }"
      >
        {toPrint.map((l) => (
          <div
            key={l.id}
            className="cert-page flex items-center justify-center overflow-hidden"
            style={{ width: `${pageW}in`, height: `${pageH}in` }}
          >
            <CertificateCanvas
              template={template}
              learner={certLearner(l)}
              context={context}
              style={{ width: `${certW}in` }}
            />
          </div>
        ))}
      </PdfRoot>
    </>
  );
}
