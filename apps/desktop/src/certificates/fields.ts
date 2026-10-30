import type { Learner } from "@/lib/db";

/** Values placed on the design: per learner, per class, or typed once on the template. */
export type CertFieldKey =
  | "name"
  | "award"
  | "average"
  | "honor"
  | "date"
  | "school_year"
  | "grade_section"
  | "adviser"
  | "school_head"
  | "text";

export const FIELD_LABELS: Record<CertFieldKey, string> = {
  name: "Learner's name",
  award: "Award",
  average: "General average",
  honor: "Honor",
  date: "Date",
  school_year: "School year",
  grade_section: "Grade and section",
  adviser: "Adviser",
  school_head: "School head",
  text: "Custom text",
};

export const FIELD_KEYS = Object.keys(FIELD_LABELS) as CertFieldKey[];

/** Fields that read the learner's grades. */
export const GRADE_KEYS: CertFieldKey[] = ["average", "honor"];

/** Custom text can be placed many times; every other field once. */
export const isRepeatable = (key: CertFieldKey) => key === "text";

/** Who a template prints for. */
export type Recipients = "all" | "honors" | "pick";

export const RECIPIENTS: { value: Recipients; label: string; hint: string }[] = [
  { value: "all", label: "Every learner", hint: "All learners in the section are ticked." },
  { value: "honors", label: "Learners with honors", hint: "Only learners with a general average of 90 or higher." },
  { value: "pick", label: "Learners I pick", hint: "Nobody is ticked until you tick them." },
];

/** What a template is for; picking one sets who gets it and the fields it needs. */
export type CertKind = "honors" | "award" | "recognition" | "custom";

export const CERT_KINDS: {
  value: CertKind;
  label: string;
  hint: string;
  recipients: Recipients;
  fields: CertFieldKey[];
}[] = [
  {
    value: "honors",
    label: "Academic honors",
    hint: "With Honors, High Honors or Highest Honors, from the general average",
    recipients: "honors",
    fields: ["name", "honor", "average"],
  },
  {
    value: "award",
    label: "Award",
    hint: "Best in Math, Leadership, Perfect Attendance… typed per learner when printing",
    recipients: "all",
    fields: ["name", "award"],
  },
  {
    value: "recognition",
    label: "Recognition",
    hint: "Participation, completion or moving up, for every learner",
    recipients: "all",
    fields: ["name", "text"],
  },
  {
    value: "custom",
    label: "Custom",
    hint: "Choose the fields and who gets one yourself",
    recipients: "all",
    fields: ["name"],
  },
];

export const kindInfo = (kind: CertKind) => CERT_KINDS.find((k) => k.value === kind) ?? CERT_KINDS[3];

/**
 * A template switched to `kind`: its recipients, and its fields plus any the type
 * needs. Fields already placed are never removed.
 */
export function applyKind(fields: CertField[], kind: CertKind): { fields: CertField[]; recipients: Recipients } {
  const info = kindInfo(kind);
  const missing = info.fields.filter((key) => !fields.some((f) => f.key === key));
  return { fields: [...fields, ...missing.map((key) => defaultField(key))], recipients: info.recipients };
}

export type DateFormat = "long" | "ordinal" | "numeric";

export const DATE_FORMATS: { value: DateFormat; label: string }[] = [
  { value: "long", label: "October 27, 2026" },
  { value: "ordinal", label: "27th day of October 2026" },
  { value: "numeric", label: "10/27/2026" },
];

export type NameFormat = "first_mi_last" | "first_middle_last" | "first_last" | "last_first_mi";

export const NAME_FORMATS: { value: NameFormat; label: string }[] = [
  { value: "first_mi_last", label: "Juan M. Dela Cruz" },
  { value: "first_middle_last", label: "Juan Miguel Dela Cruz" },
  { value: "first_last", label: "Juan Dela Cruz" },
  { value: "last_first_mi", label: "Dela Cruz, Juan M." },
];

/** Academic excellence award bands (DepEd Order 36, s. 2016), highest first. */
export const HONOR_BANDS = [
  { min: 98, label: "With Highest Honors" },
  { min: 95, label: "With High Honors" },
  { min: 90, label: "With Honors" },
] as const;

/** The honor for a general average, as an index into HONOR_BANDS; null below 90 or with no average. */
export function honorBand(average: number | null): number | null {
  if (average === null) return null;
  const i = HONOR_BANDS.findIndex((b) => average >= b.min);
  return i === -1 ? null : i;
}

/**
 * A value placed on the certificate. Positions are percentages of the page so the
 * designer, the thumbnails and the printed page all share them.
 */
export interface CertField {
  id: string;
  key: CertFieldKey;
  /** Left edge of the text box, % of page width. */
  xPct: number;
  /** Vertical center of the line, % of page height. */
  yPct: number;
  /** Box width, % of page width. Longer text shrinks to fit it. */
  widthPct: number;
  /** Font size, % of page height. */
  sizePct: number;
  /** CSS font-family stack (see FONT_FAMILIES). */
  font: string;
  bold: boolean;
  italic: boolean;
  uppercase: boolean;
  color: string;
  align: "left" | "center" | "right";
  /** Name fields only. */
  nameFormat: NameFormat;
  /** Honor fields only: the text for each band in HONOR_BANDS, so a school can word them its own way. */
  honorLabels: string[];
  /** Custom text fields only: the words printed on every certificate. */
  text: string;
  /** Date fields only. */
  dateFormat: DateFormat;
}

/** Fonts that ship with Windows, so what the teacher sees is what prints. The first is the default. */
export const FONT_FAMILIES = [
  { label: "Times New Roman", value: '"Times New Roman", Times, serif' },
  { label: "Georgia", value: 'Georgia, "Times New Roman", serif' },
  { label: "Palatino", value: '"Palatino Linotype", "Book Antiqua", Palatino, serif' },
  { label: "Old English", value: '"Old English Text MT", "UnifrakturMaguntia", serif' },
  { label: "Script", value: '"Segoe Script", "Brush Script MT", cursive' },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
];

/** Where a new field lands: the name in the middle, the others around it. */
const PLACEMENT: Record<CertFieldKey, Pick<CertField, "xPct" | "yPct" | "widthPct" | "sizePct" | "bold">> = {
  name: { xPct: 15, yPct: 45, widthPct: 70, sizePct: 7, bold: true },
  award: { xPct: 20, yPct: 58, widthPct: 60, sizePct: 5, bold: true },
  honor: { xPct: 25, yPct: 58, widthPct: 50, sizePct: 4.5, bold: true },
  average: { xPct: 40, yPct: 68, widthPct: 20, sizePct: 4, bold: true },
  text: { xPct: 20, yPct: 30, widthPct: 60, sizePct: 3.5, bold: false },
  date: { xPct: 30, yPct: 76, widthPct: 40, sizePct: 3, bold: false },
  school_year: { xPct: 35, yPct: 36, widthPct: 30, sizePct: 3, bold: false },
  grade_section: { xPct: 30, yPct: 64, widthPct: 40, sizePct: 3, bold: false },
  adviser: { xPct: 10, yPct: 86, widthPct: 35, sizePct: 3, bold: true },
  school_head: { xPct: 55, yPct: 86, widthPct: 35, sizePct: 3, bold: true },
};

/** A new field. Repeatable fields need an `id` that no other field on the template uses. */
export function defaultField(key: CertFieldKey, id: string = key): CertField {
  return {
    id,
    key,
    ...PLACEMENT[key],
    font: FONT_FAMILIES[0].value,
    italic: false,
    uppercase: false,
    color: "#1f2937",
    align: "center",
    nameFormat: "first_mi_last",
    honorLabels: HONOR_BANDS.map((b) => b.label),
    text: key === "text" ? "Certificate of Recognition" : "",
    dateFormat: "long",
  };
}

/** An id for another copy of a repeatable field, e.g. "text-2". */
export function nextFieldId(fields: Pick<CertField, "id">[], key: CertFieldKey): string {
  const ids = new Set(fields.map((f) => f.id));
  if (!ids.has(key)) return key;
  let n = 2;
  while (ids.has(`${key}-${n}`)) n++;
  return `${key}-${n}`;
}

/** Parses the stored JSON, filling in anything an older template is missing. */
export function parseFields(json: string): CertField[] {
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((f): f is Partial<CertField> & { key: CertFieldKey } => FIELD_KEYS.includes(f?.key))
      .map((f) => ({ ...defaultField(f.key), ...f }));
  } catch {
    return [];
  }
}

/**
 * What a certificate shows for one learner. `average` is null when their grades are incomplete;
 * `award` is what the teacher typed for them when printing.
 */
export type CertLearner = Pick<Learner, "first_name" | "middle_name" | "last_name"> & {
  average: number | null;
  award?: string;
};

/** Values shared by every certificate in one print run. */
export interface CertContext {
  /** ISO date, e.g. "2026-10-27". */
  date: string;
  schoolYear: string;
  gradeSection: string;
  adviser: string;
  schoolHead: string;
}

/** A made-up learner shown while designing. */
export const SAMPLE_LEARNER: CertLearner = {
  first_name: "Juan Miguel",
  middle_name: "Pascual",
  last_name: "Dela Cruz",
  average: 96,
  award: "Best in Science",
};

/** Today as an ISO date in local time. */
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const SAMPLE_CONTEXT: CertContext = {
  date: todayIso(),
  schoolYear: "2026–2027",
  gradeSection: "Grade 7 – Rizal",
  adviser: "Maria L. Santos",
  schoolHead: "Roberto C. Reyes",
};

const ordinal = (n: number) => {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${suffix}`;
};

export function formatDate(iso: string, format: DateFormat): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";
  const month = new Date(y, m - 1, d).toLocaleString("en-US", { month: "long" });
  switch (format) {
    case "long":
      return `${month} ${d}, ${y}`;
    case "ordinal":
      return `${ordinal(d)} day of ${month} ${y}`;
    case "numeric":
      return `${m}/${d}/${y}`;
  }
}

export function formatName(l: Pick<Learner, "first_name" | "middle_name" | "last_name">, format: NameFormat): string {
  const first = l.first_name.trim();
  const middle = l.middle_name.trim();
  const last = l.last_name.trim();
  const mi = middle ? `${middle[0].toUpperCase()}.` : "";
  const join = (...parts: string[]) => parts.filter(Boolean).join(" ");
  switch (format) {
    case "first_middle_last":
      return join(first, middle, last);
    case "first_last":
      return join(first, last);
    case "last_first_mi":
      return `${last}, ${join(first, mi)}`;
    case "first_mi_last":
      return join(first, mi, last);
  }
}

function rawText(field: CertField, learner: CertLearner, ctx: CertContext): string {
  switch (field.key) {
    case "name":
      return formatName(learner, field.nameFormat);
    case "award":
      return learner.award?.trim() ?? "";
    case "average":
      return learner.average === null ? "" : String(learner.average);
    case "honor": {
      const band = honorBand(learner.average);
      return band === null ? "" : (field.honorLabels[band] ?? HONOR_BANDS[band].label);
    }
    case "date":
      return formatDate(ctx.date, field.dateFormat);
    case "school_year":
      return ctx.schoolYear;
    case "grade_section":
      return ctx.gradeSection;
    case "adviser":
      return ctx.adviser;
    case "school_head":
      return ctx.schoolHead;
    case "text":
      return field.text;
  }
}

/** The text a field shows for a learner; empty when there is nothing to show (e.g. no honor). */
export function fieldText(field: CertField, learner: CertLearner, ctx: CertContext = SAMPLE_CONTEXT): string {
  const text = rawText(field, learner, ctx);
  return field.uppercase ? text.toUpperCase() : text;
}

/** Share of the box a shrunk name may fill, leaving room for font rendering differences. */
const FIT_MARGIN = 0.98;

/**
 * The font size (% of page height) that keeps the text on one line inside its box.
 * `emWidth` is the text's width divided by its font size; `aspect` is page width / height.
 */
export function fitSizePct(field: Pick<CertField, "sizePct" | "widthPct">, aspect: number, emWidth: number) {
  if (emWidth <= 0) return field.sizePct;
  return Math.min(field.sizePct, (field.widthPct * aspect * FIT_MARGIN) / emWidth);
}

export const cssFont = (field: Pick<CertField, "font" | "bold" | "italic">, sizePx: number) =>
  `${field.italic ? "italic " : ""}${field.bold ? 700 : 400} ${sizePx}px ${field.font}`;

let measureCtx: CanvasRenderingContext2D | null = null;

/** Text width in ems for the field's font, measured off-screen so hidden print pages size correctly too. */
export function measureEm(field: CertField, text: string): number {
  measureCtx ??= document.createElement("canvas").getContext("2d");
  if (!measureCtx) return 0;
  measureCtx.font = cssFont(field, 100);
  return measureCtx.measureText(text).width / 100;
}
