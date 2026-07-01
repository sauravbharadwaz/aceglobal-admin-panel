import { ComingSoon } from "@/components/coming-soon";

export default function TatMetricsPage() {
  return (
    <ComingSoon
      title="TAT Metrics"
      description="Turnaround time across each stage of client work."
      note="Derived from case timestamps — meeting → invoice → payment → draft — showing average time per stage."
    />
  );
}
