// Writes latest.json for the Tauri updater from the release installers and
// their updater signatures (<installer>.sig, made by `tauri signer sign`).
//
// usage: node latest-json.mjs <version> <installers dir> <signatures dir> <out file>
// The app reads it from https://github.com/<repo>/releases/latest/download/latest.json.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [version, installersDir, sigDir, out] = process.argv.slice(2);
const repo = process.env.GITHUB_REPOSITORY ?? "jimweldev/twig-app";
const files = readdirSync(installersDir);

const entry = (suffix) => {
  const name = files.find((f) => f.endsWith(suffix));
  if (!name) throw new Error(`No installer ending in ${suffix} in ${installersDir}`);
  return {
    signature: readFileSync(join(sigDir, `${name}.sig`), "utf8").trim(),
    url: `https://github.com/${repo}/releases/download/v${version}/${encodeURIComponent(name)}`,
  };
};

const nsis = entry("-setup.exe");
const msi = entry(".msi");

writeFileSync(
  out,
  JSON.stringify(
    {
      version,
      notes: `TWIG ${version}. See https://github.com/${repo}/releases/tag/v${version}`,
      pub_date: new Date().toISOString(),
      // Each install type updates with its own installer; plain windows-x86_64 is the fallback.
      platforms: {
        "windows-x86_64": nsis,
        "windows-x86_64-nsis": nsis,
        "windows-x86_64-msi": msi,
      },
    },
    null,
    2,
  ),
);
console.log(`Wrote ${out} for v${version}`);
