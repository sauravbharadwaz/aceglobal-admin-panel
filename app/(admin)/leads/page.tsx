import { getLeads } from "@/lib/data";
import { LeadsTable } from "@/components/leads/leads-table";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const leads = await getLeads();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
        <p className="text-sm text-muted-foreground">
          Inbound enquiries from the website and other channels.
        </p>
      </div>
      <LeadsTable leads={leads} />
    </div>
  );
}
