import { ComingSoon } from "@/components/coming-soon";

export default function InvoicesPage() {
  return (
    <ComingSoon
      title="Invoices"
      description="Client invoices and payment status."
      note="Invoices will start as a manual table (amount, status, client), with an optional Stripe integration for automatic payment status in a later phase."
    />
  );
}
