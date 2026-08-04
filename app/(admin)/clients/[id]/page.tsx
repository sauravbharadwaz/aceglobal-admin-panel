import { notFound } from "next/navigation";
import {
  getClientDocuments,
  getClientEngagements,
  getClients,
  getExperts,
  getInvoices,
} from "@/lib/data";
import type { ClientDocument } from "@/lib/types";
import { ClientProfile } from "@/components/clients/client-profile";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [clients, engagements, documentsByClient, invoices, experts] = await Promise.all([
    getClients(),
    getClientEngagements(),
    getClientDocuments(),
    getInvoices(),
    getExperts(),
  ]);

  const client = clients.find((c) => c.id === id);
  if (!client) notFound();

  // Every service this client has, newest first — including ones they raised
  // themselves from the dashboard after becoming a client.
  const clientEngagements = engagements[client.id] ?? [];

  // Documents attached to any service request + standalone dashboard uploads, deduped by path.
  const seen = new Set<string>();
  const documents: ClientDocument[] = [
    ...clientEngagements.flatMap((e) => e.documents),
    ...(documentsByClient[client.id] ?? []),
  ].filter((d) => (seen.has(d.path) ? false : (seen.add(d.path), true)));

  // Invoices belong to a client by email (preferred) or name.
  const email = (client.email ?? "").trim().toLowerCase();
  const name = client.name.trim().toLowerCase();
  const clientInvoices = invoices.filter((inv) => {
    const invEmail = (inv.client_email ?? "").trim().toLowerCase();
    if (email && invEmail) return invEmail === email;
    return inv.client_name.trim().toLowerCase() === name;
  });

  return (
    <ClientProfile
      client={client}
      engagements={clientEngagements}
      documents={documents}
      invoices={clientInvoices}
      experts={experts}
    />
  );
}
