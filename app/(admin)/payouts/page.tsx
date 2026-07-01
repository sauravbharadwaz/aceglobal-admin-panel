import { getExperts, getPayouts } from "@/lib/data";
import { PayoutsTable } from "@/components/payouts/payouts-table";

export const dynamic = "force-dynamic";

export default async function PayoutsPage() {
  const [payouts, experts] = await Promise.all([getPayouts(), getExperts()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payouts</h1>
        <p className="text-sm text-muted-foreground">
          Expert earnings and payout tracking.
        </p>
      </div>
      <PayoutsTable payouts={payouts} expertNames={experts.map((e) => e.name)} />
    </div>
  );
}
