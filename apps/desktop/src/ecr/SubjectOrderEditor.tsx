import { DragDropProvider } from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import { GripVertical } from "lucide-react";
import type { AreaSource } from "./useSectionGrades";

const move = <T,>(list: T[], from: number, to: number) => {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

function SubjectRow({ area, index }: { area: string; index: number }) {
  const { ref, isDragging } = useSortable({ id: area, index });

  return (
    <li
      ref={ref}
      title="Drag to reorder"
      className={`flex cursor-grab touch-none items-center gap-2 rounded-md border bg-card px-2 py-1.5 text-sm shadow-xs select-none active:cursor-grabbing ${
        isDragging ? "z-10 border-primary shadow-md ring-2 ring-primary/30" : "border-input hover:bg-muted/50"
      }`}
    >
      <GripVertical className="size-4 text-muted-foreground" />
      <span className="w-4 text-right text-xs text-muted-foreground tabular-nums">{index + 1}</span>
      <span className="min-w-0 flex-1 truncate font-medium">{area}</span>
    </li>
  );
}

/** Reorders a section's learning areas by dragging. */
export function SubjectOrderEditor({
  areas,
  onChange,
}: {
  areas: AreaSource[];
  onChange: (order: string[]) => void;
}) {
  const names = areas.map((a) => a.area);

  return (
    <DragDropProvider
      onDragEnd={(event) => {
        if (event.canceled) return;
        const { source } = event.operation;
        if (isSortable(source) && source.initialIndex !== source.index) {
          onChange(move(names, source.initialIndex, source.index));
        }
      }}
    >
      <ol className="flex flex-col gap-1.5">
        {names.map((area, i) => (
          <SubjectRow key={area} area={area} index={i} />
        ))}
      </ol>
    </DragDropProvider>
  );
}
