import { getClients, getOnboardingSubmissions } from "@/lib/data";
import type { SubmissionClient } from "@/lib/types";
import { OnboardingTable } from "@/components/onboarding/onboarding-table";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const [submissions, clients] = await Promise.all([
    getOnboardingSubmissions(),
    getClients(),
  ]);

  // Which submissions came from someone who is already a client? Matched on the
  // linked client_id first, then their login, then their email — so a request an
  // existing client raised from their own dashboard reads as theirs, not as a
  // fresh lead.
  const byId = new Map(clients.map((c) => [c.id, c]));
  const byUser = new Map(clients.filter((c) => c.user_id).map((c) => [c.user_id as string, c]));
  const byEmail = new Map(
    clients.filter((c) => c.email).map((c) => [(c.email as string).toLowerCase(), c]),
  );

  const clientBySubmission: Record<string, SubmissionClient> = {};
  for (const s of submissions) {
    const match =
      (s.client_id ? byId.get(s.client_id) : null) ??
      (s.user_id ? byUser.get(s.user_id) : null) ??
      (s.email ? byEmail.get(s.email.toLowerCase()) : null);
    if (match) clientBySubmission[s.id] = { id: match.id, name: match.name };
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Onboarding</h1>
        <p className="text-sm text-muted-foreground">
          Completed onboarding forms from the app — bookkeeping, corporate tax, and
          company formation.
        </p>
      </div>
      <OnboardingTable submissions={submissions} clientBySubmission={clientBySubmission} />
    </div>
  );
}
