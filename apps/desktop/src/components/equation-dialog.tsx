import { useEffect, useRef, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RequiredMark } from "@/components/field";
import { Label } from "@/components/ui/label";

/** LaTeX as HTML, or null when it doesn't parse yet. */
function renderLatex(latex: string): string | null {
  try {
    return katex.renderToString(latex, { throwOnError: true, displayMode: false });
  } catch {
    return null;
  }
}

/** One-click pieces: what the button shows (as math) and what it types. `|` marks where the cursor lands. */
const TEMPLATES: { label: string; snippet: string; title: string }[] = [
  { label: "\\frac{a}{b}", snippet: "\\frac{|}{}", title: "Fraction" },
  { label: "x^{2}", snippet: "^{|}", title: "Exponent" },
  { label: "x_{1}", snippet: "_{|}", title: "Subscript" },
  { label: "\\sqrt{x}", snippet: "\\sqrt{|}", title: "Square root" },
  { label: "\\sqrt[n]{x}", snippet: "\\sqrt[|]{}", title: "nth root" },
  { label: "\\times", snippet: "\\times ", title: "Times" },
  { label: "\\div", snippet: "\\div ", title: "Divided by" },
  { label: "\\pm", snippet: "\\pm ", title: "Plus or minus" },
  { label: "\\le", snippet: "\\le ", title: "Less than or equal" },
  { label: "\\ge", snippet: "\\ge ", title: "Greater than or equal" },
  { label: "\\ne", snippet: "\\ne ", title: "Not equal" },
  { label: "\\approx", snippet: "\\approx ", title: "Approximately" },
  { label: "\\pi", snippet: "\\pi ", title: "Pi" },
  { label: "\\theta", snippet: "\\theta ", title: "Theta" },
  { label: "\\Delta", snippet: "\\Delta ", title: "Delta (change)" },
  { label: "30^\\circ", snippet: "^\\circ", title: "Degrees" },
  { label: "\\angle", snippet: "\\angle ", title: "Angle" },
  { label: "\\infty", snippet: "\\infty ", title: "Infinity" },
  { label: "\\overline{AB}", snippet: "\\overline{|}", title: "Line segment" },
  { label: "\\overrightarrow{AB}", snippet: "\\overrightarrow{|}", title: "Ray / vector" },
  { label: "\\sum", snippet: "\\sum_{i=1}^{n} ", title: "Sum" },
  { label: "\\%", snippet: "\\% ", title: "Percent" },
  { label: "\\rightarrow", snippet: "\\rightarrow ", title: "Arrow (reactions)" },
  { label: "\\text{abc}", snippet: "\\text{|}", title: "Words inside the equation" },
];

/**
 * Write an equation in LaTeX with a live preview. `latex` is the starting text: the
 * equation being edited, or the selected text being turned into one.
 */
export function EquationDialog({
  open,
  latex: initial,
  editing,
  onOpenChange,
  onSave,
  onDelete,
}: {
  open: boolean;
  latex: string;
  /** An existing equation: the button says Update, and it can be removed. */
  editing: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (latex: string) => void;
  onDelete?: () => void;
}) {
  const [latex, setLatex] = useState(initial);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) setLatex(initial);
  }, [open, initial]);

  const preview = latex.trim() ? renderLatex(latex) : null;

  // Types a template where the cursor is, then puts the cursor at its "|".
  const insert = (snippet: string) => {
    const el = input.current;
    const start = el?.selectionStart ?? latex.length;
    const end = el?.selectionEnd ?? latex.length;
    const at = snippet.indexOf("|");
    const text = snippet.replace("|", "");
    setLatex(latex.slice(0, start) + text + latex.slice(end));
    const caret = start + (at === -1 ? text.length : at);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
  };

  const save = () => {
    if (!latex.trim() || !preview) return;
    onSave(latex.trim());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit equation" : "Insert equation"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap gap-1">
          {TEMPLATES.map((t) => (
            <button
              key={t.title}
              type="button"
              title={t.title}
              onClick={() => insert(t.snippet)}
              className="flex h-9 min-w-9 items-center justify-center rounded-md border px-1.5 text-sm hover:bg-muted"
              dangerouslySetInnerHTML={{ __html: renderLatex(t.label) ?? t.label }}
            />
          ))}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="equation-latex">
            Equation (LaTeX)
            <RequiredMark />
          </Label>
          <Input
            id="equation-latex"
            ref={input}
            autoFocus
            className="font-mono"
            placeholder="e.g. x^2 + 3x - 4 = 0"
            value={latex}
            onChange={(e) => setLatex(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                save();
              }
            }}
          />
          <p className="text-xs text-muted-foreground">
            Click a button above, or type: ^ for powers, _ for subscripts, \frac{"{a}{b}"} for fractions.
          </p>
        </div>
        <div className="flex min-h-14 items-center justify-center rounded-md border bg-muted/40 p-3 text-lg">
          {!latex.trim() ? (
            <span className="text-sm text-muted-foreground">The equation shows here as you type.</span>
          ) : preview ? (
            <span dangerouslySetInnerHTML={{ __html: preview }} />
          ) : (
            <span className="text-sm text-destructive">Not finished yet: check the braces {"{ }"}.</span>
          )}
        </div>
        <DialogFooter>
          {editing && onDelete && (
            <Button
              variant="ghost"
              className="mr-auto text-destructive"
              onClick={() => {
                onDelete();
                onOpenChange(false);
              }}
            >
              Remove
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!preview} onClick={save}>
            {editing ? "Update" : "Insert"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
