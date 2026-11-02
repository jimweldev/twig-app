import { useEffect, useState, type ReactNode } from "react";
import { Crown, Lasso, Play, Users } from "lucide-react";
import { useRouter } from "@/app/router";
import { useSchool } from "@/app/school";
import { EmptyState, PageHeader } from "@/components/page";
import { SimpleSelect } from "@/components/simple-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { gradeLabel } from "@/ecr/levels";
import { CssAnimal, CssCowboy } from "@/games/farm-art";
import { RoundEmUp } from "@/games/RoundEmUp";
import { memoryFromSaved, SquadUp } from "@/games/SquadUp";
import { getSavedGroups, listLearners, type Learner, type SavedGrouping, type Section } from "@/lib/db";
import "@/games/games.css";

export type GameId = "round-em-up" | "squad-up";

export const GAMES: Record<GameId, { title: string; tagline: string }> = {
  "round-em-up": { title: "Round 'Em Up", tagline: "Random learner picker" },
  "squad-up": { title: "Squad Up", tagline: "Random group maker" },
};

function GameCard({
  cover,
  icon,
  game,
  description,
  onPlay,
}: {
  cover: ReactNode;
  icon: ReactNode;
  game: GameId;
  description: string;
  onPlay: (() => void) | null;
}) {
  return (
    <Card className="overflow-hidden pt-0">
      <div className="relative h-36 overflow-hidden">{cover}</div>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon} {GAMES[game].title}
          <span className="text-xs font-normal text-muted-foreground">· {GAMES[game].tagline}</span>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button disabled={!onPlay} onClick={() => onPlay?.()}>
          <Play /> Play
        </Button>
      </CardContent>
    </Card>
  );
}

/** Pick a section, then a game to play with its learners. */
export function GamesPage() {
  const { navigate } = useRouter();
  const { sections } = useSchool();
  const [sectionId, setSectionId] = useState<number | null>(
    () => (sections.find((s) => s.is_advisory) ?? sections[0])?.id ?? null,
  );
  const play = (game: GameId) => (sectionId === null ? null : () => navigate({ page: "game", game, sectionId }));

  return (
    <div className="page">
      <PageHeader
        title="Games"
        description="Quick classroom games that run offline with your learners."
        actions={
          sections.length > 0 && (
            <SimpleSelect
              className="w-64"
              value={sectionId === null ? "" : String(sectionId)}
              onValueChange={(v) => setSectionId(Number(v))}
              options={sections.map((s) => ({
                value: String(s.id),
                label: `${gradeLabel(s.grade_level)} – ${s.name} (${s.learner_count})`,
              }))}
            />
          )
        }
      />

      {sections.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No sections yet">
            <p>Games use a section's learners. Add a section and its learners first.</p>
            <Button className="mt-4" onClick={() => navigate({ page: "sections" })}>
              Go to sections
            </Button>
          </EmptyState>
        </div>
      ) : (
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <GameCard
            game="round-em-up"
            icon={<Lasso className="size-5 text-amber-600" />}
            description="Every learner is a farm animal in front of the barn. The cowboy throws his lasso and ropes one at random — a fair way to call on someone."
            onPlay={play("round-em-up")}
            cover={
              <div className="absolute inset-0 bg-[linear-gradient(to_bottom,#38bdf8_0%,#bae6fd_45%,#ffedd5_46%,#fed7aa_100%)]">
                {/* Wrappers do the positioning: .cb/.ca set position: relative. */}
                <div className="absolute bottom-3 left-8">
                  <CssCowboy size={52} />
                </div>
                <div className="absolute right-24 bottom-6">
                  <CssAnimal kind="cow" size={36} />
                </div>
                <div className="absolute right-12 bottom-10">
                  <CssAnimal kind="pig" size={30} delay={1} />
                </div>
                <div className="absolute right-40 bottom-12">
                  <CssAnimal kind="sheep" size={32} delay={2} />
                </div>
                <div className="absolute right-6 bottom-4">
                  <CssAnimal kind="chicken" size={24} delay={3} />
                </div>
              </div>
            }
          />
          <GameCard
            game="squad-up"
            icon={<Users className="size-5 text-violet-600" />}
            description="Shuffle the class into balanced groups. Pick leaders first so each group gets one, or crown random leaders after."
            onPlay={play("squad-up")}
            cover={
              <div className="absolute inset-0 flex items-center justify-center gap-3 bg-[linear-gradient(135deg,#a78bfa,#e879f9,#f472b6)] px-6">
                {["bg-rose-500", "bg-amber-500", "bg-emerald-500", "bg-sky-500"].map((dot, g) => (
                  <div key={dot} className="w-20 rounded-lg bg-white/90 p-2 shadow-md">
                    <div className="mb-1.5 flex items-center gap-1">
                      <span className={`size-2 rounded-full ${dot}`} />
                      <span className="h-1.5 w-8 rounded bg-stone-300" />
                    </div>
                    {[0, 1, 2].map((r) => (
                      <div key={r} className="mt-1 flex items-center gap-1">
                        <span className={`size-3 rounded-full ${dot} ${r === 0 ? "ring-2 ring-amber-400" : ""}`} />
                        <span className="h-1.5 flex-1 rounded bg-stone-200" />
                        {r === 0 && g % 2 === 0 && <Crown className="size-2.5 fill-amber-400 text-amber-500" />}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            }
          />
          <Card className="border-dashed md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                More games <Badge variant="secondary">Coming soon</Badge>
              </CardTitle>
              <CardDescription>Quick quizzes and more, all playable without internet.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      )}
    </div>
  );
}

/** One game, played with a section's learners. Opened from Games or from a class record. */
export function GamePage({ game, section, groupsId }: { game: GameId; section: Section; groupsId?: number }) {
  const { onError } = useSchool();
  const [learners, setLearners] = useState<Learner[] | null>(null);
  // A saved set of groups to regroup in Squad Up; undefined while loading.
  const [regrouping, setRegrouping] = useState<SavedGrouping | null | undefined>(groupsId ? undefined : null);

  useEffect(() => {
    listLearners(section.id).then(setLearners, onError);
  }, [section.id, onError]);
  useEffect(() => {
    if (groupsId) getSavedGroups(groupsId).then(setRegrouping, onError);
  }, [groupsId, onError]);

  return (
    <div className="flex h-full min-h-[640px] flex-col gap-4 p-6">
      <div>
        <h1 className="text-xl font-semibold">{GAMES[game].title}</h1>
        <p className="text-sm text-muted-foreground">
          {GAMES[game].tagline} · {gradeLabel(section.grade_level)} – {section.name}
        </p>
      </div>
      {learners &&
        regrouping !== undefined &&
        (game === "round-em-up" ? (
          <RoundEmUp learners={learners} />
        ) : (
          <SquadUp
            learners={learners}
            sectionId={section.id}
            regrouping={regrouping ?? undefined}
            memory={regrouping ? memoryFromSaved(regrouping, learners) : null}
            onError={onError}
          />
        ))}
    </div>
  );
}
