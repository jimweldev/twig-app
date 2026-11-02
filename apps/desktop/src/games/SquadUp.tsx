// Squad Up — shuffles a section into balanced groups. Learners marked as
// leaders are dealt one per group first; after grouping, the teacher can crown
// leaders, pick random ones, or drag learners between groups. Ported from the
// twig-desktop reference project (without its saved groups).

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { move } from "@dnd-kit/helpers";
import { DragDropProvider, useDroppable } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import {
  Check,
  Crown,
  Dices,
  FastForward,
  GripVertical,
  Maximize,
  Minimize,
  Minus,
  Play,
  Plus,
  RotateCcw,
  Save,
  Users,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { saveGroups, updateSavedGroups, type Learner, type SavedGrouping } from "@/lib/db";
import "./games.css";
import { toast } from "sonner";

// A distinct accent per group so groups are easy to tell apart.
export const GROUP_ACCENTS = [
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

/** idle: picking leaders; dealing: learners fly from the deck into groups one by one. */
type Phase = "idle" | "dealing" | "grouped";
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
 * The order cards are dealt in: round by round, groups taking turns in a random order,
 * so each group fills up a learner at a time like a hand of cards.
 */
export function dealOrder(lists: Lists): { id: number; key: string }[] {
  const keys = shuffle(Object.keys(lists));
  const rounds = Math.max(0, ...keys.map((k) => lists[k].length));
  const order: { id: number; key: string }[] = [];
  for (let r = 0; r < rounds; r++)
    for (const key of keys) if (r < lists[key].length) order.push({ id: lists[key][r], key });
  return order;
}

/** Time between two cards: quick for big classes, so a deal takes a few seconds at most. */
const dealGap = (count: number) => Math.min(320, Math.max(80, 5000 / Math.max(1, count)));

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
function SortableMember({
  index,
  groupKey,
  animate,
  entranceDelay,
  ...body
}: RowProps & { index: number; groupKey: string }) {
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
function ColumnShell({
  accent,
  label,
  count,
  hasLeader,
  bodyRef,
  isDropTarget,
  dropHint,
  reservedHeight,
  children,
}: ColumnShellProps) {
  return (
    <Card
      className={cn(accent.border, "gap-0 border-t-4 py-4 transition-shadow", isDropTarget && "ring-2 ring-primary")}
    >
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
        {dropHint && (
          <p className={cn("py-2 text-center text-xs text-muted-foreground", count !== 0 && "hidden")}>
            Drop learners here
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function DroppableColumn({
  id,
  ...shell
}: Omit<ColumnShellProps, "bodyRef" | "isDropTarget" | "dropHint"> & { id: string }) {
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
        <p className={cn("py-2 text-center text-xs text-muted-foreground", members.length !== 0 && "hidden")}>
          Drop learners here
        </p>
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

/**
 * A saved set of groups as Squad Up's starting state, with drag on so it can be reworked.
 * Learners added to the section since wait in Unassigned; removed ones are dropped.
 */
export function memoryFromSaved(saved: SavedGrouping, learners: Learner[]): SquadMemory {
  const present = new Set(learners.map((l) => l.id));
  const lists: Lists = {};
  saved.groups.forEach((g, i) => (lists[String(i)] = g.learnerIds.filter((id) => present.has(id))));
  const placed = new Set(Object.values(lists).flat());
  lists[UNASSIGNED] = learners.filter((l) => !placed.has(l.id)).map((l) => l.id);
  return {
    learnerKey: keyOf(learners),
    numGroups: Math.max(1, saved.groups.length),
    lists,
    grouped: true,
    leaderIds: saved.groups.flatMap((g) => (g.leaderId !== null && present.has(g.leaderId) ? [g.leaderId] : [])),
    dragEnabled: true,
  };
}

export function SquadUp({
  learners,
  sectionId,
  regrouping,
  memory,
  onMemoryChange,
  onError,
}: {
  learners: Learner[];
  /** The section the learners belong to; groups can be saved to it when given. */
  sectionId?: number;
  /** A saved set being regrouped: saving can update it instead of adding a new one. */
  regrouping?: SavedGrouping;
  onError?: (e: unknown) => void;
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
  // The learners still waiting in the deck while dealing, in deal order.
  const [deck, setDeck] = useState<number[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [leaders, setLeaders] = useState<Set<number>>(() => new Set(remembered?.leaderIds ?? []));
  // Drag & drop is opt-in so the shuffle animation stays clean.
  const [dragEnabled, setDragEnabled] = useState(remembered?.dragEnabled ?? false);

  const containerRef = useRef<HTMLDivElement>(null);
  const dealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Saving the groups: the name being typed, and the groups as last saved (to show "Saved").
  const [saveName, setSaveName] = useState<string | null>(null);
  // Starts as the regrouped set, so it reads "Saved" until something changes.
  const [savedLists, setSavedLists] = useState<string | null>(() =>
    regrouping ? JSON.stringify(regrouping.groups) : null,
  );
  // The saved set an update writes to: the one being regrouped, until saved as new.
  const [updating, setUpdating] = useState(regrouping ?? null);
  // The finished groups while dealing, to jump to on Skip.
  const dealTarget = useRef<Lists | null>(null);
  const flyFrom = useRef<{ id: number; x: number; y: number } | null>(null);
  // Lists at drag start, to revert a canceled drag.
  const dragSnapshot = useRef<Lists | null>(null);
  const learnerById = useMemo(() => new Map(learners.map((l) => [l.id, l])), [learners]);
  const isGrouped = phase === "grouped" && lists !== null;
  const groupKeys = useMemo(() => Array.from({ length: numGroups }, (_, i) => String(i)), [numGroups]);
  const clampGroups = useCallback((value: number) => Math.min(Math.max(1, value), maxGroups), [maxGroups]);

  // A balanced deal puts at most ceil(learners / groups) in a group; reserving
  // that many rows keeps every card the same height.
  const reservedHeight = Math.max(MIN_BODY_H, Math.ceil(learners.length / numGroups) * ROW_H);
  const toLearners = (ids: number[] = []) =>
    ids.map((id) => learnerById.get(id)).filter((l): l is Learner => l !== undefined);
  const unassignedMembers = toLearners(lists?.[UNASSIGNED]);
  // The list at the bottom: everyone before a deal, those still waiting while dealing, leftovers after.
  // While dealing everyone keeps their place, so learners already dealt leave a blank spot.
  const bottomMembers = phase === "dealing" ? learners : isGrouped ? unassignedMembers : learners;
  const waiting = new Set(deck);

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
      if (dealTimer.current) clearTimeout(dealTimer.current);
    },
    [],
  );

  // Each dealt learner flies as a card from the deck to their new row. The card is a copy
  // laid over everything, so the scrolling group area can't clip it mid-flight; the real
  // row shows once it lands.
  useLayoutEffect(() => {
    const from = flyFrom.current;
    const container = containerRef.current;
    if (!from || !container) return;
    flyFrom.current = null;
    const row = container.querySelector<HTMLElement>(`[data-member-id="${from.id}"]`);
    if (!row) return;
    const to = row.getBoundingClientRect();
    const card = row.cloneNode(true) as HTMLElement;
    card.removeAttribute("data-member-id");
    Object.assign(card.style, {
      position: "fixed",
      left: `${to.left}px`,
      top: `${to.top}px`,
      width: `${to.width}px`,
      height: `${to.height}px`,
      margin: "0",
      zIndex: "70",
      pointerEvents: "none",
      borderRadius: "0.5rem",
      boxShadow: "0 8px 20px rgb(0 0 0 / 0.18)",
    });
    // In full screen only the game is shown, so the card has to live inside it.
    (document.fullscreenElement === container ? container : document.body).appendChild(card);
    row.style.opacity = "0";
    const land = () => {
      card.remove();
      row.style.opacity = "";
    };
    const flight = card.animate(
      [
        { transform: `translate(${from.x - to.left}px, ${from.y - to.top}px) rotate(-8deg) scale(1.05)` },
        { transform: "translate(0, 0) rotate(0) scale(1)" },
      ],
      { duration: 420, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
    flight.onfinish = land;
    // Never leave a row hidden if the animation doesn't finish (e.g. the window is minimized).
    setTimeout(land, 900);
  }, [lists]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen();
    else containerRef.current?.requestFullscreen();
  }, []);

  const finishDeal = useCallback(
    (target: Lists) => {
      if (dealTimer.current) clearTimeout(dealTimer.current);
      dealTimer.current = null;
      dealTarget.current = null;
      flyFrom.current = null;
      setDeck([]);
      setLists(syncUnassignedBucket(target, dragEnabled));
      setPhase("grouped");
    },
    [dragEnabled],
  );

  /** Go: shuffle into balanced groups, then deal learners from the deck one at a time. */
  const go = useCallback(() => {
    if (learners.length === 0 || phase !== "idle") return;
    const target = makeGroups(learners, clampGroups(numGroups), leaders);
    const order = dealOrder(target);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finishDeal(target);
      return;
    }
    dealTarget.current = target;
    setLists(Object.fromEntries(Object.keys(target).map((k) => [k, []])));
    setDeck(order.map((o) => o.id));
    setPhase("dealing");
    const gap = dealGap(order.length);
    const dealNext = (i: number) => {
      if (i >= order.length) {
        dealTimer.current = setTimeout(() => finishDeal(target), 450);
        return;
      }
      const { id, key } = order[i];
      // Each learner leaves from their own spot in the list at the bottom.
      const spot = containerRef.current?.querySelector(`[data-roster-id="${id}"]`)?.getBoundingClientRect();
      if (spot) flyFrom.current = { id, x: spot.left, y: spot.top };
      setDeck((d) => d.slice(1));
      setLists((prev) => (prev ? { ...prev, [key]: [...(prev[key] ?? []), id] } : prev));
      dealTimer.current = setTimeout(() => dealNext(i + 1), gap);
    };
    // A beat for the empty groups and the deck to appear before the first card flies.
    dealTimer.current = setTimeout(() => dealNext(0), 350);
  }, [learners, phase, numGroups, clampGroups, leaders, finishDeal]);

  const skipDeal = useCallback(() => {
    if (dealTarget.current) finishDeal(dealTarget.current);
  }, [finishDeal]);

  const groupsToSave = () =>
    groupKeys.map((k) => {
      const ids = lists?.[k] ?? [];
      return { learnerIds: ids, leaderId: ids.find((id) => leaders.has(id)) ?? null };
    });
  const savedNow = savedLists !== null && savedLists === JSON.stringify(groupsToSave());

  const save = async (asNew: boolean) => {
    if (sectionId === undefined || saveName === null || !saveName.trim()) return;
    try {
      const groups = groupsToSave();
      if (updating && !asNew) {
        await updateSavedGroups(updating.id, saveName, groups);
        setUpdating({ ...updating, name: saveName.trim(), groups });
      } else {
        const id = await saveGroups(sectionId, saveName, groups);
        setUpdating({ id, section_id: sectionId, name: saveName.trim(), groups, created_at: "" });
      }
      setSavedLists(JSON.stringify(groups));
      setSaveName(null);
      toast.success(updating && !asNew ? "Groups updated" : "Groups saved", {
        description: "Find them in the section's Groups tab.",
      });
    } catch (e) {
      onError?.(e);
    }
  };

  const reset = useCallback(() => {
    if (dealTimer.current) clearTimeout(dealTimer.current);
    dealTimer.current = null;
    dealTarget.current = null;
    flyFrom.current = null;
    setDeck([]);
    setLists(null);
    setPhase("idle");
  }, []);

  const toggleLeader = useCallback(
    (id: number) => {
      if (phase === "dealing") return;
      setLeaders((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [phase],
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

  const dealing = phase === "dealing";
  const hint = dealing
    ? `Dealing… ${deck.length} left`
    : isGrouped
      ? `${numGroups} groups ready${dragEnabled ? " — drag learners between groups." : "."}`
      : learners.length === 0
        ? "Add learners to this section to play."
        : "Choose the number of groups, then press Go.";

  // Group cards: draggable only while Drag & drop is on, so the default path
  // has no dnd-kit DOM handling to clash with the shuffle animation.
  const columns = groupKeys.map((key, gi) => {
    const accent = GROUP_ACCENTS[gi % GROUP_ACCENTS.length];
    const members = toLearners(lists?.[key]);
    const rows = members.map((learner, idx) =>
      dragEnabled && isGrouped ? (
        <SortableMember
          key={learner.id}
          learner={learner}
          index={idx}
          groupKey={key}
          isLeader={leaders.has(learner.id)}
          accentDot={accent.dot}
          onToggleLeader={toggleLeader}
          animate={false}
          entranceDelay={0}
        />
      ) : (
        <MemberRow
          key={learner.id}
          learner={learner}
          isLeader={leaders.has(learner.id)}
          accentDot={accent.dot}
          onToggleLeader={toggleLeader}
          animate={false}
          entranceDelay={0}
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
    return dragEnabled && isGrouped ? (
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
    <div
      ref={containerRef}
      className={cn("flex min-h-0 flex-1 flex-col gap-4", isFullscreen && "h-full overflow-auto bg-background p-6")}
    >
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
              {dealing ? (
                <Button size="lg" variant="outline" onClick={skipDeal}>
                  <FastForward /> Skip
                </Button>
              ) : (
                <Button size="lg" onClick={go} disabled={learners.length === 0 || isGrouped}>
                  <Play /> Go
                </Button>
              )}
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
                  {sectionId !== undefined && (
                    <Button
                      size="sm"
                      disabled={savedNow}
                      onClick={() =>
                        setSaveName(
                          updating?.name ??
                            `Groups – ${new Date().toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}`,
                        )
                      }
                    >
                      {savedNow ? <Check /> : <Save />} {savedNow ? "Saved" : "Save groups"}
                    </Button>
                  )}
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
              {!dealing && (
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
            <UnassignedDropCard
              members={unassignedMembers}
              leaders={leaders}
              onToggleLeader={toggleLeader}
              animate={false}
            />
          </DragDropProvider>
        ) : (
          <>
            {/* The groups show from the start, empty until the deal fills them. */}
            <div className="min-h-0 flex-1 overflow-auto">
              <div className={GRID}>{columns}</div>
            </div>
            {/* The roster: before a deal it holds everyone (click to set leaders); after, any leftovers. */}
            {(phase === "idle" || (dealing ? deck.length > 0 : bottomMembers.length > 0)) && (
              <Card className="shrink-0 gap-0 border-2 border-dashed border-muted-foreground/30 bg-transparent py-4 shadow-none">
                <CardContent>
                  <p className="mb-2 text-sm font-medium">
                    {isGrouped ? (
                      "Unassigned"
                    ) : dealing ? (
                      <>
                        Learners <span className="font-normal text-muted-foreground">— waiting to be dealt</span>
                      </>
                    ) : (
                      <>
                        Learners{" "}
                        <span className="font-normal text-muted-foreground">— click to make group leaders</span>
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
                              dealing && !waiting.has(l.id) && "invisible",
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
      <Dialog open={saveName !== null} onOpenChange={(o) => !o && setSaveName(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{updating ? `Save “${updating.name}”` : "Save groups"}</DialogTitle>
            <DialogDescription>
              {updating
                ? "Update the saved groups, or keep them and save these as a new set."
                : "Saved groups show in the section’s Groups tab."}
            </DialogDescription>
          </DialogHeader>
          <form
            id="save-groups"
            onSubmit={(e) => {
              e.preventDefault();
              save(false);
            }}
          >
            <Input
              autoFocus
              aria-label="Name"
              placeholder="e.g. Science project groups"
              value={saveName ?? ""}
              onChange={(e) => setSaveName(e.target.value)}
            />
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveName(null)}>
              Cancel
            </Button>
            {updating && (
              <Button variant="outline" disabled={!saveName?.trim()} onClick={() => save(true)}>
                Save as new
              </Button>
            )}
            <Button type="submit" form="save-groups" disabled={!saveName?.trim()}>
              <Save /> {updating ? "Update" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
