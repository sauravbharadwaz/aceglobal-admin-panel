import { getClients, getClientEngagements, getClientDocuments, getExperts } from "@/lib/data";
import { ClientsTable } from "@/components/clients/clients-table";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const [clients, engagements, documents, experts] = await Promise.all([
    getClients(),
    getClientEngagements(),
    getClientDocuments(),
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
      <ClientsTable
        clients={clients}
        engagements={engagements}
        documents={documents}
        experts={experts}
      />
    </div>
  );
}
