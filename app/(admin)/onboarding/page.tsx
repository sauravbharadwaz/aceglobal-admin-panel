import { getOnboardingSubmissions } from "@/lib/data";
import { OnboardingTable } from "@/components/onboarding/onboarding-table";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const submissions = await getOnboardingSubmissions();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Onboarding</h1>
        <p className="text-sm text-muted-foreground">
          Completed onboarding forms from the app — bookkeeping, corporate tax, and
          company formation.
        </p>
      </div>
      <OnboardingTable submissions={submissions} />
    </div>
  );
}
