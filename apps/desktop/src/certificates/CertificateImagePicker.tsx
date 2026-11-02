import { useRef, useState, type ReactNode } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Crop, Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "cn";
import { useSchool } from "@/app/school";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CertificateImage } from "@/lib/db";
import { cropCertificateImage, loadImage, openCertificateFile } from "./image";

/** Crop shapes: the image's own, or a paper size either way round (width / height). */
const SHAPES: { label: string; ratio: number | "original" }[] = [
  { label: "Original", ratio: "original" },
  { label: "A4 landscape", ratio: 11.69 / 8.27 },
  { label: "A4 portrait", ratio: 8.27 / 11.69 },
  { label: "Letter landscape", ratio: 11 / 8.5 },
  { label: "Letter portrait", ratio: 8.5 / 11 },
  { label: "Long bond landscape", ratio: 13 / 8.5 },
  { label: "Long bond portrait", ratio: 8.5 / 13 },
];

const MAX_ZOOM = 4;

interface Picked {
  file: File;
  src: string;
  png: boolean;
  /** The image's own width / height, for "Original". */
  ratio: number;
}

/**
 * A button that picks a design image, lets the teacher crop it to its own shape or a
 * paper shape (drag to move, zoom to tighten), then hands back the cropped image.
 */
export function CertificateImagePicker({
  children,
  variant,
  onImage,
}: {
  children: ReactNode;
  variant?: "default" | "outline";
  onImage: (img: CertificateImage, file: File) => void | Promise<void>;
}) {
  const { onError } = useSchool();
  const input = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [shape, setShape] = useState(SHAPES[0]);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  // The chosen area in the image's own pixels, reported by the cropper as it moves.
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  const choose = (s: (typeof SHAPES)[number]) => {
    setShape(s);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const open = async (file: File) => {
    try {
      const opened = await openCertificateFile(file);
      const img = await loadImage(opened.src);
      choose(SHAPES[0]);
      setArea(null);
      setPicked({ file, ...opened, ratio: img.naturalWidth / img.naturalHeight });
    } catch (e) {
      onError(e);
    }
  };

  const use = async () => {
    if (!picked || !area) return;
    setBusy(true);
    try {
      await onImage(await cropCertificateImage(picked.src, area, picked.png), picked.file);
      setPicked(null);
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) open(file);
        }}
      />
      <Button variant={variant} onClick={() => input.current?.click()}>
        {children}
      </Button>

      <Dialog open={picked !== null} onOpenChange={(o) => !o && !busy && setPicked(null)}>
        {/* No zoom-in animation: the cropper measures its box as it opens, and a scaled
            dialog makes the crop frame come out smaller than the image. */}
        <DialogContent className="w-[92vw] max-w-none animate-none! sm:max-w-none">
          <DialogHeader>
            <DialogTitle>Crop the design</DialogTitle>
            <DialogDescription>
              Pick a shape, drag the image to place it, and zoom in to crop tighter. Original keeps the whole image.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-1.5">
            {SHAPES.map((s) => (
              <button
                key={s.label}
                type="button"
                aria-pressed={shape === s}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs",
                  shape === s ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
                onClick={() => choose(s)}
              >
                {s.label}
              </button>
            ))}
          </div>
          {picked && (
            <div className="relative h-[70vh] overflow-hidden rounded-md bg-neutral-900">
              <Cropper
                image={picked.src}
                crop={crop}
                zoom={zoom}
                maxZoom={MAX_ZOOM}
                aspect={shape.ratio === "original" ? picked.ratio : shape.ratio}
                objectFit="contain"
                showGrid
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, pixels) => setArea(pixels)}
              />
            </div>
          )}
          <div className="flex items-center gap-3">
            <ZoomOut className="size-4 shrink-0 text-muted-foreground" />
            <input
              type="range"
              aria-label="Zoom"
              min={1}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              className="flex-1 accent-primary"
              onChange={(e) => setZoom(Number(e.target.value))}
            />
            <ZoomIn className="size-4 shrink-0 text-muted-foreground" />
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setPicked(null)}>
              Cancel
            </Button>
            <Button disabled={busy || !area} onClick={use}>
              {busy ? <Loader2 className="animate-spin" /> : <Crop />} Use this
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
