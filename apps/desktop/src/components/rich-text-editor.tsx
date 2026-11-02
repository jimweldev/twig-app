import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Mathematics from "@tiptap/extension-mathematics";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Sigma,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Underline,
  type LucideIcon,
} from "lucide-react";
import { EquationDialog } from "@/components/equation-dialog";
import { toHtml } from "@/lib/rich-text";
import { cn } from "@/lib/utils";

function ToolButton({
  icon: Icon,
  label,
  active = false,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      // Keep the selection: a mousedown on the button would otherwise blur the editor.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex size-7 items-center justify-center rounded-md text-foreground hover:bg-muted",
        active && "bg-primary/10 text-primary",
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}

const Divider = () => <span className="mx-0.5 h-5 w-px bg-border" />;

/** The toolbar that floats over selected text. */
function Toolbar({ editor, onEquation }: { editor: Editor; onEquation: () => void }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      superscript: e.isActive("superscript"),
      subscript: e.isActive("subscript"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
    }),
  });
  const run = () => editor.chain().focus();
  return (
    <BubbleMenu
      editor={editor}
      appendTo={() => document.body}
      className="z-[60] flex items-center gap-0.5 rounded-lg border bg-popover p-1 shadow-md"
    >
      <ToolButton icon={Bold} label="Bold (Ctrl+B)" active={state.bold} onClick={() => run().toggleBold().run()} />
      <ToolButton
        icon={Italic}
        label="Italic (Ctrl+I)"
        active={state.italic}
        onClick={() => run().toggleItalic().run()}
      />
      <ToolButton
        icon={Underline}
        label="Underline (Ctrl+U)"
        active={state.underline}
        onClick={() => run().toggleUnderline().run()}
      />
      <Divider />
      <ToolButton
        icon={SuperscriptIcon}
        label="Superscript, e.g. x² (Ctrl+.)"
        active={state.superscript}
        onClick={() => run().toggleSuperscript().run()}
      />
      <ToolButton
        icon={SubscriptIcon}
        label="Subscript, e.g. H₂O (Ctrl+,)"
        active={state.subscript}
        onClick={() => run().toggleSubscript().run()}
      />
      <ToolButton icon={Sigma} label="Make it an equation" onClick={onEquation} />
      <Divider />
      <ToolButton
        icon={List}
        label="Bulleted list"
        active={state.bullet}
        onClick={() => run().toggleBulletList().run()}
      />
      <ToolButton
        icon={ListOrdered}
        label="Numbered list"
        active={state.ordered}
        onClick={() => run().toggleOrderedList().run()}
      />
    </BubbleMenu>
  );
}

/** The equation being written: a new one replacing [from, to), or the one at `pos`. */
type EquationEdit =
  | { kind: "new"; latex: string; from: number; to: number }
  | { kind: "existing"; latex: string; pos: number; block: boolean };

/**
 * A WYSIWYG text box: select text to bold, italicize, underline, raise or lower it, make
 * a list, or turn it into an equation. The Σ button in the corner inserts an equation.
 * `value` may be editor HTML or plain text; changes come back as HTML ("" when emptied).
 */
export function RichTextEditor({
  value,
  onChange,
  disabled = false,
  className,
}: {
  value: string | undefined;
  onChange: (html: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [equation, setEquation] = useState<EquationEdit | null>(null);
  // Clicking an equation opens it for editing; the extension is set up once, so it calls through a ref.
  const openExisting = useRef<(latex: string, pos: number, block: boolean) => void>(() => {});
  openExisting.current = (latex, pos, block) => {
    if (!disabled) setEquation({ kind: "existing", latex, pos, block });
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        code: false,
        blockquote: false,
        horizontalRule: false,
        strike: false,
        link: false,
        // It adds an empty line after a list or equation on the first click, which reads as an edit.
        trailingNode: false,
      }),
      Superscript,
      Subscript,
      Mathematics.configure({
        inlineOptions: { onClick: (node, pos) => openExisting.current(node.attrs.latex, pos, false) },
        blockOptions: { onClick: (node, pos) => openExisting.current(node.attrs.latex, pos, true) },
        katexOptions: { throwOnError: false },
      }),
    ],
    content: toHtml(value),
    editable: !disabled,
    editorProps: { attributes: { class: "rich-text min-h-20 px-3 py-2 text-sm outline-none" } },
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? "" : e.getHTML()),
  });

  // Text changed from outside, e.g. a ChatGPT fill or Undo: show it unless the teacher is typing here.
  useEffect(() => {
    if (!editor || editor.isFocused) return;
    const next = toHtml(value);
    if (next !== (editor.isEmpty ? "" : editor.getHTML())) editor.commands.setContent(next, { emitUpdate: false });
  }, [editor, value]);

  // No update event: it would send the stored text back as HTML and mark an untouched page as changed.
  useEffect(() => {
    editor?.setEditable(!disabled, false);
  }, [editor, disabled]);

  // A new equation from the selection (its text becomes the LaTeX) or at the cursor.
  const newEquation = () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    setEquation({ kind: "new", latex: editor.state.doc.textBetween(from, to, " "), from, to });
  };

  const saveEquation = (latex: string) => {
    if (!editor || !equation) return;
    if (equation.kind === "existing") {
      const chain = editor.chain().focus();
      (equation.block
        ? chain.updateBlockMath({ pos: equation.pos, latex })
        : chain.updateInlineMath({ pos: equation.pos, latex })
      ).run();
    } else {
      editor
        .chain()
        .focus()
        .insertContentAt({ from: equation.from, to: equation.to }, { type: "inlineMath", attrs: { latex } })
        .run();
    }
  };

  const deleteEquation = () => {
    if (!editor || equation?.kind !== "existing") return;
    const chain = editor.chain().focus();
    (equation.block
      ? chain.deleteBlockMath({ pos: equation.pos })
      : chain.deleteInlineMath({ pos: equation.pos })
    ).run();
  };

  return (
    <div
      className={cn(
        "group/rte relative rounded-md border border-input bg-transparent shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      {editor && !disabled && <Toolbar editor={editor} onEquation={newEquation} />}
      <EditorContent editor={editor} />
      {!disabled && (
        <button
          type="button"
          title="Insert an equation"
          aria-label="Insert an equation"
          onMouseDown={(e) => e.preventDefault()}
          onClick={newEquation}
          className="absolute right-1 bottom-1 flex size-6 items-center justify-center rounded-md bg-background/90 text-muted-foreground opacity-0 transition-opacity group-focus-within/rte:opacity-100 group-hover/rte:opacity-100 hover:bg-muted hover:text-foreground"
        >
          <Sigma className="size-3.5" />
        </button>
      )}
      <EquationDialog
        open={!!equation}
        latex={equation?.latex ?? ""}
        editing={equation?.kind === "existing"}
        onOpenChange={(open) => !open && setEquation(null)}
        onSave={saveEquation}
        onDelete={deleteEquation}
      />
    </div>
  );
}
