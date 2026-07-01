import { getInvoices } from "@/lib/data";
import { InvoicesTable } from "@/components/invoices/invoices-table";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const invoices = await getInvoices();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
        <p className="text-sm text-muted-foreground">
          Client invoices and payment status.
        </p>
      </div>
      <InvoicesTable invoices={invoices} />
    </div>
  );
}
