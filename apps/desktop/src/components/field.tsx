import { useId, type ReactElement } from "react";
import { cloneElement } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "cn";

/** A red * after a required field's label. */
export const RequiredMark = () => (
  <span className="-ml-1.5 text-destructive" aria-hidden>
    *
  </span>
);

/** Label + control; wires the label to the control's id. */
export function Field({
  label,
  hint,
  required,
  className,
  children,
}: {
  label: string;
  hint?: string;
  /** Marks the label with a red * and the control as required. */
  required?: boolean;
  className?: string;
  children: ReactElement<{ id?: string; "aria-required"?: boolean }>;
}) {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required && <RequiredMark />}
      </Label>
      {cloneElement(children, required ? { id, "aria-required": true } : { id })}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
