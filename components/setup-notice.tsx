import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SetupNotice() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-lg">Finish connecting Supabase</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>The admin panel needs a Supabase project before it can sign anyone in.</p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Create a project at{" "}
              <a
                href="https://supabase.com/dashboard"
                className="font-medium text-primary underline"
                target="_blank"
                rel="noreferrer"
              >
                supabase.com/dashboard
              </a>
              .
            </li>
            <li>
              In <span className="font-medium">SQL Editor</span>, run the contents of{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-foreground">supabase/schema.sql</code>.
            </li>
            <li>
              Copy{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-foreground">.env.local.example</code>{" "}
              to <code className="rounded bg-muted px-1 py-0.5 text-foreground">.env.local</code> and
              paste your Project URL and anon key from{" "}
              <span className="font-medium">Project Settings → API</span>.
            </li>
            <li>
              Create a staff user in <span className="font-medium">Authentication → Users</span>, then
              restart <code className="rounded bg-muted px-1 py-0.5 text-foreground">npm run dev</code>.
            </li>
          </ol>
        </CardContent>
      </Card>
    </main>
  );
}
