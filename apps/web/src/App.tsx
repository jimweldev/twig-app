import type { ReactNode } from "react";
import { formatSize, RELEASES_URL, REPO, useLatestRelease } from "./useLatestRelease";

function Logo({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <rect width="48" height="48" rx="12" fill="#047857" />
      <path d="M14 40 C20 30 26 22 36 10" stroke="#ecfdf5" strokeWidth="3.2" strokeLinecap="round" fill="none" />
      <path d="M22 28 C14 26 10 19 11 12 C18 13 23 19 22 28 Z" fill="#a7f3d0" />
      <path d="M28 20 C30 13 36 9 42 10 C41 17 35 21 28 20 Z" fill="#6ee7b7" />
    </svg>
  );
}

function WindowsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true">
      <path d="M3 5.5 10.5 4.5v7H3zM11.5 4.3 21 3v8.5h-9.5zM3 12.5h7.5v7L3 18.5zM11.5 12.5H21V21l-9.5-1.3z" />
    </svg>
  );
}

function DownloadButton({ large = false }: { large?: boolean }) {
  const { release, status } = useLatestRelease();
  const href = release?.installer?.url ?? RELEASES_URL;
  const pad = large ? "px-6 py-3.5 text-base" : "px-4 py-2.5 text-sm";

  return (
    <div className={large ? "flex flex-col items-start gap-2" : ""}>
      <a
        href={href}
        className={`inline-flex items-center gap-2.5 rounded-xl bg-emerald-700 font-semibold text-white shadow-lg shadow-emerald-900/20 transition hover:bg-emerald-800 ${pad}`}
      >
        <WindowsIcon />
        Download for Windows
      </a>
      {large && (
        <p className="text-sm text-stone-500">
          {status === "loading" && "Checking the latest version…"}
          {status === "ready" && release && (
            <>
              Version {release.version}
              {release.installer && ` · ${formatSize(release.installer.size)}`} · Windows 10 and 11 ·{" "}
              <a href={RELEASES_URL} className="underline hover:text-stone-800">
                all releases
              </a>
            </>
          )}
          {status === "none" && (
            <>
              The first release is on its way —{" "}
              <a href={RELEASES_URL} className="underline hover:text-stone-800">
                check GitHub Releases
              </a>
              .
            </>
          )}
        </p>
      )}
    </div>
  );
}

/** A small, static picture of the class record so visitors see the app at a glance. */
function ClassRecordPreview() {
  const rows: [string, number[], number][] = [
    ["AQUINO, Carlos B.", [18, 24, 45], 88],
    ["CASTILLO, Rafael N.", [15, 22, 40], 83],
    ["CRUZ, Daniel G.", [19, 27, 47], 92],
    ["DELA CRUZ, Sofia R.", [12, 20, 36], 78],
    ["FLORES, Gabriel A.", [9, 16, 30], 72],
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl shadow-emerald-950/10">
      <div className="flex items-center gap-2 border-b border-stone-200 bg-stone-50 px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-stone-300" />
        <span className="size-2.5 rounded-full bg-stone-300" />
        <span className="size-2.5 rounded-full bg-stone-300" />
        <span className="ml-3 text-xs font-medium text-stone-500">Grade 7 – Sampaguita · MAPEH · Term 1</span>
      </div>
      <table className="w-full text-left text-xs">
        <thead className="bg-stone-50 text-stone-600">
          <tr>
            <th className="px-3 py-2 font-semibold">Learner</th>
            <th className="bg-sky-50 px-2 py-2 text-center font-semibold">WW</th>
            <th className="bg-violet-50 px-2 py-2 text-center font-semibold">PT</th>
            <th className="bg-amber-50 px-2 py-2 text-center font-semibold">Exam</th>
            <th className="px-3 py-2 text-center font-semibold">Grade</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, scores, grade]) => (
            <tr key={name} className="border-t border-stone-100">
              <td className="px-3 py-2 whitespace-nowrap text-stone-800">{name}</td>
              {scores.map((s, i) => (
                <td key={i} className="px-2 py-2 text-center tabular-nums text-stone-600">
                  {s}
                </td>
              ))}
              <td
                className={`px-3 py-2 text-center font-bold tabular-nums ${
                  grade < 75 ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"
                }`}
              >
                {grade}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const FEATURES: { title: string; text: string; icon: ReactNode }[] = [
  {
    title: "E-class record",
    text: "Three-term class records with DO 015, s. 2026 weights, ST1/ST2/term exam, and the adjusted transmutation table. Grades compute as you type.",
    icon: "📒",
  },
  {
    title: "Kinder to Grade 12",
    text: "Descriptive ratings for Kindergarten and Key Stage 1, numeric grades for Grades 2–10, and Senior High subject types with their own weights.",
    icon: "🎒",
  },
  {
    title: "Attendance",
    text: "A daily SF2-style grid for your advisory class. Mark absences, lates and no-class days; monthly totals fill the report card.",
    icon: "🗓️",
  },
  {
    title: "Report cards",
    text: "Print SF9-style progress report cards — grades, attendance, age and observed values — or save them as PDF.",
    icon: "🖨️",
  },
  {
    title: "Send grades without internet",
    text: "Subject teachers export a grade file and send it through Messenger, email or USB. The adviser imports it in one click.",
    icon: "📨",
  },
  {
    title: "Your data stays with you",
    text: "Everything is saved on your own computer. No account, no sign-in, no cloud — it works with the Wi-Fi off.",
    icon: "🔒",
  },
];

const FAQ: [string, ReactNode][] = [
  [
    "Is TWIG an official DepEd app?",
    "No. TWIG is an independent, free tool made by a teacher-developer, with its source code public on GitHub. It follows published DepEd orders (DO 015, s. 2026 for grading), but always check computations against the official issuances and your school's forms.",
  ],
  ["Do I need internet?", "Only to download it. TWIG runs fully offline after that, including sharing grades between teachers."],
  [
    "Where is my data saved?",
    <>
      In a database file on your computer: <code className="rounded bg-stone-100 px-1 py-0.5 text-[0.85em]">%APPDATA%\com.twig.desktop\twig.db</code>.
      Copy that file to a USB drive now and then as a backup.
    </>,
  ],
  [
    "Windows says it protected my PC. Is it safe?",
    "The installer isn't code-signed yet, so Windows SmartScreen shows a warning the first time. Click “More info”, then “Run anyway”. The full source code is public on GitHub.",
  ],
  ["Is there a Mac or Linux version?", "Not yet — TWIG is Windows-only for now."],
];

export default function App() {
  return (
    <div className="min-h-screen bg-white text-stone-800">
      <header className="sticky top-0 z-30 border-b border-stone-200/70 bg-white/85 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
          <a href="#" className="flex items-center gap-2.5">
            <Logo className="size-8" />
            <span className="text-lg font-bold tracking-tight text-emerald-900">TWIG</span>
          </a>
          <div className="ml-auto hidden items-center gap-6 text-sm text-stone-600 sm:flex">
            <a href="#features" className="hover:text-stone-900">
              Features
            </a>
            <a href="#sharing" className="hover:text-stone-900">
              Sharing grades
            </a>
            <a href="#install" className="hover:text-stone-900">
              Install
            </a>
            <a href="#faq" className="hover:text-stone-900">
              FAQ
            </a>
            <a href={`https://github.com/${REPO}`} className="hover:text-stone-900">
              GitHub
            </a>
          </div>
          <div className="ml-auto sm:ml-0">
            <DownloadButton />
          </div>
        </nav>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_80%_0%,rgba(16,185,129,0.12),transparent_70%)]" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-[1.05fr_1fr] lg:py-28">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
                Free · Works offline · Source on GitHub
              </p>
              <h1 className="mt-5 text-4xl font-bold tracking-tight text-stone-900 sm:text-5xl lg:text-6xl">
                Your class records,
                <br />
                <span className="text-emerald-700">done in one place.</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-stone-600">
                <strong className="font-semibold text-stone-800">TWIG</strong> — Teacher&rsquo;s Work Integration Gateway — is a
                desktop app for Filipino teachers: e-class records, attendance and report cards, built around the
                three-term school year. No internet needed.
              </p>
              <div className="mt-8">
                <DownloadButton large />
              </div>
            </div>
            <ClassRecordPreview />
          </div>
        </section>

        <section id="features" className="border-t border-stone-100 bg-stone-50/60">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <h2 className="text-3xl font-bold tracking-tight text-stone-900">Everything for your classes</h2>
            <p className="mt-2 max-w-2xl text-stone-600">
              From the first score of Term 1 to the printed report card, without juggling spreadsheets.
            </p>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div key={f.title} className="rounded-2xl border border-stone-200 bg-white p-6">
                  <div className="text-2xl" aria-hidden="true">
                    {f.icon}
                  </div>
                  <h3 className="mt-3 font-semibold text-stone-900">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="sharing" className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-3xl font-bold tracking-tight text-stone-900">Sharing grades, no internet required</h2>
          <p className="mt-2 max-w-2xl text-stone-600">
            Subject teachers and advisers each keep TWIG on their own laptop. Grades travel as a small file.
          </p>
          <ol className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              ["Subject teacher", "Opens the class record and clicks Send grades. TWIG saves a .twig file — add a password if you like."],
              ["Any way you like", "Send the file through Messenger, email, a shared folder or a USB drive."],
              ["Adviser", "Imports the file in the advisory section. Learners are matched by LRN, and the consolidated grades are ready for report cards."],
            ].map(([title, text], i) => (
              <li key={title} className="rounded-2xl border border-stone-200 p-6">
                <span className="flex size-8 items-center justify-center rounded-full bg-emerald-700 text-sm font-bold text-white">
                  {i + 1}
                </span>
                <h3 className="mt-4 font-semibold text-stone-900">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="install" className="border-y border-stone-100 bg-emerald-950 text-emerald-50">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-white">Install in a minute</h2>
              <ol className="mt-6 space-y-4 text-emerald-100/90">
                {[
                  "Download the installer for Windows.",
                  "Open it. If Windows SmartScreen appears, click “More info”, then “Run anyway”.",
                  "Open TWIG, add your school profile and school year, then your sections.",
                ].map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-800 text-xs font-bold text-white">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="flex flex-col justify-center gap-4 rounded-2xl bg-emerald-900/60 p-8">
              <p className="text-lg font-semibold text-white">Ready when you are.</p>
              <p className="text-sm text-emerald-100/80">
                Free for every teacher. Updates are published on GitHub — download the new installer to upgrade; your
                records stay on your computer.
              </p>
              <div className="[&_a]:bg-white [&_a]:text-emerald-900 [&_a:hover]:bg-emerald-50 [&_p]:text-emerald-100/70 [&_p_a]:bg-transparent [&_p_a]:text-emerald-100">
                <DownloadButton large />
              </div>
            </div>
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-3xl px-6 py-20">
          <h2 className="text-3xl font-bold tracking-tight text-stone-900">Questions</h2>
          <div className="mt-8 divide-y divide-stone-200 border-y border-stone-200">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-stone-900">
                  {q}
                  <span className="text-stone-400 transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">{a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-stone-200">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-stone-500">
          <div className="flex items-center gap-2">
            <Logo className="size-6" />
            <span>TWIG — Teacher&rsquo;s Work Integration Gateway</span>
          </div>
          <p>Not affiliated with the Department of Education.</p>
          <a href={`https://github.com/${REPO}`} className="hover:text-stone-800">
            Source on GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
