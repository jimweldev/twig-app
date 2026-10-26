# TWIG

Monorepo: Tauri v2 desktop app + React web showcase. Both use React, Vite, and Tailwind CSS v4.

## Layout

- `apps/desktop` — Tauri v2 desktop app: E-Class Record (React + TypeScript + Vite + Tailwind + shadcn/ui, local SQLite)
- `apps/web` — web showcase site for TWIG (React + TypeScript + Vite + Tailwind)
- `packages/` — shared packages (empty for now)

## Commands

```bash
npm install              # install all workspaces
npm run dev:desktop      # run desktop app (Tauri dev)
npm run dev:desktop:web  # run only the desktop frontend in the browser
npm run dev:web          # run the web showcase
npm run build:web        # build the web showcase
npm run build:desktop    # build desktop installer
npm test                 # run grading tests
```

## Website and releases

- **Download site:** https://jimweldev.github.io/twig-app/ — built from `apps/web` and published by `.github/workflows/website.yml` on every push to `main` that touches it.
- **Windows installer:** `.github/workflows/release.yml` builds it and attaches it to a GitHub Release. Bump the version in `apps/desktop/src-tauri/tauri.conf.json`, then push a matching tag:

  ```bash
  git tag v0.1.0
  git push origin v0.1.0
  ```

  The site always links to the latest release. Installers are signed through SignPath once set up — see [CODE_SIGNING.md](CODE_SIGNING.md).

## Databases

The desktop app keeps its data in SQLite under `%APPDATA%\com.twig.desktop\`:

- `twig-dev.db` — used by `npm run dev:desktop` (debug builds). Safe to wipe while testing. The sidebar shows a **DEV** badge.
- `twig.db` — used by the installed app from `npm run build:desktop` (release builds).

Rust picks the file (`DB_URL` in `src-tauri/src/lib.rs`) and runs migrations on it; the frontend asks Rust for it via the `db_url` command.

## Sending grades (offline)

TWIG never goes online. Subject teachers send grades to the section adviser as a file:

1. Subject teacher: open the class record, click **Send grades**, save the `.twig` file (optional password).
2. Send the file any way: Messenger, email, USB.
3. Adviser: **Sections → section → Import grades**. Learners are matched by LRN, then by full name.
4. The section's **Grades** tab shows every learning area, which are still missing, and the general average.

The file holds term and final grades only (no raw scores) plus a SHA-256 checksum that rejects damaged or edited files. With a password it is encrypted (PBKDF2 + AES-GCM).

## Known gaps (E-Class Record)

Rules follow DepEd Order No. 015, s. 2026 as reported by secondary sources; verify against the official issuance.

- **MAPEH components.** Under MATATAG and DO 015, MAPEH has two components: Music and Arts, and PE and Health. Each is graded with its own WW/PT/Exam (20/60/20) and the MAPEH grade is their average. TWIG currently grades MAPEH as one learning area. Not yet confirmed whether the components are averaged per term or at the final grade.
- **GMRC / Values Education domains.** DO 015 splits WW into Cognitive 10% + Affective 10% and PT into Cognitive 10% + Affective 10% + Behavioral 30%. TWIG uses the plain 20/50/30 split.
- **Key Stage 1 details.** Grade 1 learning areas (Language, Reading and Literacy, Mathematics, Makabansa, GMRC), Grades 2–3 areas, and 20/50/30 weights for Grades 2–3 follow MATATAG summaries, not the order text. Grade 1 (and Grades 2–3 once descriptive) final ratings are entered by the teacher, not computed.
- **Kindergarten domains.** The seven domains come from the earlier Kindergarten progress report; DO 015 points to the *Tracking Our Progress: Kindergarten!* guide, which may group them differently.
- **Senior High.** Subject types and weights follow secondary summaries of DO 015 (Grade 11, strengthened curriculum) and DO 8, s. 2015 (Grade 12, old curriculum). Grade 12 old-curriculum subjects reuse the DO 015 exam split (ST1/ST2/Term Exam) in place of DO 8's single quarterly assessment.
- **Lowest transmutation band.** One source maps IG 0–4.67 to 60; TWIG follows the band pattern the other brackets share (IG above 4.67 → 61). Check against the official table.

## License

[MIT](LICENSE) © 2026 Jimwel Dizon
