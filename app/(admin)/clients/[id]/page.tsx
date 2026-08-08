import { notFound } from "next/navigation";
import {
  getClientDeadlines,
  getClientDocuments,
  getClientEngagements,
  getClients,
  getExperts,
  getInvoices,
} from "@/lib/data";
import type { ClientDocument, ClientProfileHints } from "@/lib/types";
import { ClientProfile } from "@/components/clients/client-profile";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [clients, engagements, documentsByClient, invoices, experts, deadlines] =
    await Promise.all([
      getClients(),
      getClientEngagements(),
      getClientDocuments(),
      getInvoices(),
      getExperts(),
      getClientDeadlines(id),
    ]);

  const client = clients.find((c) => c.id === id);
  if (!client) notFound();

  // Every service this client has, newest first — including ones they raised
  // themselves from the dashboard after becoming a client.
  const clientEngagements = engagements[client.id] ?? [];

  // What the client already told us on their onboarding forms, newest answer
  // first. Different services capture different things — a formation gives the
  // owner and address, the tax forms give the EIN — so take the first non-empty
  // value for each field across all of them.
  //
  // The address is the exception: its parts are filled as a group, from the first
  // application that gives any of them. Merged field by field, a client with two
  // formations at different addresses would be offered the street from one and
  // the city from another — an address that was never real.
  const ADDRESS_HINTS = [
    "business_line1",
    "business_line2",
    "business_city",
    "business_state",
    "business_zip",
    "business_country",
  ] as const;

  const hints: ClientProfileHints = {};
  for (const e of clientEngagements) {
    for (const [key, value] of Object.entries(e.hints ?? {})) {
      const field = key as keyof ClientProfileHints;
      if ((ADDRESS_HINTS as readonly string[]).includes(field)) continue;
      if (!hints[field] && value) hints[field] = value;
    }
  }
  const withAddress = clientEngagements.find((e) =>
    ADDRESS_HINTS.some((f) => e.hints?.[f]),
  );
  for (const field of ADDRESS_HINTS) hints[field] = withAddress?.hints?.[field] ?? null;

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
      hints={hints}
      documents={documents}
      invoices={clientInvoices}
      experts={experts}
      deadlines={deadlines}
    />
  );
}
