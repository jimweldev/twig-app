import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Check, ClipboardPaste, Copy, ExternalLink, ListPlus } from "lucide-react";
import { cn } from "cn";
import { Field } from "@/components/field";
import { SimpleSelect } from "@/components/simple-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CHATGPT_URL, Step } from "@/lessons/AiDraftPanel";
import type { LessonPlan } from "@/lessons/plan";
import {
  QUESTION_TYPES,
  TYPE_ORDER,
  buildQuizPrompt,
  parseQuizResponse,
  type QuestionType,
  type Quiz,
  type QuizPart,
  type QuizSpec,
} from "./quiz";

/** How many of each type a quiz starts with: what it has already, else 10 multiple choice and 5 true or false. */
function startingCounts(quiz: Quiz): QuizSpec["counts"] {
  if (!quiz.content.parts.length) return { multiple_choice: 10, true_false: 5 };
  const counts: QuizSpec["counts"] = {};
  for (const p of quiz.content.parts) counts[p.type] = (counts[p.type] ?? 0) + p.items.length;
  return counts;
}

/**
 * Writes a quiz with ChatGPT, without an API key: the teacher picks the kinds of test,
 * copies the prompt into ChatGPT, then pastes the reply back to fill the quiz.
 */
export function QuizAiPanel({
  quiz,
  plan,
  onApply,
}: {
  quiz: Quiz;
  /** The lesson plan the quiz is from: what ChatGPT tests. */
  plan: LessonPlan | null;
  onApply: (title: string, parts: QuizPart[], mode: "replace" | "add") => void;
}) {
  const [spec, setSpec] = useState<QuizSpec>(() => ({
    counts: startingCounts(quiz),
    sessions: [],
    notes: "",
    language: "English",
  }));
  const [copied, setCopied] = useState(false);
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const prompt = buildQuizPrompt(quiz, plan, spec);
  const total = TYPE_ORDER.reduce((sum, t) => sum + (spec.counts[t] ?? 0), 0);

  const setCount = (type: QuestionType, text: string) =>
    setSpec({ ...spec, counts: { ...spec.counts, [type]: Math.min(50, Math.max(0, Math.round(Number(text) || 0))) } });
  const toggleSession = (s: number) =>
    setSpec({
      ...spec,
      sessions: spec.sessions.includes(s) ? spec.sessions.filter((x) => x !== s) : [...spec.sessions, s].sort(),
    });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy. Open “See the prompt” below and copy it by hand.");
    }
  };

  const fill = (mode: "replace" | "add") => {
    const parsed = parseQuizResponse(reply);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError("");
    setReply("");
    onApply(parsed.title, parsed.parts, mode);
  };

  return (
    <div className="flex flex-col gap-5">
      <Step n={1} title="Choose the tests, then copy the prompt into ChatGPT">
        <div className="flex flex-col gap-1.5">
          <Label>Number of items per test</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {TYPE_ORDER.map((t) => (
              <label
                key={t}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-lg border px-3 py-1.5 text-sm",
                  (spec.counts[t] ?? 0) > 0 && "border-primary/50 bg-primary/5",
                )}
              >
                {QUESTION_TYPES[t].label}
                <Input
                  type="number"
                  min={0}
                  max={50}
                  className="h-7 w-16"
                  value={spec.counts[t] ?? 0}
                  onChange={(e) => setCount(t, e.target.value)}
                />
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {total} item{total === 1 ? "" : "s"} in all. Set a test to 0 to leave it out.
          </p>
        </div>

        {plan && plan.sessions > 1 && (
          <div className="flex flex-col gap-1.5">
            <Label>Covers</Label>
            <div className="flex flex-wrap gap-1.5">
              <Button
                size="sm"
                variant={spec.sessions.length === 0 ? "default" : "outline"}
                onClick={() => setSpec({ ...spec, sessions: [] })}
              >
                All sessions
              </Button>
              {Array.from({ length: plan.sessions }, (_, i) => i + 1).map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={spec.sessions.includes(s) ? "default" : "outline"}
                  onClick={() => toggleSession(s)}
                >
                  Session {s}
                </Button>
              ))}
            </div>
          </div>
        )}
        {!plan && (
          <p className="text-sm text-muted-foreground">
            This quiz isn&rsquo;t linked to a lesson plan. Choose one under Quiz details, or say what to cover in the
            notes.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
          <Field
            label="Notes for ChatGPT"
            hint="e.g. what to focus on, terms to include or avoid, how hard it should be"
          >
            <Textarea
              rows={2}
              placeholder="e.g. Focus on eons and eras; avoid exact dates."
              value={spec.notes}
              onChange={(e) => setSpec({ ...spec, notes: e.target.value })}
            />
          </Field>
          <Field label="Language">
            <SimpleSelect
              value={spec.language}
              onValueChange={(v) => setSpec({ ...spec, language: v as QuizSpec["language"] })}
              options={[
                { value: "English", label: "English" },
                { value: "Filipino", label: "Filipino" },
              ]}
            />
          </Field>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button disabled={total === 0} onClick={copy}>
            {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy prompt"}
          </Button>
          <Button
            variant="outline"
            onClick={() => openUrl(CHATGPT_URL).catch(() => window.open(CHATGPT_URL, "_blank"))}
          >
            <ExternalLink /> Open ChatGPT
          </Button>
        </div>
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">See the prompt</summary>
          <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-muted p-3 whitespace-pre-wrap">{prompt}</pre>
        </details>
      </Step>

      <Step n={2} title="Paste ChatGPT's whole reply here">
        <Textarea
          rows={4}
          className="max-h-48 font-mono text-xs md:text-xs"
          placeholder='```json&#10;{ "title": "…", "parts": [ … ] }&#10;```'
          value={reply}
          onChange={(e) => setReply(e.target.value)}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button disabled={!reply.trim()} onClick={() => fill("replace")}>
            <ClipboardPaste /> {quiz.content.parts.length ? "Replace the tests" : "Fill the quiz"}
          </Button>
          {quiz.content.parts.length > 0 && (
            <Button variant="outline" disabled={!reply.trim()} onClick={() => fill("add")}>
              <ListPlus /> Add as new tests
            </Button>
          )}
        </div>
      </Step>
    </div>
  );
}
