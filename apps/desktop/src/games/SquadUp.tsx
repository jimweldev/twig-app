// Squad Up — shuffles a section into balanced groups. Learners marked as
// leaders are dealt one per group first; after grouping, the teacher can crown
// leaders, pick random ones, or drag learners between groups. Ported from the
// twig-desktop reference project (without its saved groups).

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { move } from "@dnd-kit/helpers";
import { DragDropProvider, useDroppable } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { Crown, Dices, GripVertical, Maximize, Minimize, Minus, Play, Plus, RotateCcw, Users } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { Learner } from "@/lib/db";
import "./games.css";

// A distinct accent per group so groups are easy to tell apart.
const GROUP_ACCENTS = [
  { dot: "bg-rose-500", border: "border-t-rose-400" },
  { dot: "bg-amber-500", border: "border-t-amber-400" },
  { dot: "bg-emerald-500", border: "border-t-emerald-400" },
  { dot: "bg-sky-500", border: "border-t-sky-400" },
  { dot: "bg-violet-500", border: "border-t-violet-400" },
  { dot: "bg-fuchsia-500", border: "border-t-fuchsia-400" },
  { dot: "bg-lime-500", border: "border-t-lime-400" },
  { dot: "bg-cyan-500", border: "border-t-cyan-400" },
];

// Groups are keyed by their index as a string; learners pulled out of a group
// (drag mode) wait under this key.
const UNASSIGNED = "unassigned";

// Approximate height of one member row, to give every group card the same body height.
const ROW_H = 34;
const MIN_BODY_H = 44;

type Phase = "idle" | "grouped";
/** group key -> ordered learner ids */
type Lists = Record<string, number[]>;

const initials = (l: Learner) => `${l.first_name[0] ?? ""}${l.last_name[0] ?? ""}`.toUpperCase();
const fullName = (l: Learner) => `${l.first_name} ${l.last_name}`;

/** Fisher-Yates shuffle of a copy. */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Balanced groups: leaders are dealt first (one per group), then everyone else round-robin. */
export function makeGroups(learners: Learner[], count: number, leaderIds: Set<number>): Lists {
  const leaders = shuffle(learners.filter((l) => leaderIds.has(l.id)));
  const others = shuffle(learners.filter((l) => !leaderIds.has(l.id)));
  const lists: Lists = {};
  for (let i = 0; i < count; i++) lists[String(i)] = [];
  leaders.forEach((l, i) => lists[String(i % count)].push(l.id));
  others.forEach((l, i) => lists[String((leaders.length + i) % count)].push(l.id));
  return lists;
}

/**
 * Drag mode always shows the Unassigned card, so the lists need that bucket for
 * dnd-kit to drop into. Turning drag off drops the bucket only when it's empty.
 */
function syncUnassignedBucket(lists: Lists, dragOn: boolean): Lists {
  const has = UNASSIGNED in lists;
  if (dragOn && !has) return { ...lists, [UNASSIGNED]: [] };
  if (!dragOn && has && lists[UNASSIGNED].length === 0) {
    const next = { ...lists };
    delete next[UNASSIGNED];
    return next;
  }
  return lists;
}

type MemberBodyProps = {
  learner: Learner;
  isLeader: boolean;
  accentDot: string;
  onToggleLeader: (id: number) => void;
};

/** Initials, name and crown. Clicking toggles leader. */
function MemberBody({ learner, isLeader, accentDot, onToggleLeader }: MemberBodyProps) {
  return (
    <button
      type="button"
      title={isLeader ? "Remove as leader" : "Make leader"}
      onClick={() => onToggleLeader(learner.id)}
      className="flex min-w-0 flex-1 items-center gap-2 text-left"
    >
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white",
          accentDot,
          isLeader && "ring-2 ring-amber-500 ring-offset-1",
        )}
      >
        {initials(learner)}
      </span>
      <span className={cn("truncate text-sm", isLeader && "font-semibold")}>{fullName(learner)}</span>
      {isLeader && <Crown className="ml-auto size-3.5 shrink-0 fill-amber-400 text-amber-500" />}
    </button>
  );
}

type RowProps = MemberBodyProps & { animate: boolean; entranceDelay: number };

const ROW_BASE = "flex items-center gap-1.5 rounded-md bg-background py-0.5";

/** A plain member row (drag off). */
function MemberRow({ animate, entranceDelay, ...body }: RowProps) {
  return (
    <div
      data-member-id={body.learner.id}
      data-delay={entranceDelay}
      className={cn(ROW_BASE, animate && "squad-enter")}
      style={animate ? { animationDelay: `${entranceDelay}ms` } : undefined}
    >
      {/* Keeps names aligned with the draggable rows' grip. */}
      <span className="w-3.5 shrink-0" />
      <MemberBody {...body} />
    </div>
  );
}

/** A draggable member row (drag on): grip drags, body toggles leader. */
function SortableMember({ index, groupKey, animate, entranceDelay, ...body }: RowProps & { index: number; groupKey: string }) {
  const { ref, handleRef, isDragging } = useSortable({
    id: body.learner.id,
    index,
    group: groupKey,
    type: "learner",
    accept: "learner",
  });
  return (
    <div
      ref={ref}
      className={cn(ROW_BASE, isDragging && "opacity-60", animate && "squad-enter")}
      style={animate ? { animationDelay: `${entranceDelay}ms` } : undefined}
    >
      <button
        ref={handleRef}
        type="button"
        aria-label="Drag learner"
        className="flex cursor-grab touch-none items-center text-muted-foreground hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical className="size-3.5" />
      </button>
      <MemberBody {...body} />
    </div>
  );
}

type ColumnShellProps = {
  accent: (typeof GROUP_ACCENTS)[number];
  label: string;
  count: number;
  hasLeader: boolean;
  bodyRef?: (element: Element | null) => void;
  isDropTarget?: boolean;
  /** Show "Drop learners here" when empty (drag mode). */
  dropHint?: boolean;
  reservedHeight: number;
  children: ReactNode;
};

/** A group card: header, members, and an empty-state hint. */
function ColumnShell({ accent, label, count, hasLeader, bodyRef, isDropTarget, dropHint, reservedHeight, children }: ColumnShellProps) {
  return (
    <Card className={cn(accent.border, "gap-0 border-t-4 py-4 transition-shadow", isDropTarget && "ring-2 ring-primary")}>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={cn("size-2.5 rounded-full", accent.dot)} />
            <span className="font-semibold">{label}</span>
            {!hasLeader && count > 0 && <span className="text-[11px] text-muted-foreground">no leader</span>}
          </div>
          <span className="text-xs text-muted-foreground">
            {count} {count === 1 ? "member" : "members"}
          </span>
        </div>
        <div ref={bodyRef} className="mt-2 space-y-0.5" style={{ minHeight: reservedHeight }}>
          {children}
        </div>
        {/* Toggled with CSS, never mounted/unmounted next to the sortable rows — that would crash dnd-kit. */}
        {dropHint && <p className={cn("py-2 text-center text-xs text-muted-foreground", count !== 0 && "hidden")}>Drop learners here</p>}
      </CardContent>
    </Card>
  );
}

function DroppableColumn({ id, ...shell }: Omit<ColumnShellProps, "bodyRef" | "isDropTarget" | "dropHint"> & { id: string }) {
  const { ref, isDropTarget } = useDroppable({ id, type: "column", accept: "learner" });
  return <ColumnShell {...shell} bodyRef={ref} isDropTarget={isDropTarget} dropHint />;
}

/** The bottom pool in drag mode: drop a learner here to take them out of a group. */
function UnassignedDropCard({
  members,
  leaders,
  onToggleLeader,
  animate,
}: {
  members: Learner[];
  leaders: Set<number>;
  onToggleLeader: (id: number) => void;
  animate: boolean;
}) {
  const { ref, isDropTarget } = useDroppable({ id: UNASSIGNED, type: "column", accept: "learner" });
  return (
    <Card
      className={cn(
        "shrink-0 gap-0 border-2 border-dashed border-muted-foreground/30 bg-transparent py-4 shadow-none transition-shadow",
        isDropTarget && "ring-2 ring-primary",
      )}
    >
      <CardContent>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium">Unassigned</span>
          <span className="text-xs text-muted-foreground">
            {members.length} {members.length === 1 ? "learner" : "learners"}
          </span>
        </div>
        <div ref={ref} className="grid max-h-[30vh] grid-cols-1 gap-0.5 overflow-auto sm:grid-cols-2 lg:grid-cols-3">
          {members.map((learner, idx) => (
            <SortableMember
              key={learner.id}
              learner={learner}
              index={idx}
              groupKey={UNASSIGNED}
              isLeader={leaders.has(learner.id)}
              accentDot="bg-muted-foreground"
              onToggleLeader={onToggleLeader}
              animate={animate}
              entranceDelay={idx * 45}
            />
          ))}
        </div>
        <p className={cn("py-2 text-center text-xs text-muted-foreground", members.length !== 0 && "hidden")}>Drop learners here</p>
      </CardContent>
    </Card>
  );
}

/** What the game hands back so it can pick up where it left off after being closed. */
export interface SquadMemory {
  /** The class list it applies to; a different list starts over. */
  learnerKey: string;
  numGroups: number;
  lists: Lists | null;
  grouped: boolean;
  leaderIds: number[];
  dragEnabled: boolean;
}

const keyOf = (learners: Learner[]) => learners.map((l) => l.id).join(",");

export function SquadUp({
  learners,
  memory,
  onMemoryChange,
}: {
  learners: Learner[];
  /** Saved state from an earlier opening (e.g. the class record's drawer). */
  memory?: SquadMemory | null;
  onMemoryChange?: (memory: SquadMemory) => void;
}) {
  const learnerKey = keyOf(learners);
  const remembered = memory && memory.learnerKey === learnerKey ? memory : null;
  const maxGroups = Math.max(1, learners.length);
  const [numGroups, setNumGroups] = useState(
    () => remembered?.numGroups ?? Math.min(learners.length >= 8 ? 4 : 2, maxGroups),
  );
  const [lists, setLists] = useState<Lists | null>(remembered?.lists ?? null);
  const [phase, setPhase] = useState<Phase>(remembered?.grouped && remembered.lists ? "grouped" : "idle");
  const [isShuffling, setIsShuffling] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [leaders, setLeaders] = useState<Set<number>>(() => new Set(remembered?.leaderIds ?? []));
  // Drag & drop is opt-in so the shuffle animation stays clean.
  const [dragEnabled, setDragEnabled] = useState(remembered?.dragEnabled ?? false);
  // Briefly true after a shuffle so members animate into their group.
  const [animateEntrance, setAnimateEntrance] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const shuffleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const entranceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Lists at drag start, to revert a canceled drag.
  const dragSnapshot = useRef<Lists | null>(null);
  // FLIP travel: each learner's position in the roster card just before the
  // shuffle, so the layout effect can fly them up into their group once.
  const flipFirst = useRef<Map<number, { x: number; y: number }>>(new Map());
  const flipPending = useRef(false);

  const learnerById = useMemo(() => new Map(learners.map((l) => [l.id, l])), [learners]);
  const isGrouped = phase === "grouped" && lists !== null;
  const groupKeys = useMemo(() => Array.from({ length: numGroups }, (_, i) => String(i)), [numGroups]);
  const clampGroups = useCallback((value: number) => Math.min(Math.max(1, value), maxGroups), [maxGroups]);

  // A balanced deal puts at most ceil(learners / groups) in a group; reserving
  // that many rows keeps every card the same height.
  const reservedHeight = Math.max(MIN_BODY_H, Math.ceil(learners.length / numGroups) * ROW_H);
  const toLearners = (ids: number[] = []) => ids.map((id) => learnerById.get(id)).filter((l): l is Learner => l !== undefined);
  const unassignedMembers = toLearners(lists?.[UNASSIGNED]);
  const bottomMembers = isGrouped ? unassignedMembers : learners;

  // A changed class list starts over; the first render keeps what was restored from memory.
  const learnerKeyRef = useRef(learnerKey);
  useEffect(() => {
    if (learnerKeyRef.current === learnerKey) return;
    learnerKeyRef.current = learnerKey;
    setLists(null);
    setPhase("idle");
    setLeaders(new Set());
    setNumGroups((n) => Math.min(Math.max(1, n), Math.max(1, learners.length)));
  }, [learners, learnerKey]);

  // Report the groups so a later opening resumes them.
  useEffect(() => {
    onMemoryChange?.({
      learnerKey,
      numGroups,
      lists,
      grouped: phase === "grouped",
      leaderIds: [...leaders],
      dragEnabled,
    });
  }, [learnerKey, numGroups, lists, phase, leaders, dragEnabled, onMemoryChange]);

  useEffect(
    () => () => {
      if (shuffleTimer.current) clearTimeout(shuffleTimer.current);
      if (entranceTimer.current) clearTimeout(entranceTimer.current);
    },
    [],
  );

  const triggerEntrance = useCallback(() => {
    setAnimateEntrance(true);
    if (entranceTimer.current) clearTimeout(entranceTimer.current);
    entranceTimer.current = setTimeout(() => setAnimateEntrance(false), 1400);
  }, []);

  const captureRosterPositions = useCallback(() => {
    const map = flipFirst.current;
    map.clear();
    containerRef.current?.querySelectorAll<HTMLElement>("[data-roster-id]").forEach((el) => {
      const r = el.getBoundingClientRect();
      map.set(Number(el.dataset.rosterId), { x: r.left, y: r.top });
    });
  }, []);

  // FLIP: after the roster becomes group cards, fly each member from its old
  // roster spot into its new group. Once per shuffle, drag-off layout only.
  useLayoutEffect(() => {
    if (!flipPending.current) return;
    flipPending.current = false;
    const first = flipFirst.current;
    if (!containerRef.current || first.size === 0) return;
    containerRef.current.querySelectorAll<HTMLElement>("[data-member-id]").forEach((el) => {
      const from = first.get(Number(el.dataset.memberId));
      if (!from) return;
      const rect = el.getBoundingClientRect();
      const dx = from.x - rect.left;
      const dy = from.y - rect.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      const delay = Number(el.dataset.delay) || 0;
      el.style.transition = "none";
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      void el.offsetWidth; // commit the start frame before animating home
      const onEnd = () => {
        el.style.transition = "";
        el.style.transform = "";
        el.removeEventListener("transitionend", onEnd);
      };
      el.addEventListener("transitionend", onEnd);
      requestAnimationFrame(() => {
        el.style.transition = `transform 0.65s cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`;
        el.style.transform = "translate(0, 0)";
      });
    });
    first.clear();
  }, [lists, phase]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen();
    else containerRef.current?.requestFullscreen();
  }, []);

  /** Go: shuffle everyone into balanced groups. */
  const go = useCallback(() => {
    if (learners.length === 0 || isShuffling) return;
    setIsShuffling(true);
    if (shuffleTimer.current) clearTimeout(shuffleTimer.current);
    shuffleTimer.current = setTimeout(() => {
      // Drag mode has no static rows to measure, so it uses the rise entrance instead of FLIP.
      if (dragEnabled) triggerEntrance();
      else {
        captureRosterPositions();
        flipPending.current = true;
      }
      setLists(syncUnassignedBucket(makeGroups(learners, clampGroups(numGroups), leaders), dragEnabled));
      setPhase("grouped");
      setIsShuffling(false);
    }, 600);
  }, [learners, isShuffling, numGroups, clampGroups, leaders, dragEnabled, triggerEntrance, captureRosterPositions]);

  const reset = useCallback(() => {
    if (shuffleTimer.current) clearTimeout(shuffleTimer.current);
    shuffleTimer.current = null;
    setIsShuffling(false);
    setLists(null);
    setPhase("idle");
    flipPending.current = false;
    flipFirst.current.clear();
  }, []);

  const toggleLeader = useCallback(
    (id: number) => {
      if (isShuffling) return;
      setLeaders((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [isShuffling],
  );

  /** Crowns one random member in every group that has no leader yet, and moves them to the top. */
  const pickRandomLeaders = useCallback(() => {
    if (!lists) return;
    const nextLeaders = new Set(leaders);
    const nextLists: Lists = { ...lists };
    for (const key of groupKeys) {
      const ids = lists[key] ?? [];
      if (ids.length === 0 || ids.some((id) => nextLeaders.has(id))) continue;
      const pick = ids[Math.floor(Math.random() * ids.length)];
      nextLeaders.add(pick);
      nextLists[key] = [pick, ...ids.filter((id) => id !== pick)];
    }
    setLeaders(nextLeaders);
    setLists(nextLists);
  }, [lists, leaders, groupKeys]);

  const handleDragToggle = useCallback((checked: boolean) => {
    setDragEnabled(checked);
    setLists((prev) => (prev ? syncUnassignedBucket(prev, checked) : prev));
  }, []);

  const groupsWithoutLeader = isGrouped
    ? groupKeys.filter((k) => (lists[k] ?? []).length > 0 && !(lists[k] ?? []).some((id) => leaders.has(id))).length
    : 0;

  const hint = isShuffling
    ? "Shuffling…"
    : isGrouped
      ? `${numGroups} groups ready${dragEnabled ? " — drag learners between groups." : "."}`
      : learners.length === 0
        ? "Add learners to this section to play."
        : "Choose the number of groups, then press Go.";

  // Staggered landing so members arrive one after another.
  const entranceDelay = (groupIndex: number, memberIndex: number) => groupIndex * 60 + memberIndex * 45;

  // Group cards: draggable only while Drag & drop is on, so the default path
  // has no dnd-kit DOM handling to clash with the shuffle animation.
  const columns = groupKeys.map((key, gi) => {
    const accent = GROUP_ACCENTS[gi % GROUP_ACCENTS.length];
    const members = toLearners(lists?.[key]);
    const rows = members.map((learner, idx) =>
      dragEnabled ? (
        <SortableMember
          key={learner.id}
          learner={learner}
          index={idx}
          groupKey={key}
          isLeader={leaders.has(learner.id)}
          accentDot={accent.dot}
          onToggleLeader={toggleLeader}
          animate={animateEntrance}
          entranceDelay={entranceDelay(gi, idx)}
        />
      ) : (
        <MemberRow
          key={learner.id}
          learner={learner}
          isLeader={leaders.has(learner.id)}
          accentDot={accent.dot}
          onToggleLeader={toggleLeader}
          animate={animateEntrance}
          entranceDelay={entranceDelay(gi, idx)}
        />
      ),
    );
    const shell = {
      accent,
      label: `Group ${gi + 1}`,
      count: members.length,
      hasLeader: members.some((l) => leaders.has(l.id)),
      reservedHeight,
    };
    return dragEnabled ? (
      <DroppableColumn key={key} id={key} {...shell}>
        {rows}
      </DroppableColumn>
    ) : (
      <ColumnShell key={key} {...shell}>
        {rows}
      </ColumnShell>
    );
  });

  const GRID = "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

  return (
    <div ref={containerRef} className={cn("flex min-h-0 flex-1 flex-col gap-4", isFullscreen && "h-full overflow-auto bg-background p-6")}>
      <Card className="shrink-0 py-4">
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Groups</span>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Fewer groups"
                  disabled={numGroups <= 1 || phase !== "idle"}
                  onClick={() => setNumGroups((n) => clampGroups(n - 1))}
                >
                  <Minus />
                </Button>
                <Input
                  type="number"
                  min={1}
                  max={maxGroups}
                  value={numGroups}
                  disabled={phase !== "idle"}
                  onChange={(e) => setNumGroups(clampGroups(Number(e.target.value) || 1))}
                  className="h-8 w-16 text-center"
                />
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="More groups"
                  disabled={numGroups >= maxGroups || phase !== "idle"}
                  onClick={() => setNumGroups((n) => clampGroups(n + 1))}
                >
                  <Plus />
                </Button>
              </div>
              <Button size="lg" onClick={go} disabled={learners.length === 0 || isShuffling || isGrouped}>
                <Play className={isShuffling ? "animate-spin" : ""} />
                {isShuffling ? "Shuffling…" : "Go"}
              </Button>
              <p className="text-sm font-medium text-muted-foreground" aria-live="polite">
                {hint}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isGrouped && (
                <>
                  <Button variant="outline" size="sm" onClick={pickRandomLeaders} disabled={groupsWithoutLeader === 0}>
                    <Dices /> Random leaders
                  </Button>
                  <Button variant="outline" size="sm" onClick={reset}>
                    <RotateCcw /> Reset
                  </Button>
                </>
              )}
              <Button variant="outline" size="sm" onClick={toggleFullscreen}>
                {isFullscreen ? <Minimize /> : <Maximize />}
                {isFullscreen ? "Exit full screen" : "Full screen"}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {isGrouped && (
                <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                  <Switch checked={dragEnabled} onCheckedChange={handleDragToggle} />
                  Drag &amp; drop
                </label>
              )}
              {!isShuffling && (
                <span className="flex items-center gap-1.5">
                  <Crown className="size-3 text-amber-500" />
                  {!isGrouped
                    ? "Click learners below to make them leaders — each group gets one."
                    : dragEnabled
                      ? "Drag learners between groups, or click one to crown a leader."
                      : "Click a learner to crown or uncrown a leader, or press Random leaders."}
                </span>
              )}
            </div>
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Users className="size-4" />
              {learners.length} learners · {numGroups} groups
              {leaders.size > 0 && ` · ${leaders.size} ${leaders.size === 1 ? "leader" : "leaders"}`}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="flex min-h-0 flex-1 flex-col gap-4">
        {isGrouped && dragEnabled ? (
          <DragDropProvider
            onDragStart={() => {
              dragSnapshot.current = lists;
            }}
            onDragOver={(event) => {
              // Commit moves as they happen so React stays in step with dnd-kit's
              // live reordering; keep the empty Unassigned bucket so its card never unmounts mid-drag.
              setLists((prev) => {
                if (!prev) return prev;
                const next = move(prev, event) as Lists;
                if (UNASSIGNED in prev && !(UNASSIGNED in next)) next[UNASSIGNED] = [];
                return next;
              });
            }}
            onDragEnd={(event) => {
              if (event.canceled && dragSnapshot.current) setLists(dragSnapshot.current);
              dragSnapshot.current = null;
            }}
          >
            <div className="min-h-0 flex-1 overflow-auto">
              <div className={GRID}>{columns}</div>
            </div>
            <UnassignedDropCard members={unassignedMembers} leaders={leaders} onToggleLeader={toggleLeader} animate={animateEntrance} />
          </DragDropProvider>
        ) : (
          <>
            {isGrouped && (
              <div className="min-h-0 flex-1 overflow-auto">
                <div className={GRID}>{columns}</div>
              </div>
            )}
            {/* The roster: before a shuffle it holds everyone (click to set leaders); after, any leftovers. */}
            {(!isGrouped || bottomMembers.length > 0) && (
              <Card className="shrink-0 gap-0 border-2 border-dashed border-muted-foreground/30 bg-transparent py-4 shadow-none">
                <CardContent>
                  <p className="mb-2 text-sm font-medium">
                    {isGrouped ? (
                      "Unassigned"
                    ) : (
                      <>
                        Learners <span className="font-normal text-muted-foreground">— click to make group leaders</span>
                      </>
                    )}
                  </p>
                  {bottomMembers.length === 0 ? (
                    <p className="py-2 text-center text-sm text-muted-foreground">No learners in this section yet.</p>
                  ) : (
                    <div className="grid max-h-[50vh] grid-cols-1 gap-1 overflow-auto sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {bottomMembers.map((l) => {
                        const isLeader = leaders.has(l.id);
                        return (
                          <button
                            key={l.id}
                            type="button"
                            data-roster-id={l.id}
                            onClick={() => toggleLeader(l.id)}
                            className={cn(
                              "flex items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-accent",
                              isLeader && "bg-amber-50",
                            )}
                          >
                            <span
                              className={cn(
                                "flex size-7 shrink-0 items-center justify-center rounded-full border bg-muted text-[10px] font-bold text-muted-foreground",
                                isLeader && "ring-2 ring-amber-500 ring-offset-1",
                              )}
                            >
                              {initials(l)}
                            </span>
                            <span className={cn("truncate text-sm", isLeader && "font-semibold")}>{fullName(l)}</span>
                            {isLeader && <Crown className="ml-auto size-3.5 shrink-0 fill-amber-400 text-amber-500" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
