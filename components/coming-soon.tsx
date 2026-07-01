import { Card, CardContent } from "@/components/ui/card";
import { Hammer } from "lucide-react";

export function ComingSoon({
  title,
  description,
  note,
}: {
  title: string;
  description?: string;
  note?: string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Hammer className="size-6" />
          </span>
          <p className="text-base font-semibold">Coming soon</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {note ??
              "This section is planned for an upcoming phase. The navigation and structure are in place — the data and views will be built next."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
