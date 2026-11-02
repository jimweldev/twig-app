import type { ReactNode } from "react";
import seal from "@/assets/deped-seal.png";
import { gradeLabel } from "@/ecr/levels";
import type { LessonFooter, SchoolProfile } from "@/lib/db";
import { Rich } from "@/components/rich";
import { hasText } from "@/lib/rich-text";
import { SECTIONS, hasSessionText, sessionText, type LessonPlan, type SectionKey } from "./plan";

/** The printed page: long bond (13 × 8.5 in) landscape with half-inch margins, like the DepEd DLL. */
export const PLAN_PAGE = { widthIn: 13, heightIn: 8.5, marginIn: 0.5 };

// Each cell draws its right and bottom lines, the table its top and left, so a row split across
// pages still closes on both: cells repeat their bottom line and the table its top line on each page.
const table =
  "w-full table-fixed border-separate border-spacing-0 border-t border-l border-black [box-decoration-break:clone]";
const cell = "border-r border-b border-black px-1.5 py-1 align-top [box-decoration-break:clone]";

/** The template's guide under each row label (DepEd Order No. 16, s. 2026). */
const GUIDES: Partial<Record<SectionKey, string>> = {
  objectives:
    "Write the smaller knowledge, skills, or tasks from the competency that the learners will work on and be able to show by the end of the sessions",
  learner_context:
    "Write your observations of your learners, and how they have been performing or responding to learning experiences recently. Include strengths, interests, and possible barriers to learning",
  pre_lesson: "Describe how you will help the learners get ready for the lesson.",
  flow: "Describe the activities that you can implement in 1 or more sessions to meet the learning objectives.",
  resources:
    "List down the learning resources that will help you reach your objectives. Ensure that they are available and inclusive. Include options and alternatives in case of emergencies",
  integration:
    "Write down any possibilities to meaningfully integrate another learning area, special topic, or technology. Write N/A if none.",
  assessment:
    "Create a task, activity or questions to evaluate learning and provide feedback every now and then. Include ways for learners to ask for guidance or support throughout each session.",
  extended_learning:
    "Suggest other learning experiences outside the classroom/class hours that learners may want to access to reinforce what they have learned, to spark their curiosities further, or that may provide them support in their areas of difficulty.",
  reflection:
    "Think about what you need to change for the next sessions based on what happened today. Is there something the learners are interested in exploring? Are there some things you would like to share with your co-teachers, parents, or school leaders about your classroom experience? What would you like your instructional coach to help you with?",
};

/** Row labels as the DepEd template words them. */
const LABELS: Partial<Record<SectionKey, string>> = {
  objectives: "Learning Objectives",
  learner_context: "Learner Context",
  pre_lesson: "Pre-Lesson",
  flow: "Flow",
  resources: "Learning Resources",
  integration: "Opportunities for integration",
  assessment: "Formative Assessment",
  extended_learning: "Extended learning opportunities",
};

/** A part's heading row across the whole table, shaded so the parts stand apart. */
function PartHead({ title, span }: { title: string; span: number }) {
  return (
    <tr>
      <th
        colSpan={span + 1}
        className={`${cell} bg-stone-300 text-left font-bold uppercase`}
        style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
      >
        {title}
      </th>
    </tr>
  );
}

/** A row label: the part in bold, then the template's guide. */
function Label({ title, guide, inline }: { title: string; guide?: string; inline?: boolean }) {
  return (
    <th className={`${cell} text-left font-normal`}>
      <b>{title}:</b>
      {guide && (inline ? " " : <br />)}
      {guide}
    </th>
  );
}

/** A per-session part: one cell per session, or one wide cell for text written for all sessions. */
function SessionRow({ plan, k, inline }: { plan: LessonPlan; k: SectionKey; inline?: boolean }) {
  const def = SECTIONS.find((s) => s.key === k)!;
  const c = plan.content;
  const n = plan.sessions;
  // Rows may split across pages, as in Word: a long Flow row that can't split leaves most of a page empty.
  return (
    <tr>
      <Label title={LABELS[k] ?? def.label} guide={GUIDES[k]} inline={inline} />
      {hasSessionText(c, k) || !hasText(c[k]) ? (
        Array.from({ length: n }, (_, i) => (
          <td key={i} className={`${cell}`}>
            <Rich value={sessionText(c, k, i)} />
          </td>
        ))
      ) : (
        <td colSpan={n} className={`${cell}`}>
          <Rich value={c[k]} />
        </td>
      )}
    </tr>
  );
}

/** Column widths: the label column, the same for any number of sessions, then the sessions sharing the rest. */
function Cols({ n }: { n: number }) {
  return (
    <colgroup>
      <col style={{ width: "24%" }} />
      {Array.from({ length: n }, (_, i) => (
        <col key={i} />
      ))}
    </colgroup>
  );
}

function Signature({ caption, name, position }: { caption: string; name: string; position: string }) {
  return (
    <div className="flex-1">
      <div>{caption}</div>
      <div className="mt-8 pl-5 font-bold uppercase">{name || " "}</div>
      <div className="pl-5">{position || " "}</div>
    </div>
  );
}

/** Height of the footer images, and the room kept for them at the bottom of each page. */
const FOOTER_IN = 0.6;
const FOOTER_GAP_IN = 0.15;

/** The footer images, fixed to the bottom of the page so they print on every page. */
function Footer({ footer }: { footer: LessonFooter }) {
  const row = (images: string[]) => (
    <div className="flex items-end gap-2">
      {images.map((src, i) => (
        <img key={i} src={src} alt="" className="w-auto object-contain" style={{ height: `${FOOTER_IN}in` }} />
      ))}
    </div>
  );
  return (
    <div className="fixed inset-x-0 bottom-0 flex items-end justify-between">
      {row(footer.left)}
      {row(footer.right)}
    </div>
  );
}

/** The lesson plan as it prints: the DepEd lesson plan (DLL) layout of DepEd Order No. 16, s. 2026. */
export function LessonPlanDocument({
  plan,
  profile,
  footer,
}: {
  plan: LessonPlan;
  profile: SchoolProfile | null;
  footer?: LessonFooter;
}) {
  const hasFooter = !!footer && footer.left.length + footer.right.length > 0;
  const c = plan.content;
  const n = plan.sessions;
  const grade = plan.grade_level >= 1 ? String(plan.grade_level) : gradeLabel(plan.grade_level);
  // Sections may already start with the grade, e.g. "9 STE, Barium".
  const sectionsText = plan.sections.trim();
  const gradeAndSection = sectionsText.startsWith(grade)
    ? sectionsText
    : [grade, sectionsText].filter(Boolean).join(" ");
  const heading = ["Lesson plan", plan.learning_area.trim(), /\d$/.test(plan.learning_area.trim()) ? "" : grade]
    .filter(Boolean)
    .join(" ");
  const division = profile?.division.trim() ?? "";

  const body = (
    <>
      <header className="mb-4 text-center">
        <img src={seal} alt="" className="mx-auto mb-1 size-[0.8in]" />
        <div className="text-[11pt]" style={{ fontFamily: '"Old English Text MT", serif' }}>
          Republic of the Philippines
        </div>
        <div className="text-[17pt] leading-tight" style={{ fontFamily: '"Old English Text MT", serif' }}>
          Department of Education
        </div>
        <div className="font-sans text-[8.5pt] font-bold">
          {profile?.region.trim() && <div>{profile.region}</div>}
          {division && <div>{/division/i.test(division) ? division : `Schools Division of ${division}`}</div>}
          {profile?.school_name.trim() && <div className="uppercase">{profile.school_name}</div>}
          {/* The DLL puts the school's address under its name; the district only when there's no address. */}
          {(profile?.address?.trim() || profile?.district.trim()) && (
            <div className="uppercase">{profile.address?.trim() || profile.district}</div>
          )}
        </div>
        <div className="mt-3 font-bold uppercase">{heading}</div>
      </header>

      <table className={table}>
        <Cols n={1} />
        <tbody>
          {(
            [
              ["Lesson Title", plan.title],
              ["Learning Area", plan.learning_area],
              ["Name of Teacher", c.prepared_by || profile?.teacher_name],
              ["Grade Level and Section", gradeAndSection],
              ["Number of Session/s", `${n} (Term ${plan.term}, Week ${plan.week} · ${plan.minutes} minutes each)`],
            ] as [string, ReactNode][]
          ).map(([label, value]) => (
            <tr key={label}>
              <th className={`${cell} h-[0.36in] text-left font-bold`}>{label}:</th>
              <td className={cell}>{value}</td>
            </tr>
          ))}
          <tr>
            <th className={`${cell} h-[0.5in] text-left font-normal`}>
              <b>References:</b>
              <br />
              <i>(books, websites, toolkits, etc.)</i>
            </th>
            <td className={`${cell}`}>
              <Rich value={c.references} />
            </td>
          </tr>
          <tr>
            <th className={`${cell} text-left font-normal`}>
              <b>Declaration of AI use:</b>
              <br />
              <i>(Cite how AI was used in the formulation of the lesson plan. See DO 3 s.2026 Annex A.)</i>
            </th>
            <td className={`${cell} text-justify`}>
              <Rich value={hasText(c.ai_declaration) ? c.ai_declaration : "No AI tool was used."} />
            </td>
          </tr>
        </tbody>
      </table>

      {/* One table for all four parts, so the session columns line up from top to bottom. */}
      <table className={`mt-4 ${table}`}>
        <Cols n={n} />
        <tbody>
          <PartHead title="Intentions" span={n} />
          <tr>
            <th className={`${cell} text-left font-normal`}>
              <b>Learning Competency and Curriculum Standards:</b>
              <br />
              Write the competency/ies from the curriculum that we are targeting, and the content or performance/s
            </th>
            <td colSpan={n} className={`${cell}`}>
              {hasText(c.content_standard) && (
                <>
                  <div>Content Standard:</div>
                  <Rich value={c.content_standard} />
                </>
              )}
              {hasText(c.performance_standard) && (
                <>
                  <div>Performance Standard:</div>
                  <Rich value={c.performance_standard} />
                </>
              )}
              {hasText(c.competency) && (
                <>
                  <div className="font-bold italic">Learning Competency</div>
                  <Rich value={c.competency} />
                </>
              )}
            </td>
          </tr>
          <SessionRow plan={plan} k="objectives" />
          <SessionRow plan={plan} k="learner_context" />
          <PartHead title="Learning Experience" span={n} />
          <tr>
            <td className={cell} />
            {Array.from({ length: n }, (_, i) => (
              <th key={i} className={`${cell} text-center font-bold`}>
                SESSION {i + 1}
              </th>
            ))}
          </tr>
          <SessionRow plan={plan} k="pre_lesson" />
          <SessionRow plan={plan} k="flow" inline />
          <SessionRow plan={plan} k="resources" inline />
          <SessionRow plan={plan} k="integration" inline />
          <PartHead title="Assessment" span={n} />
          <SessionRow plan={plan} k="assessment" />
          <PartHead title="Ways Forward" span={n} />
          <SessionRow plan={plan} k="extended_learning" inline />
          <tr className="break-inside-avoid">
            <Label title="Reflections" guide={GUIDES.reflection} inline />
            <td colSpan={n} className={`${cell}`}>
              <Rich value={c.reflection} />
            </td>
          </tr>
        </tbody>
      </table>

      <div className="mt-4 flex gap-8 break-inside-avoid">
        {/* A blank on the plan falls back to the school profile. */}
        <Signature
          caption="Prepared by:"
          name={c.prepared_by || profile?.teacher_name || ""}
          position={c.prepared_position || profile?.teacher_position || ""}
        />
        <Signature
          caption="Checked by:"
          name={c.checked_by || profile?.checker_name || ""}
          position={c.checked_position || profile?.checker_position || ""}
        />
        <Signature
          caption="Noted:"
          name={c.noted_by || profile?.school_head || ""}
          position={c.noted_position || profile?.school_head_position || ""}
        />
      </div>
    </>
  );

  return (
    <div className="bg-white text-[9.5pt] leading-snug text-black" style={{ fontFamily: '"Bookman Old Style", serif' }}>
      {footer && hasFooter ? (
        // A table footer repeats on every printed page, so its empty row keeps the fixed footer clear of the text.
        <>
          <table className="w-full border-collapse">
            <tbody>
              <tr>
                <td className="p-0">{body}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td className="p-0" style={{ height: `${FOOTER_IN + FOOTER_GAP_IN}in` }} />
              </tr>
            </tfoot>
          </table>
          <Footer footer={footer} />
        </>
      ) : (
        body
      )}
    </div>
  );
}
