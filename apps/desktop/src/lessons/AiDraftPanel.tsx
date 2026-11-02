import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Check, ClipboardPaste, Copy, ExternalLink, Info, ListPlus, Undo2, WandSparkles } from "lucide-react";
import { Field } from "@/components/field";
import { SimpleSelect } from "@/components/simple-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AI_LABELS,
  buildPrompt,
  parseResponse,
  type AiKey,
  type AiValues,
  type LessonPlan,
  type PromptInput,
} from "./plan";

export const CHATGPT_URL = "https://chatgpt.com/";

export function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
        {n}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="text-sm font-medium">{title}</div>
        {children}
      </div>
    </div>
  );
}

/**
 * Drafts a lesson plan with ChatGPT without an API key: the teacher copies a prompt,
 * pastes it into ChatGPT, then pastes the reply back here to fill the plan.
 */
export function AiDraftPanel({
  plan,
  onApply,
  onUndo,
}: {
  plan: LessonPlan;
  onApply: (values: AiValues) => void;
  /** Present while the last fill can be undone. */
  onUndo?: () => void;
}) {
  const [input, setInput] = useState<PromptInput>({ topic: plan.title, notes: "", language: "English" });
  const [copied, setCopied] = useState(false);
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [filled, setFilled] = useState<AiKey[]>([]);
  const prompt = buildPrompt(plan, input);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy. Open “See the prompt” below and copy it by hand.");
    }
  };

  // A fill-in outline for the notes: each line says what to write after it; blank lines separate the groups.
  const outline = [
    ["Competency (the code or exact wording): ", "Standards (content and performance, if you have them): "],
    ...Array.from({ length: plan.sessions }, (_, i) => [
      `Session ${i + 1}`,
      "Topic: ",
      "Pre-lesson (review, motivation): ",
      "Activities: ",
      "Quiz (type and number of items): ",
    ]),
    [
      "Learners (grade and sections, reading level, interests, what they already know): ",
      "Resources (what you have, e.g. printed charts, TV, textbooks): ",
      "Also include (integration, homework, references you must use): ",
    ],
  ]
    .map((group) => group.join("\n"))
    .join("\n\n");
  // Once the outline is in, the button would only duplicate it (older outlines also start with "Competency (").
  const hasTemplate = input.notes.includes("Competency (");
  const insertTemplate = () => {
    if (hasTemplate) return;
    setInput({ ...input, notes: input.notes.trim() ? `${input.notes.trimEnd()}\n\n${outline}` : outline });
  };

  const openChatGpt = () => openUrl(CHATGPT_URL).catch(() => window.open(CHATGPT_URL, "_blank"));

  const fill = () => {
    const parsed = parseResponse(reply);
    if (!parsed.ok) {
      setError(parsed.error);
      setFilled([]);
      return;
    }
    setError("");
    setFilled(Object.keys(parsed.values) as AiKey[]);
    setReply("");
    onApply(parsed.values);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <WandSparkles className="size-4 text-primary" /> Draft with ChatGPT
        </CardTitle>
        <CardDescription className="flex items-start gap-1.5">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          DO 16, s. 2026 lets AI assist, not replace you: review and revise every part, and keep the Declaration of AI
          use.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <Step n={1} title="Describe the lesson, then copy the prompt into ChatGPT">
          <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
            <Field label="Topic">
              <Input
                placeholder={plan.title || "e.g. Parts of a plant"}
                value={input.topic}
                onChange={(e) => setInput({ ...input, topic: e.target.value })}
              />
            </Field>
            <Field label="Language">
              <SimpleSelect
                value={input.language}
                onValueChange={(v) => setInput({ ...input, language: v as PromptInput["language"] })}
                options={[
                  { value: "English", label: "English" },
                  { value: "Filipino", label: "Filipino" },
                ]}
              />
            </Field>
          </div>
          <Field
            label="Notes for ChatGPT"
            hint="The more you tell ChatGPT, the closer the draft is to what you want. Include the competency or its code, what each session should cover, the activities and assessment you prefer, and what your learners are like."
          >
            <Textarea
              rows={hasTemplate ? 20 : 6}
              placeholder={
                "e.g.\nCompetency: Explain how the geologic time scale helps to recount the history of the Earth.\n\nSession 1\nTopic: why scientists need a geologic time scale\nPre-lesson: review relative and absolute dating; compare a clock and a calendar\nActivities: read a time scale diagram in pairs\nQuiz: 5-item True/False\n\nLearners: 9 STE and Barium; mixed reading levels; enjoy matching games and timelines."
              }
              value={input.notes}
              onChange={(e) => setInput({ ...input, notes: e.target.value })}
            />
          </Field>
          {!hasTemplate && (
            <Button variant="outline" size="sm" className="self-start" onClick={insertTemplate}>
              <ListPlus /> Add notes template ({plan.sessions} session{plan.sessions === 1 ? "" : "s"})
            </Button>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={copy}>
              {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy prompt"}
            </Button>
            <Button variant="outline" onClick={openChatGpt}>
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
            placeholder='```json&#10;{ "title": "…", … }&#10;```'
            value={reply}
            onChange={(e) => setReply(e.target.value)}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <Button disabled={!reply.trim()} onClick={fill}>
              <ClipboardPaste /> Fill the lesson plan
            </Button>
            {onUndo && (
              <Button
                variant="ghost"
                onClick={() => {
                  onUndo();
                  setFilled([]);
                }}
              >
                <Undo2 /> Undo fill
              </Button>
            )}
          </div>
          {filled.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Filled {filled.length} parts: {filled.map((k) => AI_LABELS[k]).join(", ")}. Review each one below.
            </p>
          )}
        </Step>
      </CardContent>
    </Card>
  );
}
