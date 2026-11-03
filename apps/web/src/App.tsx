import type { ReactNode } from "react";
import { formatSize, RELEASES_URL, useLatestRelease } from "./useLatestRelease";

function Logo({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 256 256" className={className} aria-hidden="true">
      <rect width="256" height="256" rx="58" fill="#047857" />
      <g fill="#ffffff" transform="translate(27.4 30.3) scale(0.74)">
        <path d="M104 178 Q101 110 118 42 Q128 32 137 42 Q140 110 138 174 Q140 202 168 204 Q186 206 196 196 Q194 228 160 232 Q106 232 104 178 Z" />
        <path d="M122 92 Q96 86 68 84 Q56 90 68 98 Q96 102 120 110 Z" />
        <path d="M132 112 A64 64 0 0 1 216 52 A64 64 0 0 1 132 112 Z" />
      </g>
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

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true">
      <path d="M16.4 12.6c0-2.4 2-3.6 2.1-3.7-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.3.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.8-1.1-2.8-4.2zM13.9 5.2c.7-.9 1.2-2 1-3.2-1 0-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.2.1 2.3-.6 3.1-1.5z" />
    </svg>
  );
}

/** Mac visitors get the Mac download first, everyone else the Windows one. */
const onMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.userAgent);

function DownloadButton() {
  const { release, status } = useLatestRelease();
  const windows = { name: "Windows", icon: <WindowsIcon />, href: release?.installer?.url ?? RELEASES_URL };
  const mac = { name: "Mac", icon: <AppleIcon />, href: release?.mac?.url ?? RELEASES_URL };
  // The visitor's own platform gets the filled button.
  const [first, second] = onMac ? [mac, windows] : [windows, mac];

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap gap-3">
        <a
          href={first.href}
          className="inline-flex items-center gap-2.5 rounded-xl bg-emerald-700 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-emerald-900/20 transition hover:bg-emerald-800"
        >
          {first.icon}
          Download for {first.name}
        </a>
        <a
          href={second.href}
          className="inline-flex items-center gap-2.5 rounded-xl border border-emerald-700/30 bg-white px-6 py-3.5 text-base font-semibold text-emerald-800 transition hover:bg-emerald-50"
        >
          {second.icon}
          Download for {second.name}
        </a>
      </div>
      <p className="text-sm text-stone-500">
        {status === "loading" && "Checking the latest version…"}
        {status === "ready" && release && `Version ${release.version} · Windows 10 and 11 · macOS 11 or later`}
        {status === "none" && "The first release is on its way."}
      </p>
    </div>
  );
}

/** One button per platform, for the install section. */
function PlatformDownloads() {
  const { release, status } = useLatestRelease();
  const platforms = [
    { name: "Windows", icon: <WindowsIcon />, file: release?.installer, needs: "Windows 10 and 11" },
    { name: "Mac", icon: <AppleIcon />, file: release?.mac, needs: "Apple silicon and Intel, macOS 11 or later" },
  ];

  return (
    <div className="flex flex-col gap-3">
      {platforms.map((p) => (
        <a
          key={p.name}
          href={p.file?.url ?? RELEASES_URL}
          className="flex items-center gap-3 rounded-xl bg-white px-5 py-3.5 text-emerald-900 shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-50"
        >
          {p.icon}
          <span className="flex flex-col">
            <span className="font-semibold">Download for {p.name}</span>
            <span className="text-xs text-emerald-900/60">
              {p.needs}
              {p.file && ` · ${formatSize(p.file.size)}`}
            </span>
          </span>
        </a>
      ))}
      <p className="text-sm text-emerald-100/70">
        {status === "loading" && "Checking the latest version…"}
        {status === "ready" && release && `Version ${release.version}`}
        {status === "none" && "The first release is on its way."}
      </p>
    </div>
  );
}

/** A small, static picture of the class record so visitors see the app at a glance. */
function ClassRecordPreview() {
  const rows: [string, number[], number][] = [
    ["Aquino, Carlos B.", [18, 24, 45], 88],
    ["Castillo, Rafael N.", [15, 22, 40], 83],
    ["Cruz, Daniel G.", [19, 27, 47], 92],
    ["Dela Cruz, Sofia R.", [12, 20, 36], 78],
    ["Flores, Gabriel A.", [9, 16, 30], 72],
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

type Feature = { title: string; text: string; icon: ReactNode };

const CLASS_FEATURES: Feature[] = [
  {
    title: "E-class record",
    text: "Three-term class records with DO 015, s. 2026 weights, ST1/ST2/term exam, and the adjusted transmutation table. MAPEH keeps each part's own grades. Paste scores straight from Excel; grades compute as you type.",
    icon: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18" /></>,
  },
  {
    title: "Kinder to Grade 12",
    text: "Descriptive ratings for Kindergarten and Key Stage 1, numeric grades for Grades 2–10, and Senior High subject types with their own weights.",
    icon: <><path d="M22 10 12 5 2 10l10 5 10-5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" /></>,
  },
  {
    title: "Attendance",
    text: "A daily SF2-style grid for your advisory class. Mark absences, lates and no-class days; monthly totals fill the report card.",
    icon: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18m-12 6 2 2 4-4" /></>,
  },
  {
    title: "Report cards",
    text: "Print SF9-style progress report cards — grades, attendance, age and observed values — or save them as PDF.",
    icon: <><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></>,
  },
  {
    title: "Share grades on Messenger",
    text: "Subject teachers export a grade file and send it to the adviser on Messenger. The adviser imports it in one click.",
    icon: <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />,
  },
  {
    title: "Your data stays with you",
    text: "Everything is saved on your own computer. No account, no sign-in, no cloud — it works with the Wi-Fi off.",
    icon: <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
  },
];

const TEACHING_FEATURES: Feature[] = [
  {
    title: "ILAW lesson plans",
    text: "Lesson plans in the DO 16, s. 2026 format. Let ChatGPT draft the parts, review and edit them, then download a PDF with your school's logos in the footer.",
    icon: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M16 13H8m8 4H8m2-8H8" /></>,
  },
  {
    title: "Quizzes and tests",
    text: "Make a quiz from a lesson plan: multiple choice, true or false, identification, matching, enumeration and essay. Download the test paper and its answer key as PDFs.",
    icon: <><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2m1 10 2 2 4-4" /></>,
  },
  {
    title: "Certificates",
    text: "Upload your certificate design, place the learner's name, award and grades on it, and print one for every learner at once.",
    icon: <><circle cx="12" cy="8" r="6" /><path d="M15.5 13 17 22l-5-3-5 3 1.5-9" /></>,
  },
  {
    title: "Classroom games",
    text: "Round 'Em Up picks a learner at random; Squad Up shuffles the class into balanced groups, with leaders if you like. Both run offline.",
    icon: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8" cy="8" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="16" cy="16" r="1" fill="currentColor" /></>,
  },
];

function FeatureGrid({ features }: { features: Feature[] }) {
  return (
    <div className={`mt-6 grid gap-5 sm:grid-cols-2 ${features.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
      {features.map((f) => (
        <div key={f.title} className="rounded-2xl border border-stone-200 bg-white p-6">
          <div className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {f.icon}
            </svg>
          </div>
          <h3 className="mt-3 font-semibold text-stone-900">{f.title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{f.text}</p>
        </div>
      ))}
    </div>
  );
}

const b = (text: string) => <strong className="font-semibold text-stone-800">{text}</strong>;
const code = (text: string) => <code className="rounded bg-stone-100 px-1 py-0.5 text-[0.85em]">{text}</code>;

const FAQ: [string, ReactNode][] = [
  [
    "Is TWIG an official DepEd app?",
    <>
      <p>{b("No.")} TWIG is a free, independent tool made by a developer.</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>It follows DO 015, s. 2026 for grading.</li>
        <li>Always double-check grades against your school&rsquo;s forms.</li>
      </ul>
    </>,
  ],
  [
    "Do I need internet?",
    <>
      <p>{b("Only for three things:")}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>Downloading TWIG</li>
        <li>Sending grade files on Messenger</li>
        <li>Updating TWIG</li>
      </ul>
      <p className="mt-2">Everything else works offline.</p>
    </>,
  ],
  [
    "Where is my data saved?",
    <>
      <p>{b("On your own computer.")} Nothing goes online.</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>Windows: {code("%APPDATA%\\com.twig.desktop\\twig.db")}</li>
        <li>Mac: {code("~/Library/Application Support/com.twig.desktop/twig.db")}</li>
      </ul>
      <p className="mt-2">To back it up, copy that file to OneDrive or a flash drive now and then.</p>
    </>,
  ],
  [
    "Does TWIG use AI?",
    <>
      <p>{b("No AI is built in.")} For lesson plans, you can use ChatGPT outside the app:</p>
      <ol className="mt-2 list-decimal space-y-1 pl-5">
        <li>TWIG gives you a prompt.</li>
        <li>Paste it into ChatGPT.</li>
        <li>Paste ChatGPT&rsquo;s reply back into TWIG, then review it.</li>
      </ol>
    </>,
  ],
  [
    "How do I update TWIG?",
    <>
      <ol className="list-decimal space-y-1 pl-5">
        <li>Open {b("Settings › Updates")}.</li>
        <li>Click {b("Check for updates")}.</li>
      </ol>
      <p className="mt-2">TWIG restarts on the new version. Your records are kept.</p>
    </>,
  ],
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
          </div>
          <a
            href="#install"
            className="ml-auto inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/20 transition hover:bg-emerald-800 sm:ml-0"
          >
            <svg
              viewBox="0 0 24 24"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 4v12M6 11l6 6 6-6M5 20h14" />
            </svg>
            Download
          </a>
        </nav>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_80%_0%,rgba(16,185,129,0.12),transparent_70%)]" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-[1.05fr_1fr] lg:py-28">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
                Free · Open source · Works offline
              </p>
              <h1 className="mt-5 text-4xl font-bold tracking-tight text-stone-900 sm:text-5xl lg:text-6xl">
                Your teaching work,
                <br />
                <span className="text-emerald-700">done in one place.</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-stone-600">
                <strong className="font-semibold text-stone-800">TWIG</strong> — Teacher&rsquo;s Work Integration
                Gateway — is a desktop app for Filipino teachers: e-class records, attendance, report cards, lesson
                plans, quizzes and certificates, built around the three-term school year. Works offline.
              </p>
              <div className="mt-8">
                <DownloadButton />
              </div>
            </div>
            <ClassRecordPreview />
          </div>
        </section>

        <section id="video" className="border-t border-stone-100">
          <div className="mx-auto max-w-4xl px-6 py-20 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-stone-900">See TWIG in two minutes</h2>
            <p className="mx-auto mt-2 max-w-2xl text-stone-600">
              Twig walks through the trouble with too many files, from class records to quizzes, and how TWIG puts it all in one app. Narrated in Taglish.
            </p>
            <video
              className="mt-8 aspect-video w-full rounded-2xl border border-stone-200 bg-stone-100 shadow-xl shadow-emerald-950/10"
              src="video/twig-for-teachers.mp4?v=4"
              poster="video/twig-for-teachers-poster.jpg?v=4"
              controls
              playsInline
              preload="none"
            />
          </div>
        </section>

        <section id="features" className="border-t border-stone-100 bg-stone-50/60">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <h2 className="text-3xl font-bold tracking-tight text-stone-900">Everything for your classes</h2>
            <p className="mt-2 max-w-2xl text-stone-600">
              From the lesson plan to the printed report card, without juggling spreadsheets and Word files.
            </p>
            <h3 className="mt-10 text-sm font-semibold tracking-wide text-emerald-800 uppercase">My classes</h3>
            <FeatureGrid features={CLASS_FEATURES} />
            <h3 className="mt-12 text-sm font-semibold tracking-wide text-emerald-800 uppercase">Teaching</h3>
            <FeatureGrid features={TEACHING_FEATURES} />
          </div>
        </section>

        <section id="sharing" className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-3xl font-bold tracking-tight text-stone-900">Sharing grades on Messenger</h2>
          <p className="mt-2 max-w-2xl text-stone-600">
            Each teacher has TWIG on their own laptop. Grades travel as one small file.
          </p>
          <ol className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              ["Subject teacher", "Open the class record and click Send grades. TWIG saves a .twig file."],
              ["Messenger", "Send the .twig file to the adviser in a Messenger chat."],
              ["Adviser", "Import the file in the advisory section. The grades are ready for report cards."],
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
                  <>Download TWIG for your computer.</>,
                  <>
                    Install it.
                    <ul className="mt-2 space-y-2 text-sm">
                      <li>
                        <strong className="text-white">Windows:</strong> open the installer. Blue warning? Click{" "}
                        <strong className="text-white">More info</strong>, then{" "}
                        <strong className="text-white">Run anyway</strong>.
                      </li>
                      <li>
                        <strong className="text-white">Mac:</strong> drag TWIG to Applications. Blocked? Open{" "}
                        <strong className="text-white">System Settings › Privacy &amp; Security</strong>, then click{" "}
                        <strong className="text-white">Open Anyway</strong>.
                      </li>
                    </ul>
                  </>,
                  <>Open TWIG and fill in Settings: you and your school.</>,
                  <>Add a school year, then your sections.</>,
                ].map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-800 text-xs font-bold text-white">
                      {i + 1}
                    </span>
                    <div>{step}</div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="order-first flex flex-col justify-center gap-4 rounded-2xl bg-emerald-900/60 p-8 lg:order-none">
              <p className="text-lg font-semibold text-white">Ready when you are.</p>
              <p className="text-sm text-emerald-100/80">
                Free for every teacher. TWIG updates itself: open Settings › Updates and click Check for updates. Your
                records stay on your computer.
              </p>
              <PlatformDownloads />
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
                <div className="mt-2 text-sm leading-relaxed text-stone-600">{a}</div>
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
          <p>Free and open source (MIT license).</p>
        </div>
      </footer>
    </div>
  );
}
