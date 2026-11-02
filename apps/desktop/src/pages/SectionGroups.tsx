import { useCallback, useEffect, useState } from "react";
import { Crown, Shuffle, Trash2, Users } from "lucide-react";
import { cn } from "cn";
import { useRouter } from "@/app/router";
import { ConfirmDelete } from "@/components/confirm-delete";
import { EmptyState } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { GROUP_ACCENTS } from "@/games/SquadUp";
import { deleteSavedGroups, listSavedGroups, type Learner, type SavedGrouping } from "@/lib/db";
import { displayName } from "@/lib/names";

const formatDate = (d: string) =>
  new Date(`${d.replace(" ", "T")}Z`).toLocaleDateString("en-PH", { dateStyle: "medium" });

/** Groups saved from Squad Up for this section, newest first. */
export function SectionGroups({
  sectionId,
  learners,
  onError,
}: {
  sectionId: number;
  learners: Learner[];
  onError: (e: unknown) => void;
}) {
  const { navigate } = useRouter();
  const [saved, setSaved] = useState<SavedGrouping[] | null>(null);
  const byId = new Map(learners.map((l) => [l.id, l]));

  const reload = useCallback(() => listSavedGroups(sectionId).then(setSaved, onError), [sectionId, onError]);
  useEffect(() => {
    reload();
  }, [reload]);

  const makeGroups = () => navigate({ page: "game", game: "squad-up", sectionId });

  if (saved === null) {
    return (
      <div className="flex flex-col gap-3" aria-busy aria-label="Loading">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (saved.length === 0) {
    return (
      <EmptyState title="No saved groups yet">
        <p>Make groups in Squad Up, then press Save groups. They&rsquo;ll show here.</p>
        <Button className="mt-4" onClick={makeGroups}>
          <Shuffle /> Make groups
        </Button>
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button variant="outline" onClick={makeGroups}>
          <Shuffle /> Make new groups
        </Button>
      </div>
      {saved.map((g) => (
        <Card key={g.id} className="gap-3 py-4">
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{g.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(g.created_at)} · {g.groups.length} groups
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                title="Open these groups in Squad Up to move learners, change leaders or reshuffle"
                onClick={() => navigate({ page: "game", game: "squad-up", sectionId, groupsId: g.id })}
              >
                <Users /> Regroup
              </Button>
              <ConfirmDelete
                title={`Delete “${g.name}”?`}
                description="This removes the saved groups. Learners are not affected."
                onConfirm={() => deleteSavedGroups(g.id).then(reload, onError)}
                trigger={
                  <Button variant="ghost" size="icon-sm" title="Delete">
                    <Trash2 />
                  </Button>
                }
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {g.groups.map((group, gi) => {
                const accent = GROUP_ACCENTS[gi % GROUP_ACCENTS.length];
                // Learners removed from the section since are left out.
                const members = group.learnerIds.map((id) => byId.get(id)).filter((l): l is Learner => !!l);
                return (
                  <div key={gi} className={cn("rounded-lg border border-t-4 p-2.5", accent.border)}>
                    <p className="mb-1 flex items-center gap-1.5 text-sm font-medium">
                      <span className={cn("size-2 rounded-full", accent.dot)} />
                      Group {gi + 1}
                      <span className="ml-auto text-xs font-normal text-muted-foreground">{members.length}</span>
                    </p>
                    <ul className="space-y-0.5 text-sm">
                      {members.map((l) => (
                        <li
                          key={l.id}
                          className={cn("flex items-center gap-1.5", l.id === group.leaderId && "font-semibold")}
                        >
                          <span className="truncate">{displayName(l)}</span>
                          {l.id === group.leaderId && (
                            <Crown className="size-3.5 shrink-0 fill-amber-400 text-amber-500" />
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
