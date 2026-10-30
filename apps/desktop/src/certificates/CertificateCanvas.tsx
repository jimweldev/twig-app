import { useRef, type CSSProperties, type PointerEvent } from "react";
import { cn } from "cn";
import type { CertificateTemplate } from "@/lib/db";
import {
  fieldText,
  fitSizePct,
  measureEm,
  SAMPLE_CONTEXT,
  SAMPLE_LEARNER,
  type CertContext,
  type CertField,
  type CertLearner,
} from "./fields";

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * The certificate: the uploaded design with each field drawn on top. Text is sized
 * in container width units, so the same markup works as a thumbnail, in the
 * designer and on the printed page. Pass `onChange` to make the fields draggable.
 */
export function CertificateCanvas({
  template,
  fields = template.fields,
  learner = SAMPLE_LEARNER,
  context = SAMPLE_CONTEXT,
  selectedId,
  onSelect,
  onChange,
  className,
  style,
}: {
  template: Pick<CertificateTemplate, "image" | "width" | "height" | "fields">;
  fields?: CertField[];
  learner?: CertLearner;
  context?: CertContext;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onChange?: (id: string, patch: Partial<CertField>) => void;
  className?: string;
  style?: CSSProperties;
}) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const aspect = template.width / template.height;
  const editable = !!onChange;

  // Tracks a pointer drag as a change in % of the page.
  const drag = (e: PointerEvent, apply: (dxPct: number, dyPct: number) => void) => {
    const surface = surfaceRef.current;
    if (!surface) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = surface.getBoundingClientRect();
    const target = e.currentTarget as HTMLElement;
    const [x0, y0] = [e.clientX, e.clientY];
    target.setPointerCapture(e.pointerId);
    const move = (ev: globalThis.PointerEvent) =>
      apply(((ev.clientX - x0) / rect.width) * 100, ((ev.clientY - y0) / rect.height) * 100);
    const up = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
  };

  return (
    <div
      ref={surfaceRef}
      className={cn("relative overflow-hidden bg-white select-none", className)}
      style={{ aspectRatio: `${template.width} / ${template.height}`, containerType: "inline-size", ...style }}
      onPointerDown={() => editable && onSelect?.(null)}
    >
      <img src={template.image} alt="" draggable={false} className="pointer-events-none absolute inset-0 size-full" />
      {fields.map((f) => {
        const text = fieldText(f, learner, context);
        const selected = editable && selectedId === f.id;
        return (
          <div
            key={f.id}
            className={cn(
              "absolute",
              editable && "cursor-move rounded-[2px] outline-1 outline-sky-500/60 outline-dashed hover:outline-sky-500",
              selected && "outline-2 outline-sky-500 outline-solid",
            )}
            style={{
              left: `${f.xPct}%`,
              top: `${f.yPct}%`,
              width: `${f.widthPct}%`,
              transform: "translateY(-50%)",
              fontFamily: f.font,
              fontWeight: f.bold ? 700 : 400,
              fontStyle: f.italic ? "italic" : "normal",
              // Stored as % of page height; cqw is % of page width.
              fontSize: `${fitSizePct(f, aspect, measureEm(f, text)) / aspect}cqw`,
              color: f.color,
              textAlign: f.align,
              lineHeight: 1.15,
              whiteSpace: "nowrap",
            }}
            onPointerDown={(e) => {
              if (!editable) return;
              onSelect?.(f.id);
              const { xPct, yPct } = f;
              drag(e, (dx, dy) =>
                onChange(f.id, { xPct: clamp(xPct + dx, 0, 100 - f.widthPct), yPct: clamp(yPct + dy, 0, 100) }),
              );
            }}
          >
            {text}
            {selected &&
              (["left", "right"] as const).map((side) => (
                <span
                  key={side}
                  title="Drag to resize the box"
                  className={cn(
                    "absolute top-1/2 size-3 -translate-y-1/2 cursor-ew-resize rounded-full border-2 border-white bg-sky-500 shadow",
                    side === "left" ? "-left-1.5" : "-right-1.5",
                  )}
                  onPointerDown={(e) => {
                    const { xPct, widthPct } = f;
                    drag(e, (dx) => {
                      if (side === "right") {
                        onChange(f.id, { widthPct: clamp(widthPct + dx, 5, 100 - xPct) });
                      } else {
                        const x = clamp(xPct + dx, 0, xPct + widthPct - 5);
                        onChange(f.id, { xPct: x, widthPct: xPct + widthPct - x });
                      }
                    });
                  }}
                />
              ))}
          </div>
        );
      })}
    </div>
  );
}
