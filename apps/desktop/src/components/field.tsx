import { useId, type ReactElement } from "react";
import { cloneElement } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "cn";

/** Label + control; wires the label to the control's id. */
export function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: ReactElement<{ id?: string }>;
}) {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {cloneElement(children, { id })}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
