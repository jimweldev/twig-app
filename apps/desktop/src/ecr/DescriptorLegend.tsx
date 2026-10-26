import { descriptor, DESCRIPTOR_SCALE, PASSING_GRADE, type Descriptor } from "./grading";

const COLORS: Record<Descriptor, string> = {
  Advancing: "bg-emerald-100 text-emerald-800",
  Benchmarking: "bg-sky-100 text-sky-800",
  Connecting: "bg-teal-50 text-teal-800",
  Developing: "bg-amber-100 text-amber-800",
  Emerging: "bg-red-100 text-red-800",
};

/** A grade's descriptor as a colored pill, matching the legend. */
export function DescriptorBadge({ grade }: { grade: number }) {
  const d = descriptor(grade);
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${COLORS[d]}`}>{d}</span>;
}

/** Key to the grade descriptors (DO 015, s. 2026). */
export function DescriptorLegend({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground ${className}`}>
      <span className="font-medium text-foreground">Descriptors:</span>
      {DESCRIPTOR_SCALE.map((d) => (
        <span key={d.name} className="flex items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 font-medium ${COLORS[d.name]}`}>{d.name}</span>
          <span className="tabular-nums">{d.range}</span>
        </span>
      ))}
      <span>· Passing grade: {PASSING_GRADE}</span>
    </div>
  );
}
