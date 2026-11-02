import { useEffect, useRef, useState } from "react";
import { ImagePlus, Pencil, RotateCcw, Settings, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loadImage, readAsDataUrl } from "@/certificates/image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getLessonFooter, saveLessonFooter, type LessonFooter } from "@/lib/db";

/** Tallest a footer image is kept, in pixels: sharp at its printed 0.6 in, small in the database. */
const MAX_HEIGHT = 300;

/** Reads a picked file and scales it down, keeping PNG transparency. */
async function footerImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file (PNG or JPG).");
  const img = await loadImage(await readAsDataUrl(file));
  const scale = Math.min(1, MAX_HEIGHT / img.naturalHeight);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return file.type === "image/png" ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.92);
}

function Side({
  label,
  images,
  onChange,
  onError,
}: {
  label: string;
  images: string[];
  /** Left out to only show the images. */
  onChange?: (images: string[]) => void;
  onError: (e: unknown) => void;
}) {
  const input = useRef<HTMLInputElement>(null);

  const add = async (files: FileList | null) => {
    try {
      const added = await Promise.all([...(files ?? [])].map(footerImage));
      if (added.length) onChange?.([...images, ...added]);
    } catch (e) {
      onError(e);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex min-h-16 flex-wrap items-center gap-2 rounded-lg border border-dashed p-2">
        {images.map((src, i) => (
          <div key={i} className="group relative">
            <img src={src} alt="" className="h-12 w-auto rounded border bg-white object-contain" />
            {onChange && (
              <button
                type="button"
                title="Remove this image"
                onClick={() => onChange(images.filter((_, j) => j !== i))}
                className="absolute -top-1.5 -right-1.5 hidden size-5 items-center justify-center rounded-full bg-foreground text-background group-hover:flex"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        ))}
        {onChange ? (
          <Button variant="outline" size="sm" onClick={() => input.current?.click()}>
            <ImagePlus /> Add image
          </Button>
        ) : (
          images.length === 0 && <span className="text-xs text-muted-foreground">None</span>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg"
        multiple
        hidden
        onChange={(e) => {
          add(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/** The left and right image pickers, side by side. */
function FooterSides({
  footer,
  onChange,
  onError,
}: {
  footer: LessonFooter;
  /** Left out to only show the images. */
  onChange?: (footer: LessonFooter) => void;
  onError: (e: unknown) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Side
        label="Left"
        images={footer.left}
        onChange={onChange && ((left) => onChange({ ...footer, left }))}
        onError={onError}
      />
      <Side
        label="Right"
        images={footer.right}
        onChange={onChange && ((right) => onChange({ ...footer, right }))}
        onError={onError}
      />
    </div>
  );
}

/** A Settings button for the lesson plans list: sets the footer images every lesson plan prints with. */
export function LessonPlanSettingsButton({ onError }: { onError: (e: unknown) => void }) {
  const [open, setOpen] = useState(false);
  const [footer, setFooter] = useState<LessonFooter | null>(null);

  useEffect(() => {
    if (open) getLessonFooter().then(setFooter, onError);
  }, [open, onError]);

  const change = (next: LessonFooter) => {
    setFooter(next);
    saveLessonFooter(next).catch(onError);
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Settings /> Settings
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Lesson plan settings</DialogTitle>
            <DialogDescription>
              Footer images print at the bottom of every page of every lesson plan, e.g. your school and DepEd logos.
              Changes save right away.
            </DialogDescription>
          </DialogHeader>
          {footer && <FooterSides footer={footer} onChange={change} onError={onError} />}
          <DialogFooter>
            <Button onClick={() => setOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * The footer images of one lesson plan: the default footer until the teacher gives
 * this plan its own, which is saved with the plan.
 */
export function LessonFooterCard({
  own,
  fallback,
  onChange,
  onError,
}: {
  /** This plan's own footer, if it has one. */
  own: LessonFooter | undefined;
  /** The default footer, printed when the plan has none of its own. */
  fallback: LessonFooter;
  onChange: (own: LessonFooter | undefined) => void;
  onError: (e: unknown) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Footer images</CardTitle>
        <CardDescription>
          {own
            ? "This plan's own footer, printed at the bottom of every page."
            : "This plan uses the default footer. Change the default in Lesson plans › Settings."}
        </CardDescription>
        <CardAction>
          {own ? (
            <Button variant="outline" size="sm" onClick={() => onChange(undefined)}>
              <RotateCcw /> Use the default
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => onChange(fallback)}>
              <Pencil /> Change for this plan
            </Button>
          )}
        </CardAction>
      </CardHeader>
      <CardContent>
        {own ? (
          <FooterSides footer={own} onChange={onChange} onError={onError} />
        ) : (
          <FooterSides footer={fallback} onError={onError} />
        )}
      </CardContent>
    </Card>
  );
}
