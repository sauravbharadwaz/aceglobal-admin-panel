"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const leadsConfig = {
  value: { label: "New leads", color: "var(--chart-2)" },
} satisfies ChartConfig;

const revenueConfig = {
  value: { label: "Collected", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function MonthlyBarChart({
  data,
  kind,
}: {
  data: { month: string; value: number }[];
  kind: "leads" | "revenue";
}) {
  const config = kind === "leads" ? leadsConfig : revenueConfig;
  return (
    <ChartContainer config={config} className="h-[200px] w-full">
      <BarChart accessibilityLayer data={data} margin={{ left: 0, right: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Bar dataKey="value" fill="var(--color-value)" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
