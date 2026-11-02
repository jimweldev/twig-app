// Round 'Em Up — a random student picker. Each learner is a farm animal
// wandering in front of the barn; the cowboy throws a lasso that arcs onto a
// randomly chosen animal. Ported from the twig-desktop reference project.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Lasso, Maximize, Minimize, PawPrint, RefreshCw, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import type { Learner } from "@/lib/db";
import { ANIMAL_KINDS, CssAnimal, CssCowboy, FarmScenery, FrontFence, type AnimalKind } from "./farm-art";
import "./games.css";

type Phase = "idle" | "throwing" | "caught";

const TAU = Math.PI * 2;

// Field zones as fractions of the field box.
const COWBOY = { x: 0.1, y: 0.82 };
// The raised hand the rope leaves from, in pixels from the cowboy's anchor. The cowboy is a fixed
// size, so this stays put however big the field is.
const HAND_OFFSET = { x: 55, y: -29 };
const handAt = (w: number, h: number) => ({ x: COWBOY.x * w + HAND_OFFSET.x, y: COWBOY.y * h + HAND_OFFSET.y });
// The herd grazes between the back fence (~46%) and the front fence (~86%).
const BOUNDS = { left: 0.06, right: 0.94, top: 0.48, bottom: 0.86 };

interface Critter {
  id: number;
  x: number; // px
  y: number; // px
  vx: number; // px/sec
  vy: number; // px/sec
}

/** Deterministic 0-1 noise so each learner spawns in the same spot every time. */
function pseudo(seed: number) {
  const s = Math.sin(seed) * 10000;
  return s - Math.floor(s);
}

/** Short label under each animal: first name and last initial. */
const nameOf = (l: Learner) => `${l.first_name} ${l.last_name.charAt(0).toUpperCase()}.`;
const fullName = (l: Learner) => `${l.first_name} ${l.last_name}`;

/** What the game hands back so it can pick up where it left off after being closed. */
export interface RoundMemory {
  /** The class list it applies to; a different list starts over. */
  learnerKey: string;
  /** Learners still in the herd. */
  poolIds: number[];
  removeWinner: boolean;
}

const keyOf = (learners: Learner[]) => learners.map((l) => l.id).join(",");

export function RoundEmUp({
  learners,
  memory,
  onMemoryChange,
}: {
  learners: Learner[];
  /** Saved state from an earlier opening (e.g. the class record's drawer). */
  memory?: RoundMemory | null;
  onMemoryChange?: (memory: RoundMemory) => void;
}) {
  const learnerKey = keyOf(learners);
  const remembered = memory && memory.learnerKey === learnerKey ? memory : null;
  const [pool, setPool] = useState<Learner[]>(() =>
    remembered ? learners.filter((l) => remembered.poolIds.includes(l.id)) : learners,
  );
  const [phase, setPhase] = useState<Phase>("idle");
  const [winner, setWinner] = useState<Learner | null>(null);
  const [removeWinner, setRemoveWinner] = useState(remembered?.removeWinner ?? true);
  const [ready, setReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const crittersRef = useRef<Map<number, Critter>>(new Map());
  const nodesRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const phaseRef = useRef<Phase>("idle");
  const targetRef = useRef<Learner | null>(null);
  const lassoRef = useRef({ x: 0, y: 0 });
  const lassoNodeRef = useRef<HTMLDivElement | null>(null);
  const ropeNodeRef = useRef<SVGPathElement | null>(null);
  const throwDistRef = useRef(0); // hand→target distance at the throw
  const liftRef = useRef(0); // parabolic arc lift (px, visual only)
  const chaseStartRef = useRef(0);
  const lastRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  // A stable animal per learner, from their place in the class list.
  const animalOf = useMemo(() => {
    const map = new Map<number, AnimalKind>();
    learners.forEach((l, i) => map.set(l.id, ANIMAL_KINDS[i % ANIMAL_KINDS.length]));
    return map;
  }, [learners]);

  // A changed class list (e.g. learners added) restarts the round; the first
  // render keeps whatever was restored from memory.
  const learnerKeyRef = useRef(learnerKey);
  useEffect(() => {
    if (learnerKeyRef.current === learnerKey) return;
    learnerKeyRef.current = learnerKey;
    crittersRef.current = new Map();
    targetRef.current = null;
    phaseRef.current = "idle";
    setPhase("idle");
    setWinner(null);
    setPool([...learners]);
  }, [learners, learnerKey]);

  // Report the herd so a later opening resumes it. A learner roped but not yet
  // cleared still counts as picked, so closing right after a catch keeps them out.
  useEffect(() => {
    const picked = phase === "caught" && removeWinner ? winner?.id : undefined;
    onMemoryChange?.({ learnerKey, poolIds: pool.filter((l) => l.id !== picked).map((l) => l.id), removeWinner });
  }, [pool, phase, winner, removeWinner, learnerKey, onMemoryChange]);

  // Track full screen, including Esc.
  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen();
    else containerRef.current?.requestFullscreen();
  }, []);

  // Measure the field and react to resizes.
  useEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      const prev = sizeRef.current;
      // Keep the herd spread across the field when it resizes (e.g. full screen).
      if (prev.w > 0 && prev.h > 0 && rect.width > 0 && rect.height > 0) {
        const sx = rect.width / prev.w;
        const sy = rect.height / prev.h;
        crittersRef.current.forEach((c) => {
          c.x *= sx;
          c.y *= sy;
        });
        lassoRef.current.x *= sx;
        lassoRef.current.y *= sy;
      }
      sizeRef.current = { w: rect.width, h: rect.height };
      if (rect.width > 0) setReady(true);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Spawn or keep critters whenever the pool (or field) changes.
  useEffect(() => {
    if (!ready) return;
    const { w, h } = sizeRef.current;
    const xMin = BOUNDS.left * w;
    const xMax = BOUNDS.right * w;
    const yMin = BOUNDS.top * h;
    const yMax = BOUNDS.bottom * h;
    const base = Math.hypot(w, h) * 0.07;

    const next = new Map<number, Critter>();
    pool.forEach((l, i) => {
      const existing = crittersRef.current.get(l.id);
      if (existing) {
        next.set(l.id, existing);
      } else {
        const angle = pseudo(l.id * 7.3 + 1) * TAU;
        next.set(l.id, {
          id: l.id,
          x: xMin + pseudo(l.id * 3.1 + i) * (xMax - xMin),
          y: yMin + pseudo(l.id * 5.7 + i) * (yMax - yMin),
          vx: Math.cos(angle) * base,
          vy: Math.sin(angle) * base,
        });
      }
    });
    crittersRef.current = next;

    // Place nodes right away so they don't flash at the corner.
    next.forEach((c) => {
      const node = nodesRef.current.get(c.id);
      if (node) {
        node.style.left = `${c.x}px`;
        node.style.top = `${c.y}px`;
      }
    });
  }, [pool, ready]);

  // Animation loop for the component's lifetime: wandering herd, lasso flight, rope.
  useEffect(() => {
    const loop = (now: number) => {
      const dt = lastRef.current ? Math.min(0.05, (now - lastRef.current) / 1000) : 0;
      lastRef.current = now;

      const { w, h } = sizeRef.current;
      const xMin = BOUNDS.left * w;
      const xMax = BOUNDS.right * w;
      const yMin = BOUNDS.top * h;
      const yMax = BOUNDS.bottom * h;
      const base = Math.hypot(w, h) * 0.07;
      const phaseNow = phaseRef.current;
      const target = targetRef.current;
      const lasso = lassoRef.current;

      crittersRef.current.forEach((c) => {
        const node = nodesRef.current.get(c.id);
        if (!node) return;

        if (phaseNow === "caught" && target?.id === c.id) {
          // Roped: frozen in the loop.
          node.style.left = `${c.x}px`;
          node.style.top = `${c.y}px`;
          node.style.transform = "translate(-50%, -50%)";
          return;
        }

        // Wander: now and then pick a new heading. The target wanders like the
        // rest (no fleeing), so it doesn't bolt to a corner when the lasso flies.
        if (Math.random() < dt * 1.2) {
          const a = Math.random() * TAU;
          c.vx = Math.cos(a) * base;
          c.vy = Math.sin(a) * base;
        }

        c.x += c.vx * dt;
        c.y += c.vy * dt;
        if (c.x < xMin) {
          c.x = xMin;
          c.vx = Math.abs(c.vx);
        } else if (c.x > xMax) {
          c.x = xMax;
          c.vx = -Math.abs(c.vx);
        }
        if (c.y < yMin) {
          c.y = yMin;
          c.vy = Math.abs(c.vy);
        } else if (c.y > yMax) {
          c.y = yMax;
          c.vy = -Math.abs(c.vy);
        }

        const hop = Math.abs(Math.sin(now / 150 + c.id)) * 4;
        node.style.left = `${c.x}px`;
        node.style.top = `${c.y}px`;
        node.style.transform = `translate(-50%, -50%) translateY(${-hop}px)`;
      });

      // Lasso flight: home in on the target, easing as it nears.
      if (phaseNow === "throwing" && target) {
        const c = crittersRef.current.get(target.id);
        if (c) {
          const dx = c.x - lasso.x;
          const dy = c.y - lasso.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 24 || now - chaseStartRef.current > 2800) {
            // Park the loop up-and-left of center so it cinches around the neck.
            lasso.x = c.x - 30;
            lasso.y = c.y - 40;
            liftRef.current = 0;
            phaseRef.current = "caught";
            setPhase("caught");
            setWinner(target);
          } else {
            const step = base * 4 * dt;
            lasso.x += (dx / dist) * step;
            lasso.y += (dy / dist) * step;
            // Arc: lift peaks mid-flight and settles onto the catch.
            const initial = throwDistRef.current || dist;
            const progress = Math.min(1, Math.max(0, 1 - dist / initial));
            liftRef.current = Math.sin(progress * Math.PI) * (initial * 0.22);
          }
        }
      }

      // Draw the lasso and rope while they're out.
      const { x: hx, y: hy } = handAt(w, h);
      const lift = phaseNow === "throwing" ? liftRef.current : 0;
      const ry = lasso.y - lift;
      if (lassoNodeRef.current && phaseNow !== "idle") {
        lassoNodeRef.current.style.transform = `translate(${lasso.x}px, ${ry}px) translate(-50%, -50%)`;
      }
      if (ropeNodeRef.current && phaseNow !== "idle") {
        const cx = (hx + lasso.x) / 2;
        // The rope sags in flight, then snaps taut once the loop cinches.
        const sag = phaseNow === "caught" ? 10 : 40 + lift * 0.4;
        const cy = Math.min(hy, ry) - sag;
        ropeNodeRef.current.setAttribute("d", `M ${hx} ${hy} Q ${cx} ${cy} ${lasso.x} ${ry}`);
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      lastRef.current = 0;
    };
  }, []);

  const throwLasso = useCallback(() => {
    if (phaseRef.current === "throwing" || pool.length === 0) return;
    const target = pool[Math.floor(Math.random() * pool.length)];
    const { w, h } = sizeRef.current;
    const { x: handX, y: handY } = handAt(w, h);
    targetRef.current = target;
    lassoRef.current = { x: handX, y: handY };
    const c = crittersRef.current.get(target.id);
    throwDistRef.current = c ? Math.hypot(c.x - handX, c.y - handY) : Math.hypot(w, h) * 0.5;
    liftRef.current = 0;
    chaseStartRef.current = performance.now();
    phaseRef.current = "throwing";
    setWinner(null);
    setPhase("throwing");
  }, [pool]);

  const pickAgain = useCallback(() => {
    const roped = targetRef.current;
    targetRef.current = null;
    phaseRef.current = "idle";
    setPhase("idle");
    setWinner(null);
    if (removeWinner && roped) {
      crittersRef.current.delete(roped.id);
      setPool((prev) => prev.filter((l) => l.id !== roped.id));
    }
  }, [removeWinner]);

  const resetHerd = useCallback(() => {
    targetRef.current = null;
    phaseRef.current = "idle";
    crittersRef.current = new Map();
    setPhase("idle");
    setWinner(null);
    // A new array so the spawn effect re-runs even if nobody was roped yet.
    setPool([...learners]);
  }, [learners]);

  // Space or Enter throws (or ropes the next one) — handy on a projector.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select, button, [role=switch]")) return;
      if (e.key !== " " && e.key !== "Enter") return;
      e.preventDefault();
      if (phaseRef.current === "caught") pickAgain();
      else throwLasso();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [throwLasso, pickAgain]);

  const roped = learners.length - pool.length;
  const hint =
    phase === "caught"
      ? `Roped ${winner ? fullName(winner) : "a learner"}!`
      : phase === "throwing"
        ? "Twirling the lasso…"
        : pool.length === 0
          ? "Everyone's been roped — reset to play again."
          : "Throw the lasso to pick a random learner. (Space works too.)";

  return (
    <div
      ref={containerRef}
      className={`flex min-h-0 flex-1 flex-col gap-4 ${isFullscreen ? "h-full justify-center overflow-hidden bg-background p-6" : ""}`}
    >
      <Card className="shrink-0 py-4">
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {phase === "caught" ? (
                <Button size="lg" onClick={pickAgain}>
                  <RefreshCw /> {removeWinner ? "Rope the next one" : "Throw again"}
                </Button>
              ) : (
                <Button size="lg" onClick={throwLasso} disabled={phase !== "idle" || pool.length === 0}>
                  <Lasso /> Throw the lasso!
                </Button>
              )}
              <p className="text-sm font-medium text-muted-foreground" aria-live="polite">
                {hint}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={resetHerd} disabled={phase === "throwing"}>
                <RotateCcw /> Reset
              </Button>
              <Button variant="outline" size="sm" onClick={toggleFullscreen}>
                {isFullscreen ? <Minimize /> : <Maximize />}
                {isFullscreen ? "Exit full screen" : "Full screen"}
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Switch checked={removeWinner} onCheckedChange={setRemoveWinner} />
              <span>
                Don&rsquo;t pick the same learner twice
                <span className="block text-xs text-muted-foreground">Roped learners leave the herd.</span>
              </span>
            </label>
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <PawPrint className="size-4" />
              {pool.length} {pool.length === 1 ? "learner" : "learners"} left
              {roped > 0 ? ` · ${roped} roped` : ""}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* The farm field */}
      <div
        ref={fieldRef}
        className="relative min-h-[420px] w-full flex-1 overflow-hidden rounded-xl border bg-[linear-gradient(to_bottom,#0284c7_0%,#38bdf8_18%,#bae6fd_30%,#ffedd5_38%,#ffedd5_100%)]"
      >
        <FarmScenery />

        {phase === "idle" && pool.length > 0 && (
          <div className="pointer-events-none absolute inset-x-0 top-4 z-10 flex justify-center">
            <div className="flex items-center gap-2 rounded-full border bg-card/90 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur">
              <Lasso className="size-3.5 text-amber-600" />
              Press &ldquo;Throw the lasso!&rdquo; to pick a random learner
            </div>
          </div>
        )}

        {phase === "caught" && winner && (
          <div
            className="pointer-events-none absolute inset-x-0 top-4 z-10 flex justify-center px-4"
            style={{ animation: "winner-pop 0.5s ease-out" }}
          >
            <div className="flex items-center gap-3 rounded-2xl border-2 border-amber-500 bg-card/95 px-5 py-3 shadow-xl backdrop-blur">
              <CssAnimal kind={animalOf.get(winner.id) ?? "cow"} size={40} />
              <div className="text-left">
                <p className="text-[11px] font-bold tracking-wider text-amber-600 uppercase">Roped!</p>
                <p className="text-xl leading-tight font-extrabold">{fullName(winner)}</p>
              </div>
            </div>
          </div>
        )}

        {/* The herd */}
        {pool.map((l) => {
          const isWinner = phase === "caught" && winner?.id === l.id;
          return (
            <div
              key={l.id}
              ref={(el) => {
                if (el) nodesRef.current.set(l.id, el);
                else nodesRef.current.delete(l.id);
              }}
              className={`absolute top-0 left-0 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center will-change-transform select-none ${
                isWinner ? "z-20" : ""
              }`}
            >
              <div
                style={
                  isWinner
                    ? {
                        animation:
                          "caught-bounce 0.6s ease-out forwards, caught-struggle 0.55s ease-in-out 0.6s infinite",
                      }
                    : undefined
                }
              >
                <CssAnimal kind={animalOf.get(l.id) ?? "cow"} size={44} delay={l.id % 5} />
              </div>
              <span
                className={`mt-0.5 max-w-[90px] truncate rounded-full px-1.5 text-center text-[10px] font-medium ${
                  isWinner ? "bg-amber-500 text-white" : "bg-white/75 text-stone-700"
                }`}
              >
                {nameOf(l)}
              </span>
            </div>
          );
        })}

        <FrontFence />

        {/* Positioned by a wrapper: .cb sets position: relative, which can override an "absolute" class. */}
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 select-none"
          style={{ left: `${COWBOY.x * 100}%`, top: `${COWBOY.y * 100}%` }}
        >
          <CssCowboy throwing={phase === "throwing"} size={68} />
        </div>

        {/* Idle lasso twirling in the cowboy's hand */}
        {phase === "idle" && (
          <div
            className="lasso pointer-events-none -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `calc(${COWBOY.x * 100}% + ${HAND_OFFSET.x}px)`,
              top: `calc(${COWBOY.y * 100}% + ${HAND_OFFSET.y}px)`,
            }}
          >
            <div className="lasso__cinch">
              <div className="lasso__ring" />
            </div>
          </div>
        )}

        {/* Flying / caught lasso and its rope */}
        {phase !== "idle" && (
          <>
            <svg className="pointer-events-none absolute inset-0 size-full overflow-visible">
              <path ref={ropeNodeRef} fill="none" stroke="#8a5a2b" strokeWidth={3} strokeLinecap="round" />
            </svg>
            <div ref={lassoNodeRef} className={`lasso ${phase === "caught" ? "lasso--caught" : ""}`}>
              <div className="lasso__cinch">
                <div className="lasso__ring" />
              </div>
            </div>
          </>
        )}

        {pool.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/70 text-center">
            <CssAnimal kind="cow" size={56} />
            <p className="font-medium">
              {learners.length === 0 ? "No learners in this section yet." : "The whole herd has been roped!"}
            </p>
            {learners.length > 0 && (
              <Button variant="outline" size="sm" onClick={resetHerd}>
                <RotateCcw /> Round them up again
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
