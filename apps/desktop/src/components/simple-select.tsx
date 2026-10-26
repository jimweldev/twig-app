import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GRADE_LEVELS, gradeLabel } from "@/ecr/levels";

export interface Option {
  value: string;
  label: string;
}

/** Select from a flat option list; `id` goes to the trigger so a Field label can point at it. */
export function SimpleSelect({
  id,
  value,
  onValueChange,
  options,
  placeholder,
  className = "w-full",
  disabled,
}: {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger id={id} className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export const GRADE_OPTIONS: Option[] = GRADE_LEVELS.map((g) => ({
  value: String(g),
  label: gradeLabel(g),
}));
