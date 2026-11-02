import Select from "react-select";
import CreatableSelect from "react-select/creatable";
import { cn } from "cn";
import { GRADE_LEVELS, gradeLabel } from "@/ecr/levels";

export interface Option {
  value: string;
  label: string;
}

/** Long lists get a search box; short ones open like a plain menu. */
const SEARCH_FROM = 8;

/**
 * Select from a flat option list (react-select, styled to match the app).
 * `id` goes to the input so a Field label can point at it. With `creatable`, a value typed
 * that isn't in the list can be used too.
 */
export function SimpleSelect({
  id,
  value,
  onValueChange,
  options,
  placeholder = "Choose…",
  className = "w-full",
  disabled,
  creatable = false,
}: {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  creatable?: boolean;
}) {
  const Component = creatable ? CreatableSelect : Select;
  return (
    <Component<Option, false>
      inputId={id}
      className={className}
      unstyled
      isDisabled={disabled}
      isSearchable={creatable || options.length >= SEARCH_FROM}
      options={options}
      value={options.find((o) => o.value === value) ?? (creatable && value ? { value, label: value } : null)}
      onChange={(o) => o && onValueChange(o.value)}
      {...(creatable && {
        formatCreateLabel: (input: string) => `Use "${input.trim()}"`,
        isValidNewOption: (input: string) => !!input.trim(),
        getNewOptionData: (input: string) => ({ value: input.trim(), label: input.trim() }),
      })}
      placeholder={placeholder}
      noOptionsMessage={() => "No matches"}
      menuPlacement="auto"
      // Drawn on top of the page so cards and dialogs can't clip it. It follows the field
      // while open and closes when the page scrolls, not when its own list scrolls.
      menuPortalTarget={document.body}
      menuPosition="fixed"
      closeMenuOnScroll={(e) => !(e.target instanceof Element && e.target.closest(".select-menu-portal"))}
      // react-select sets z-index 1 inline; dialogs sit at 50, so the menu must go above them.
      styles={{ menuPortal: (base) => ({ ...base, zIndex: 60 }) }}
      classNames={{
        menuPortal: () => "select-menu-portal pointer-events-auto",
        control: ({ isFocused, isDisabled }) =>
          cn(
            "min-h-8! cursor-pointer rounded-md border border-input bg-transparent px-2.5 text-sm shadow-xs transition-[color,box-shadow] dark:bg-input/30",
            isFocused && "border-ring ring-3 ring-ring/50",
            isDisabled && "cursor-not-allowed opacity-50",
          ),
        valueContainer: () => "gap-1",
        placeholder: () => "text-muted-foreground",
        indicatorsContainer: () => "text-muted-foreground",
        dropdownIndicator: ({ selectProps }) =>
          cn("transition-transform [&_svg]:size-4", selectProps.menuIsOpen && "rotate-180"),
        indicatorSeparator: () => "hidden",
        menu: () => "z-50 mt-1 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
        menuList: () => "max-h-64",
        option: ({ isFocused, isSelected }) =>
          cn(
            "cursor-pointer rounded-sm px-2 py-1.5 text-sm",
            isFocused && "bg-accent text-accent-foreground",
            isSelected && "font-medium text-primary",
          ),
        noOptionsMessage: () => "px-2 py-1.5 text-sm text-muted-foreground",
      }}
    />
  );
}

export const GRADE_OPTIONS: Option[] = GRADE_LEVELS.map((g) => ({
  value: String(g),
  label: gradeLabel(g),
}));
