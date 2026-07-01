import { LoginForm } from "@/components/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground shadow-sm">
            A
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Ace Global Admin</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to manage leads and clients.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>Use your Ace Global staff account.</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Internal tool · Ace Global
        </p>
      </div>
    </main>
  );
}
