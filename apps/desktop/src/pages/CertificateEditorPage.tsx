import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlignCenter,
  AlignHorizontalJustifyCenter,
  AlignLeft,
  AlignRight,
  Bold,
  CaseUpper,
  Check,
  ImageUp,
  Italic,
  Loader2,
  Plus,
  Printer,
  Trash2,
} from "lucide-react";
import { cn } from "cn";
import { useSchool } from "@/app/school";
import { CertificateCanvas } from "@/certificates/CertificateCanvas";
import {
  DATE_FORMATS,
  defaultField,
  FIELD_KEYS,
  FIELD_LABELS,
  FONT_FAMILIES,
  GRADE_KEYS,
  HONOR_BANDS,
  isRepeatable,
  NAME_FORMATS,
  nextFieldId,
  RECIPIENTS,
  applyKind,
  CERT_KINDS,
  kindInfo,
  SAMPLE_CONTEXT,
  SAMPLE_LEARNER,
  type CertContext,
  type CertField,
  type CertFieldKey,
  type DateFormat,
  type NameFormat,
  type Recipients,
  type CertKind,
} from "@/certificates/fields";
import { readCertificateImage } from "@/certificates/image";
import { PrintCertificatesDialog } from "@/certificates/PrintCertificatesDialog";
import { Field } from "@/components/field";
import { SimpleSelect } from "@/components/simple-select";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getCertificateTemplate,
  replaceCertificateImage,
  updateCertificateTemplate,
  type CertificateTemplate,
} from "@/lib/db";
import { ImagePicker } from "./CertificatesPage";

const SAVE_DELAY_MS = 400;

function Setting({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Toggle({
  on,
  title,
  onClick,
  children,
}: {
  on: boolean;
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button variant={on ? "default" : "outline"} size="icon-sm" title={title} aria-pressed={on} onClick={onClick}>
      {children}
    </Button>
  );
}

/** What each honor band covers, for labelling its text box. */
const bandRange = (i: number) => `${HONOR_BANDS[i].min}–${i === 0 ? 100 : HONOR_BANDS[i - 1].min - 1}`;

/** What each field shows for itself, under its settings. */
const FIELD_HINTS: Partial<Record<CertFieldKey, string>> = {
  award: "Type each learner's award when you print, e.g. “Best in Science”. Learners left blank get no certificate.",
  average: "The general average from the report card, as a whole number. Blank until all grades are in.",
  date: "You choose the date when you print. Today is filled in.",
  school_year: "The active school year.",
  grade_section: "The grade and section you print for.",
  adviser: "The section's adviser.",
  school_head: "The school head from your school profile.",
};

/** Drag the learner's name and other values onto the uploaded design and style them. Changes save as you go. */
export function CertificateEditorPage({ id }: { id: number }) {
  const { profile, activeYear, onError } = useSchool();
  const [template, setTemplate] = useState<CertificateTemplate | null | undefined>(undefined);
  const [selectedId, setSelectedId] = useState<string | null>("name");
  const [saving, setSaving] = useState<"idle" | "pending" | "saved">("idle");
  const [printOpen, setPrintOpen] = useState(false);
  // The made-up learner's average, so the teacher can see each honor's text in place.
  const [sampleAverage, setSampleAverage] = useState(SAMPLE_LEARNER.average);
  const dirty = useRef(false);

  useEffect(() => {
    getCertificateTemplate(id).then(setTemplate, onError);
  }, [id, onError]);

  // Save a moment after the last change, so a drag is one write instead of hundreds.
  useEffect(() => {
    if (!template || !dirty.current) return;
    setSaving("pending");
    const t = setTimeout(() => {
      dirty.current = false;
      updateCertificateTemplate(template.id, { ...template, name: template.name.trim() || "Certificate" }).then(
        () => setSaving("saved"),
        onError,
      );
    }, SAVE_DELAY_MS);
    return () => clearTimeout(t);
  }, [template, onError]);

  const edit = (patch: Partial<CertificateTemplate>) => {
    dirty.current = true;
    setTemplate((t) => (t ? { ...t, ...patch } : t));
  };
  const changeField = (fieldId: string, patch: Partial<CertField>) => {
    dirty.current = true;
    setTemplate((t) => (t ? { ...t, fields: t.fields.map((f) => (f.id === fieldId ? { ...f, ...patch } : f)) } : t));
  };

  // Arrow keys nudge the selected field; Shift moves it further.
  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (tag === "input" || tag === "textarea" || document.querySelector("[role=dialog]")) return;
      const step = e.shiftKey ? 2 : 0.25;
      const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (!d) return;
      e.preventDefault();
      dirty.current = true;
      setTemplate((t) =>
        t
          ? {
              ...t,
              fields: t.fields.map((f) =>
                f.id === selectedId
                  ? {
                      ...f,
                      xPct: Math.min(100 - f.widthPct, Math.max(0, f.xPct + d[0])),
                      yPct: Math.min(100, Math.max(0, f.yPct + d[1])),
                    }
                  : f,
              ),
            }
          : t,
      );
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  const replaceImage = async (file: File) => {
    if (!template) return;
    try {
      const img = await readCertificateImage(file);
      await replaceCertificateImage(template.id, img);
      setTemplate({ ...template, ...img });
    } catch (e) {
      onError(e);
    }
  };

  if (template === undefined) return null;
  if (template === null) {
    return <p className="p-8 text-sm text-muted-foreground">This template was deleted.</p>;
  }

  const field = template.fields.find((f) => f.id === selectedId) ?? template.fields[0];
  const set = (patch: Partial<CertField>) => field && changeField(field.id, patch);
  const addField = (key: CertFieldKey) => {
    const fieldId = nextFieldId(template.fields, key);
    // An honor on an everyone-gets-one template would print blank for most learners.
    const recipients = key === "honor" && template.recipients === "all" ? "honors" : template.recipients;
    edit({ fields: [...template.fields, defaultField(key, fieldId)], recipients });
    setSelectedId(fieldId);
  };
  const removeField = (id: string) => {
    edit({ fields: template.fields.filter((f) => f.id !== id) });
    setSelectedId("name");
  };
  const addable = FIELD_KEYS.filter((k) => isRepeatable(k) || !template.fields.some((f) => f.key === k));
  const usesGrades = template.fields.some((f) => GRADE_KEYS.includes(f.key)) || template.recipients === "honors";
  // The teacher's own details where known, so the preview looks like their certificate.
  const context: CertContext = {
    ...SAMPLE_CONTEXT,
    schoolYear: activeYear?.name ?? SAMPLE_CONTEXT.schoolYear,
    adviser: profile?.teacher_name || SAMPLE_CONTEXT.adviser,
    schoolHead: profile?.school_head || SAMPLE_CONTEXT.schoolHead,
  };
  const fieldLabel = (f: CertField) => (f.key === "text" ? f.text.trim() || FIELD_LABELS.text : FIELD_LABELS[f.key]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          aria-label="Template name"
          className="h-9 max-w-sm text-lg font-semibold"
          value={template.name}
          onChange={(e) => edit({ name: e.target.value })}
        />
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          {saving === "pending" && (
            <>
              <Loader2 className="size-3.5 animate-spin" /> Saving…
            </>
          )}
          {saving === "saved" && (
            <>
              <Check className="size-3.5" /> Saved
            </>
          )}
        </span>
        <div className="ml-auto flex gap-2">
          <ImagePicker variant="outline" onFile={replaceImage}>
            <ImageUp /> Replace image
          </ImagePicker>
          <Button onClick={() => setPrintOpen(true)}>
            <Printer /> Print
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_18rem]">
        <Card className="items-center bg-muted/40 p-6">
          <CertificateCanvas
            template={template}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onChange={changeField}
            learner={{ ...SAMPLE_LEARNER, average: sampleAverage }}
            context={context}
            className="w-full max-w-4xl shadow-md"
          />
          <div className="flex w-full max-w-4xl flex-wrap items-center justify-between gap-3">
            <p className="max-w-xl text-xs text-muted-foreground">
              Drag a box to move it, and its side handles to resize it. Arrow keys nudge it (Shift for bigger steps).
              Long text shrinks to fit its box.
            </p>
            {usesGrades && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                Preview with average
                <Input
                  type="number"
                  min={60}
                  max={100}
                  className="h-7 w-20"
                  value={sampleAverage ?? ""}
                  onChange={(e) => setSampleAverage(e.target.value === "" ? null : Number(e.target.value))}
                />
              </label>
            )}
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="gap-3 p-4">
            <Field label="Type" hint={kindInfo(template.kind).hint}>
              <SimpleSelect
                value={template.kind}
                onValueChange={(v) => {
                  const kind = v as CertKind;
                  // Adds the fields the type needs; fields already placed stay.
                  edit({ kind, ...applyKind(template.fields, kind) });
                }}
                options={CERT_KINDS.map((k) => ({ value: k.value, label: k.label }))}
              />
            </Field>
            <Field label="Who gets one" hint={RECIPIENTS.find((r) => r.value === template.recipients)?.hint}>
              <SimpleSelect
                value={template.recipients}
                onValueChange={(v) => edit({ recipients: v as Recipients })}
                options={RECIPIENTS}
              />
            </Field>
          </Card>

          <Card className="gap-2 p-4">
            <div className="text-sm font-semibold">Fields</div>
            {template.fields.map((f) => (
              <button
                key={f.id}
                type="button"
                className={cn(
                  "truncate rounded-md border px-3 py-1.5 text-left text-sm hover:bg-muted",
                  field?.id === f.id && "border-sky-500 bg-sky-500/10",
                )}
                onClick={() => setSelectedId(f.id)}
              >
                {fieldLabel(f)}
              </button>
            ))}
            <div className="flex items-center gap-2">
              <Plus className="size-4 shrink-0 text-muted-foreground" />
              <SimpleSelect
                value=""
                placeholder="Add a field…"
                onValueChange={(v) => addField(v as CertFieldKey)}
                options={addable.map((k) => ({ value: k, label: FIELD_LABELS[k] }))}
              />
            </div>
          </Card>

          {field && (
            <Card className="gap-4 p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">{FIELD_LABELS[field.key]}</div>
                {field.key !== "name" && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title="Remove from the certificate"
                    onClick={() => removeField(field.id)}
                  >
                    <Trash2 />
                  </Button>
                )}
              </div>
              {field.key === "name" && (
                <Field label="Name order">
                  <SimpleSelect
                    value={field.nameFormat}
                    onValueChange={(v) => set({ nameFormat: v as NameFormat })}
                    options={NAME_FORMATS}
                  />
                </Field>
              )}
              {field.key === "honor" && (
                <Setting label="Text for each general average">
                  {HONOR_BANDS.map((b, i) => (
                    <div key={b.min} className="flex items-center gap-2">
                      <span className="w-14 shrink-0 text-xs text-muted-foreground tabular-nums">{bandRange(i)}</span>
                      <Input
                        aria-label={`Text for ${bandRange(i)}`}
                        className="h-8"
                        value={field.honorLabels[i] ?? ""}
                        placeholder={b.label}
                        onChange={(e) =>
                          set({
                            honorLabels: HONOR_BANDS.map((x, j) =>
                              j === i ? e.target.value : (field.honorLabels[j] ?? x.label),
                            ),
                          })
                        }
                      />
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">
                    Blank for learners below 90. Set “Who gets one” to learners with honors to skip them.
                  </p>
                </Setting>
              )}
              {field.key === "text" && (
                <Field label="Text">
                  <Input value={field.text} onChange={(e) => set({ text: e.target.value })} />
                </Field>
              )}
              {field.key === "date" && (
                <Field label="Date format">
                  <SimpleSelect
                    value={field.dateFormat}
                    onValueChange={(v) => set({ dateFormat: v as DateFormat })}
                    options={DATE_FORMATS}
                  />
                </Field>
              )}
              {FIELD_HINTS[field.key] && <p className="text-xs text-muted-foreground">{FIELD_HINTS[field.key]}</p>}
              <Field label="Font">
                <SimpleSelect
                  value={field.font}
                  onValueChange={(font) => set({ font })}
                  options={FONT_FAMILIES.map((f) => ({ value: f.value, label: f.label }))}
                />
              </Field>
              <Setting label={`Size (${field.sizePct.toFixed(1)}% of page height)`}>
                <input
                  type="range"
                  min={2}
                  max={20}
                  step={0.25}
                  value={field.sizePct}
                  className="accent-primary"
                  onChange={(e) => set({ sizePct: Number(e.target.value) })}
                />
              </Setting>
              <Setting label="Style">
                <div className="flex flex-wrap gap-1">
                  <Toggle on={field.bold} title="Bold" onClick={() => set({ bold: !field.bold })}>
                    <Bold />
                  </Toggle>
                  <Toggle on={field.italic} title="Italic" onClick={() => set({ italic: !field.italic })}>
                    <Italic />
                  </Toggle>
                  <Toggle
                    on={field.uppercase}
                    title="All capitals"
                    onClick={() => set({ uppercase: !field.uppercase })}
                  >
                    <CaseUpper />
                  </Toggle>
                  <span className="mx-1 w-px self-stretch bg-border" />
                  {(
                    [
                      ["left", AlignLeft],
                      ["center", AlignCenter],
                      ["right", AlignRight],
                    ] as const
                  ).map(([align, Icon]) => (
                    <Toggle
                      key={align}
                      on={field.align === align}
                      title={`Align ${align}`}
                      onClick={() => set({ align })}
                    >
                      <Icon />
                    </Toggle>
                  ))}
                </div>
              </Setting>
              <Setting label="Color">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label="Text color"
                    value={field.color}
                    className="h-8 w-10 cursor-pointer rounded border bg-transparent p-0.5"
                    onChange={(e) => set({ color: e.target.value })}
                  />
                  <span className="font-mono text-xs text-muted-foreground uppercase">{field.color}</span>
                </div>
              </Setting>
              <Setting label={`Box width (${Math.round(field.widthPct)}% of page width)`}>
                <input
                  type="range"
                  min={5}
                  max={100}
                  step={1}
                  value={field.widthPct}
                  className="accent-primary"
                  onChange={(e) => {
                    const widthPct = Number(e.target.value);
                    set({ widthPct, xPct: Math.min(field.xPct, 100 - widthPct) });
                  }}
                />
              </Setting>
              <Button variant="outline" onClick={() => set({ xPct: (100 - field.widthPct) / 2 })}>
                <AlignHorizontalJustifyCenter /> Center on the page
              </Button>
            </Card>
          )}
        </div>
      </div>

      {printOpen && <PrintCertificatesDialog template={template} open onOpenChange={setPrintOpen} />}
    </div>
  );
}
