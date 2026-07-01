"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function AdminSectionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the real error in the browser console for debugging.
    console.error("Admin section error:", error);
  }, [error]);

  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
          <AlertTriangle className="size-6" />
        </span>
        <p className="text-base font-semibold">This section couldn&apos;t load</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Something went wrong fetching this data. This usually means a database table
          hasn&apos;t been created yet, or a temporary connection issue.
        </p>
        {error.message && (
          <p className="max-w-md break-words rounded-md bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
            {error.message}
          </p>
        )}
        <Button onClick={reset} className="mt-1">
          <RotateCw className="size-4" />
          Try again
        </Button>
      </CardContent>
    </Card>
  );
}
