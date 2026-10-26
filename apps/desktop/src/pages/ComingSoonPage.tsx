import type { LucideIcon } from "lucide-react";

export function ComingSoonPage({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="grid h-full place-items-center p-8">
      <div className="max-w-sm text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="size-7" />
        </div>
        <h1 className="mt-4 text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <p className="mt-4 inline-block rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          Coming soon
        </p>
      </div>
    </div>
  );
}
