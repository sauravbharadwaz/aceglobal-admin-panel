import { getClients, getClientEngagements, getExperts } from "@/lib/data";
import { ClientsTable } from "@/components/clients/clients-table";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const [clients, engagements, experts] = await Promise.all([
    getClients(),
    getClientEngagements(),
    getExperts(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
        <p className="text-sm text-muted-foreground">
          Active and past customers across all engagements.
        </p>
      </div>
      <ClientsTable clients={clients} engagements={engagements} experts={experts} />
    </div>
  );
}
