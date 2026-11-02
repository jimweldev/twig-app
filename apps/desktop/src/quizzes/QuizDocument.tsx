import { MathText, Rich } from "@/components/rich";
import { gradeLabel } from "@/ecr/levels";
import type { SchoolProfile } from "@/lib/db";
import { hasText } from "@/lib/rich-text";
import {
  LETTERS,
  PAPERS,
  QUESTION_TYPES,
  answerKey,
  answerLines,
  itemPoints,
  matchingColumn,
  partNumber,
  partPoints,
  quizPoints,
  type Quiz,
  type QuizPart,
} from "./quiz";

/** The printed page for a quiz: its paper size, portrait, with half-inch margins. */
export const quizPage = (quiz: Quiz) => ({ ...PAPERS[quiz.content.paper ?? "short"], marginIn: 0.5 });

// A fixed-width answer line on the first line of the item, however long the question wraps.
const blank = <span className="inline-block w-12 shrink-0 border-b border-black">&nbsp;</span>;

/** "1 point" or "5 points". */
const pts = (n: number) => `${n} point${n === 1 ? "" : "s"}`;

/** Multiple-choice options side by side when they're short, one per line when long. */
function Choices({ choices }: { choices: string[] }) {
  const longest = Math.max(0, ...choices.map((c) => c.length));
  const cols = longest <= 14 ? 4 : longest <= 34 ? 2 : 1;
  return (
    <div className="mt-0.5 grid gap-x-4 pl-20" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {choices.map((c, i) => (
        <div key={i}>
          {LETTERS[i]}. <MathText text={c} />
        </div>
      ))}
    </div>
  );
}

/** One part as learners see it: its items with spaces to answer. */
function PartItems({ part }: { part: QuizPart }) {
  if (part.type === "matching") {
    const column = matchingColumn(part);
    return (
      <div className="grid grid-cols-[3fr_2fr] gap-x-6">
        <div>
          <div className="mb-1 font-bold">Column A</div>
          {part.items.map((it, i) => (
            <div key={i} className="mb-1 flex items-baseline gap-1 break-inside-avoid">
              {blank}
              <span className="w-6 shrink-0 text-right">{i + 1}.</span>
              <span className="min-w-0 flex-1">
                <MathText text={it.question} />
              </span>
            </div>
          ))}
        </div>
        <div>
          <div className="mb-1 font-bold">Column B</div>
          {column.map((a, i) => (
            <div key={i} className="mb-1">
              {LETTERS[i] ?? i + 1}. <MathText text={a} />
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <ol className="flex flex-col gap-1.5">
      {part.items.map((it, i) => {
        const n = <span className="w-6 shrink-0 text-right">{i + 1}.</span>;
        if (part.type === "enumeration" || part.type === "essay") {
          // Essays get a line per point (4 to 8); enumerations a line per expected answer.
          const lines =
            part.type === "essay"
              ? Math.min(8, Math.max(4, itemPoints(part, it)))
              : Math.max(1, answerLines(it.answer).length);
          return (
            <li key={i} className="break-inside-avoid">
              <div className="flex items-baseline gap-1">
                {n}
                <span className="min-w-0 flex-1">
                  <MathText text={it.question} />
                  {part.type === "essay" && <i> ({pts(itemPoints(part, it))})</i>}
                </span>
              </div>
              <div className="pl-7">
                {Array.from({ length: lines }, (_, j) => (
                  <div key={j} className="flex h-6 items-end gap-1">
                    {part.type === "enumeration" && <span className="w-4">{j + 1}.</span>}
                    <span className="flex-1 border-b border-black" />
                  </div>
                ))}
              </div>
            </li>
          );
        }
        return (
          <li key={i} className="break-inside-avoid">
            <div className="flex items-baseline gap-1">
              {blank}
              {n}
              <span className="min-w-0 flex-1">
                <MathText text={it.question} />
              </span>
            </div>
            {part.type === "multiple_choice" && <Choices choices={it.choices ?? []} />}
          </li>
        );
      })}
    </ol>
  );
}

/** One part of the answer key: short answers in columns, written ones in full. */
function PartKey({ part }: { part: QuizPart }) {
  const key = answerKey(part);
  if (part.type === "essay" || part.type === "enumeration") {
    return (
      <ol className="flex flex-col gap-1">
        {part.items.map((_, i) => (
          <li key={i} className="flex items-baseline gap-1 break-inside-avoid">
            <span className="w-6 shrink-0 text-right">{i + 1}.</span>
            <span className="whitespace-pre-line">{key[i] || <i>(no answer written)</i>}</span>
          </li>
        ))}
      </ol>
    );
  }
  const short = key.every((k) => k.length <= 12);
  return (
    <ol className={short ? "columns-4 gap-6" : "flex flex-col gap-0.5"}>
      {key.map((k, i) => (
        <li key={i} className="flex items-baseline gap-1 break-inside-avoid">
          <span className="w-6 shrink-0 text-right">{i + 1}.</span>
          <b>{k ? <MathText text={k} /> : "—"}</b>
        </li>
      ))}
    </ol>
  );
}

/** A quiz as it prints: the test paper learners answer, or its answer key. */
export function QuizDocument({
  quiz,
  profile,
  answers,
}: {
  quiz: Quiz;
  profile: SchoolProfile | null;
  /** The answer key instead of the test paper. */
  answers?: boolean;
}) {
  const c = quiz.content;
  const total = quizPoints(c);
  const place = profile?.address?.trim() || profile?.district.trim();
  return (
    <div className="bg-white text-[11pt] leading-snug text-black" style={{ fontFamily: '"Bookman Old Style", serif' }}>
      <header className="mb-3 text-center">
        {profile?.school_name.trim() && <div className="font-bold uppercase">{profile.school_name}</div>}
        {place && <div className="text-[9pt] uppercase">{place}</div>}
        <div className="mt-2 text-[13pt] font-bold uppercase">{quiz.title || "Quiz"}</div>
        <div>
          {[quiz.learning_area, gradeLabel(quiz.grade_level)].filter(Boolean).join(" – ")}
          {answers && <b> · ANSWER KEY</b>}
        </div>
      </header>

      {answers ? (
        <p className="mb-3 text-center">Total: {pts(total)}</p>
      ) : (
        <div className="mb-3 grid grid-cols-[3fr_2fr] gap-x-6 gap-y-2">
          <div className="flex gap-2">
            Name: <span className="flex-1 border-b border-black" />
          </div>
          <div className="flex gap-2">
            Score: <span className="flex-1 border-b border-black" />
          </div>
          <div className="flex gap-2">
            Grade &amp; Section: <span className="flex-1 border-b border-black" />
          </div>
          <div className="flex gap-2">
            Date: <span className="flex-1 border-b border-black" />
          </div>
        </div>
      )}

      {!answers && hasText(c.instructions) && (
        <div className="mb-3">
          <Rich value={c.instructions} />
        </div>
      )}

      {c.parts.map((part, i) => (
        <section key={i} className="mb-4">
          <div className="break-after-avoid">
            <b>
              Test {partNumber(i)}. {QUESTION_TYPES[part.type].heading}
            </b>{" "}
            <span className="text-[10pt]">({pts(partPoints(part))})</span>
            {!answers && (
              <p className="mb-1.5">
                <b>Directions:</b> <MathText text={part.directions} />
              </p>
            )}
            {part.type === "essay" && part.rubric?.trim() && (
              <div className="mb-1.5 text-[10pt] whitespace-pre-line">
                <b>Scoring:</b> {part.rubric}
              </div>
            )}
          </div>
          {answers ? <PartKey part={part} /> : <PartItems part={part} />}
        </section>
      ))}
    </div>
  );
}
