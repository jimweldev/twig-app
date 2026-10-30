import type { ReactNode } from "react";
import { gradeLabel } from "@/ecr/levels";
import type { SchoolProfile } from "@/lib/db";
import { PARTS, SECTIONS, type LessonPlan } from "./plan";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <tr>
      <th className="w-[30%] border border-black px-2 py-1.5 text-left align-top font-semibold">{label}</th>
      <td className="border border-black px-2 py-1.5 align-top whitespace-pre-wrap">{children}</td>
    </tr>
  );
}

function Signature({ caption, name, role }: { caption: string; name: string; role: string }) {
  return (
    <div className="flex-1">
      <div>{caption}:</div>
      <div className="mt-8 border-b border-black text-center font-semibold uppercase">{name || " "}</div>
      <div className="text-center">{role}</div>
    </div>
  );
}

/** The lesson plan as it prints: the ILAW template of DepEd Order No. 16, s. 2026. */
export function LessonPlanDocument({ plan, profile }: { plan: LessonPlan; profile: SchoolProfile | null }) {
  const c = plan.content;
  const grade = [gradeLabel(plan.grade_level), plan.sections.trim()].filter(Boolean).join(" – ");

  return (
    <div className="bg-white text-[10.5pt] leading-snug text-black">
      <div className="mb-3 text-center">
        {profile?.school_name && <div className="font-semibold uppercase">{profile.school_name}</div>}
        {(profile?.division || profile?.region) && (
          <div className="text-[9pt]">{[profile.division, profile.region].filter(Boolean).join(", ")}</div>
        )}
        <div className="mt-2 text-[13pt] font-bold tracking-wide">ILAW LESSON PLAN</div>
      </div>

      <table className="w-full border-collapse">
        <tbody>
          <Row label="Lesson title">{plan.title}</Row>
          <Row label="Learning area">{plan.learning_area}</Row>
          <Row label="Name of teacher">{profile?.teacher_name}</Row>
          <Row label="Grade level and section">{grade}</Row>
          <Row label="Term and week">{`Term ${plan.term}, Week ${plan.week}`}</Row>
          <Row label="No. of sessions">{`${plan.sessions} (${plan.minutes} minutes each)`}</Row>
          <Row label="References">{c.references}</Row>
          <Row label="Declaration of AI use">{c.ai_declaration || "No AI tool was used."}</Row>
        </tbody>
      </table>

      {PARTS.map((part, i) => (
        <table key={part.id} className="mt-3 w-full border-collapse break-inside-auto">
          <thead>
            <tr>
              <th colSpan={2} className="border border-black bg-neutral-200 px-2 py-1 text-left font-bold uppercase">
                {["I", "II", "III", "IV"][i]}. {part.title} ({part.id})
              </th>
            </tr>
          </thead>
          <tbody>
            {SECTIONS.filter((s) => s.part === part.id).map((s) => (
              <Row key={s.key} label={s.label}>
                {c[s.key]}
              </Row>
            ))}
          </tbody>
        </table>
      ))}

      <div className="mt-8 flex gap-8 break-inside-avoid">
        <Signature caption="Prepared by" name={profile?.teacher_name ?? ""} role="Teacher" />
        <Signature caption="Checked by" name={c.checked_by ?? ""} role="Master Teacher / Head Teacher" />
        <Signature caption="Noted by" name={profile?.school_head ?? ""} role="School Head" />
      </div>
    </div>
  );
}
