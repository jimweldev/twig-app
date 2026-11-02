import { ArrowDown, ArrowUp, Check, Plus, Trash2, X } from "lucide-react";
import { cn } from "cn";
import { Field } from "@/components/field";
import { SimpleSelect } from "@/components/simple-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  LETTERS,
  QUESTION_TYPES,
  TYPE_ORDER,
  newItem,
  partNumber,
  partPoints,
  withType,
  type QuestionType,
  type QuizItem,
  type QuizPart,
} from "./quiz";

const TYPE_OPTIONS = TYPE_ORDER.map((t) => ({ value: t, label: QUESTION_TYPES[t].label }));

/** The editor for one item, shaped by the part's type. */
function ItemFields({
  type,
  item,
  onChange,
}: {
  type: QuestionType;
  item: QuizItem;
  onChange: (item: QuizItem) => void;
}) {
  const set = (patch: Partial<QuizItem>) => onChange({ ...item, ...patch });
  const question = (placeholder: string) => (
    <Textarea
      rows={1}
      className="min-h-9"
      placeholder={placeholder}
      value={item.question}
      onChange={(e) => set({ question: e.target.value })}
    />
  );

  switch (type) {
    case "multiple_choice": {
      const choices = item.choices ?? [];
      const setChoice = (i: number, text: string) => set({ choices: choices.map((c, j) => (j === i ? text : c)) });
      const removeChoice = (i: number) => {
        const correct = LETTERS.indexOf(item.answer);
        const next = correct > i ? correct - 1 : correct === i ? 0 : correct;
        set({ choices: choices.filter((_, j) => j !== i), answer: LETTERS[Math.max(0, next)] });
      };
      return (
        <div className="flex flex-col gap-2">
          {question("Question")}
          <div className="grid gap-1.5 sm:grid-cols-2">
            {choices.map((c, i) => {
              const correct = item.answer === LETTERS[i];
              return (
                <div key={i} className="flex items-center gap-1.5">
                  <button
                    type="button"
                    title={correct ? "The correct answer" : "Mark as the correct answer"}
                    onClick={() => set({ answer: LETTERS[i] })}
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                      correct ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                    )}
                  >
                    {correct ? <Check className="size-3.5" /> : LETTERS[i]}
                  </button>
                  <Input
                    value={c}
                    placeholder={`Choice ${LETTERS[i]}`}
                    onChange={(e) => setChoice(i, e.target.value)}
                  />
                  {choices.length > 2 && (
                    <Button variant="ghost" size="icon-xs" title="Remove choice" onClick={() => removeChoice(i)}>
                      <X />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
          {choices.length < 6 && (
            <Button variant="ghost" size="xs" className="self-start" onClick={() => set({ choices: [...choices, ""] })}>
              <Plus /> Add choice
            </Button>
          )}
        </div>
      );
    }
    case "true_false":
      return (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <div className="flex-1">{question("Statement")}</div>
          <div className="flex shrink-0 overflow-hidden rounded-lg border">
            {["True", "False"].map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => set({ answer: a })}
                className={cn(
                  "px-3 py-1.5 text-sm",
                  item.answer === a ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
      );
    case "matching":
      return (
        <div className="grid gap-2 sm:grid-cols-[3fr_2fr]">
          {question("Column A: the description")}
          <Input
            placeholder="Column B: its answer"
            value={item.answer}
            onChange={(e) => set({ answer: e.target.value })}
          />
        </div>
      );
    case "enumeration":
      return (
        <div className="grid gap-2 sm:grid-cols-[3fr_2fr]">
          {question("What to list, e.g. Give the four eons")}
          <Textarea
            rows={2}
            placeholder="Answers, one per line"
            value={item.answer}
            onChange={(e) => set({ answer: e.target.value })}
          />
        </div>
      );
    case "essay":
      return (
        <div className="flex flex-col gap-2">
          {question("Question")}
          <Textarea
            rows={2}
            placeholder="What a full-credit answer includes (printed only on the answer key)"
            value={item.answer}
            onChange={(e) => set({ answer: e.target.value })}
          />
        </div>
      );
    default:
      return (
        <div className="grid gap-2 sm:grid-cols-[3fr_2fr]">
          {question("Description or question")}
          <Input placeholder="Answer" value={item.answer} onChange={(e) => set({ answer: e.target.value })} />
        </div>
      );
  }
}

/** One part of a quiz (Test I, Test II, …): its type, directions, points and items. */
export function PartEditor({
  part,
  index,
  count,
  onChange,
  onRemove,
  onMove,
}: {
  part: QuizPart;
  index: number;
  /** How many parts the quiz has, for the move buttons. */
  count: number;
  onChange: (part: QuizPart) => void;
  onRemove: () => void;
  onMove: (by: -1 | 1) => void;
}) {
  const setItem = (i: number, item: QuizItem) =>
    onChange({ ...part, items: part.items.map((it, j) => (j === i ? item : it)) });
  const total = partPoints(part);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <span className="flex h-7 min-w-7 items-center justify-center rounded-md bg-primary/10 px-1.5 text-sm font-bold text-primary">
            {partNumber(index)}
          </span>
          <SimpleSelect
            className="w-48 text-sm font-normal"
            value={part.type}
            onValueChange={(v) => onChange(withType(part, v as QuestionType))}
            options={TYPE_OPTIONS}
          />
          <span className="text-sm font-normal text-muted-foreground">
            {part.items.length} item{part.items.length === 1 ? "" : "s"} · {total} point{total === 1 ? "" : "s"}
          </span>
          <span className="flex-1" />
          <Button variant="ghost" size="icon-sm" title="Move up" disabled={index === 0} onClick={() => onMove(-1)}>
            <ArrowUp />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title="Move down"
            disabled={index === count - 1}
            onClick={() => onMove(1)}
          >
            <ArrowDown />
          </Button>
          <Button variant="ghost" size="icon-sm" title="Remove this test" onClick={onRemove}>
            <Trash2 />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
          <Field label="Directions">
            <Textarea
              rows={1}
              value={part.directions}
              onChange={(e) => onChange({ ...part, directions: e.target.value })}
            />
          </Field>
          <Field label={part.type === "enumeration" ? "Points per answer" : "Points per item"}>
            <Input
              type="number"
              min={1}
              max={100}
              value={part.points}
              onChange={(e) => onChange({ ...part, points: Math.max(1, Math.round(Number(e.target.value) || 1)) })}
            />
          </Field>
        </div>
        {part.type === "essay" && (
          <Field
            label="Scoring rubric"
            hint="Printed under the directions, e.g. 5 – complete and accurate; 3 – partly correct"
          >
            <Textarea
              rows={2}
              value={part.rubric ?? ""}
              onChange={(e) => onChange({ ...part, rubric: e.target.value })}
            />
          </Field>
        )}

        <ol className="flex flex-col gap-3">
          {part.items.map((item, i) => (
            <li key={i} className="flex gap-2 border-t pt-3">
              <span className="w-6 shrink-0 pt-2 text-right text-sm font-medium text-muted-foreground">{i + 1}.</span>
              <div className="min-w-0 flex-1">
                <ItemFields type={part.type} item={item} onChange={(it) => setItem(i, it)} />
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                title="Remove item"
                className="mt-1"
                onClick={() => onChange({ ...part, items: part.items.filter((_, j) => j !== i) })}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onChange({ ...part, items: [...part.items, newItem(part.type)] })}
          >
            <Plus /> Add item
          </Button>
          <span className="text-xs text-muted-foreground">
            Type math as LaTeX between dollar signs, e.g. $x^2 + 1$.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
