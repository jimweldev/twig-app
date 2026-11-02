import { useState } from "react";
import { cn } from "cn";
import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";

/**
 * Who teaches a subject: you, or another teacher by name. `value` is blank for you.
 */
export function TeacherPicker({ value, onChange }: { value: string; onChange: (teacher: string) => void }) {
  // "Another teacher" stays picked while the name is still being typed.
  const [other, setOther] = useState(value !== "");
  const choice = (label: string, active: boolean, onClick: () => void) => (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "flex-1 rounded-md border px-3 py-1.5 text-sm",
        active ? "border-primary bg-primary/10 font-medium text-primary" : "hover:bg-muted/60",
      )}
      onClick={onClick}
    >
      {label}
    </button>
  );

  return (
    <Field label="Who teaches it?">
      <div>
        <div className="flex gap-2">
          {choice("Me", !other, () => {
            setOther(false);
            onChange("");
          })}
          {choice("Another teacher", other, () => setOther(true))}
        </div>
        {other && (
          <Input
            autoFocus
            className="mt-2"
            placeholder="Teacher's name"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      </div>
    </Field>
  );
}

/** "You" or the teacher's name, for labels. */
export const teacherLabel = (teacher: string) => teacher.trim() || "You";
