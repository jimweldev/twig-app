// Downloads pages as a PDF instead of printing: the page renders its print-only root,
// then WebView2 writes it to a file with no header or footer (see src-tauri/src/pdf.rs).

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { toast } from "sonner";
import { FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Page size and margins in inches. */
export interface PdfPage {
  widthIn: number;
  heightIn: number;
  marginIn?: number;
}

export const A4_PORTRAIT: PdfPage = { widthIn: 8.27, heightIn: 11.69 };

/** File names can't hold some characters Windows reserves. */
export const safeFileName = (name: string) => name.replace(/[\\/:*?"<>|]+/g, "-").trim();

/**
 * Asks where to save, renders `pages` into the print root, waits for images, then
 * writes the PDF, then says so in a toast with a button to show the file.
 */
export function usePdfDownload(onError: (e: unknown) => void) {
  const [job, setJob] = useState<{ path: string; page: PdfPage } | null>(null);

  useEffect(() => {
    if (!job) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const imgs = [...document.querySelectorAll<HTMLImageElement>("#print-root img")];
      await Promise.all(imgs.map((img) => img.decode().catch(() => undefined)));
      // Equation fonts (KaTeX) load on first use; the PDF must wait for them too.
      await document.fonts.ready;
      if (cancelled) return;
      try {
        await invoke("save_pdf", {
          path: job.path,
          widthIn: job.page.widthIn,
          heightIn: job.page.heightIn,
          marginIn: job.page.marginIn ?? 0,
        });
        const path = job.path;
        // The button sits under the file name, which can be long.
        toast.success("PDF saved", {
          description: (
            <div className="flex flex-col items-start gap-2">
              <span className="break-all">{path.split(/[\\/]/).pop()}</span>
              <Button size="sm" onClick={() => revealItemInDir(path).catch(onError)}>
                <FolderOpen /> Show in folder
              </Button>
            </div>
          ),
        });
      } catch (e) {
        onError(e);
      } finally {
        setJob(null);
      }
    }, 50);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [job, onError]);

  const download = async (fileName: string, page: PdfPage) => {
    try {
      const path = await save({
        defaultPath: `${safeFileName(fileName)}.pdf`,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (!path) return;
      setJob({ path, page });
    } catch (e) {
      onError(e);
    }
  };

  return { download, downloading: job !== null, page: job?.page ?? null };
}

/**
 * The print-only root the PDF is made from, mounted while a download runs. `pageCss`
 * adds page rules, e.g. page breaks between certificates.
 */
export function PdfRoot({
  page,
  pageCss = "",
  children,
}: {
  page: PdfPage | null;
  pageCss?: string;
  children: ReactNode;
}) {
  if (!page) return null;
  return createPortal(
    <div id="print-root">
      <style>{`@media print {
        @page { size: ${page.widthIn}in ${page.heightIn}in; margin: ${page.marginIn ?? 0}in; }
        body > *:not(#print-root) { display: none !important; }
        ${pageCss}
      }`}</style>
      {children}
    </div>,
    document.body,
  );
}
