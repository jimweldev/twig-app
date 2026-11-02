import type { CertificateImage } from "@/lib/db";

/** Longest side kept: A4 at 300 dpi. Bigger photos are scaled down so the database stays small. */
const MAX_SIDE = 3508;

export const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That file could not be opened as an image."));
    img.src = src;
  });

export const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });

/** A rectangle of the image in its own pixels. */
export interface PixelArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Cuts `area` out of the image and scales it down to at most MAX_SIDE, as a data: URL
 * with its pixel size. PNG keeps transparency and crisp text; photos become JPG to stay small.
 */
export async function cropCertificateImage(src: string, area: PixelArea, png: boolean): Promise<CertificateImage> {
  const img = await loadImage(src);
  const scale = Math.min(1, MAX_SIDE / Math.max(area.width, area.height));
  const width = Math.max(1, Math.round(area.width * scale));
  const height = Math.max(1, Math.round(area.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, width, height);
  return { image: canvas.toDataURL(png ? "image/png" : "image/jpeg", 0.92), width, height };
}

/** Checks the file is an image and reads it for cropping. */
export async function openCertificateFile(file: File): Promise<{ src: string; png: boolean }> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file (PNG or JPG).");
  return { src: await readAsDataUrl(file), png: file.type === "image/png" };
}

/** "Honor Certificate.png" -> "Honor Certificate" */
export const templateNameFromFile = (file: File) => file.name.replace(/\.[^.]+$/, "").trim() || "Certificate";
