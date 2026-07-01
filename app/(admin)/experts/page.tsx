import { getExperts } from "@/lib/data";
import { ExpertsTable } from "@/components/experts/experts-table";

export const dynamic = "force-dynamic";

export default async function ExpertsPage() {
  const experts = await getExperts();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Manage Experts</h1>
        <p className="text-sm text-muted-foreground">
          Your team of CPAs, bookkeepers, and specialists.
        </p>
      </div>
      <ExpertsTable experts={experts} />
    </div>
  );
}
