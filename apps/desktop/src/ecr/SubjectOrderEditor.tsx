import { DragDropProvider } from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import { ArrowDown, ArrowUp, GripVertical, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { orderedAreas } from "./grading";
import type { AreaSource } from "./useSectionGrades";

const move = <T,>(list: T[], from: number, to: number) => {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

function SubjectRow({
  area,
  index,
  count,
  onMove,
}: {
  area: string;
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
}) {
  const { ref, handleRef, isDragging } = useSortable({ id: area, index });

  return (
    <li
      ref={ref}
      className={`flex items-center gap-2 rounded-md border bg-card px-2 py-1.5 text-sm shadow-xs ${
        isDragging ? "z-10 border-primary shadow-md ring-2 ring-primary/30" : "border-input"
      }`}
    >
      <button
        ref={handleRef}
        type="button"
        title="Drag to reorder"
        className="cursor-grab touch-none rounded p-0.5 text-muted-foreground hover:bg-muted active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>
      <span className="w-4 text-right text-xs text-muted-foreground tabular-nums">{index + 1}</span>
      <span className="min-w-0 flex-1 truncate font-medium">{area}</span>
      <Button variant="ghost" size="icon-xs" title="Move up" disabled={index === 0} onClick={() => onMove(index, index - 1)}>
        <ArrowUp />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        title="Move down"
        disabled={index === count - 1}
        onClick={() => onMove(index, index + 1)}
      >
        <ArrowDown />
      </Button>
    </li>
  );
}

/** Reorders a section's learning areas by dragging the handle or with the arrow buttons. */
export function SubjectOrderEditor({
  grade,
  areas,
  onChange,
}: {
  grade: number;
  areas: AreaSource[];
  onChange: (order: string[]) => void;
}) {
  const names = areas.map((a) => a.area);
  // Default order, limited to the subjects shown.
  const defaultOrder = orderedAreas(grade).filter((a) => names.includes(a));
  const isDefault = names.join("|") === defaultOrder.join("|");
  const moveTo = (from: number, to: number) => onChange(move(names, from, to));

  return (
    <div>
      <DragDropProvider
        onDragEnd={(event) => {
          if (event.canceled) return;
          const { source } = event.operation;
          if (isSortable(source) && source.initialIndex !== source.index) {
            moveTo(source.initialIndex, source.index);
          }
        }}
      >
        <ol className="flex flex-col gap-1.5">
          {names.map((area, i) => (
            <SubjectRow key={area} area={area} index={i} count={names.length} onMove={moveTo} />
          ))}
        </ol>
      </DragDropProvider>
      <Button variant="ghost" size="sm" className="mt-2" disabled={isDefault} onClick={() => onChange(defaultOrder)}>
        <RotateCcw /> Reset to report card order
      </Button>
    </div>
  );
}
