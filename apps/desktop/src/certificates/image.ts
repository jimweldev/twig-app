import type { CertificateImage } from "@/lib/db";

/** Longest side kept: A4 at 300 dpi. Bigger photos are scaled down so the database stays small. */
const MAX_SIDE = 3508;

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That file could not be opened as an image."));
    img.src = src;
  });

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });

/** Reads an uploaded design into a data: URL with its pixel size. */
export async function readCertificateImage(file: File): Promise<CertificateImage> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file (PNG or JPG).");
  const dataUrl = await readAsDataUrl(file);
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  if (scale === 1) return { image: dataUrl, width: img.naturalWidth, height: img.naturalHeight };

  const width = Math.round(img.naturalWidth * scale);
  const height = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
  // PNG keeps transparency and crisp text; photos become JPG to stay small.
  const type = file.type === "image/png" ? "image/png" : "image/jpeg";
  return { image: canvas.toDataURL(type, 0.92), width, height };
}

/** "Honor Certificate.png" -> "Honor Certificate" */
export const templateNameFromFile = (file: File) => file.name.replace(/\.[^.]+$/, "").trim() || "Certificate";
