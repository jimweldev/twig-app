import { useEffect, useState } from "react";

export const REPO = "jimweldev/twig-app";
export const RELEASES_URL = `https://github.com/${REPO}/releases`;

export interface Download {
  version: string;
  publishedAt: string;
  /** Windows installer: the NSIS setup .exe, else the .msi. */
  installer: { name: string; url: string; size: number } | null;
}

interface GitHubAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

/** Latest published release from GitHub; null while loading or if there is none yet. */
export function useLatestRelease() {
  const [release, setRelease] = useState<Download | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "none">("loading");

  useEffect(() => {
    fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: { tag_name: string; published_at: string; assets: GitHubAsset[] }) => {
        const asset =
          data.assets.find((a) => a.name.endsWith("-setup.exe")) ?? data.assets.find((a) => a.name.endsWith(".msi"));
        setRelease({
          version: data.tag_name.replace(/^v/, ""),
          publishedAt: data.published_at,
          installer: asset ? { name: asset.name, url: asset.browser_download_url, size: asset.size } : null,
        });
        setStatus("ready");
      })
      .catch(() => setStatus("none"));
  }, []);

  return { release, status };
}

export const formatSize = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
