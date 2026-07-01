"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const chartConfig = {
  leads: { label: "New leads", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function LeadsChart({
  data,
}: {
  data: { month: string; leads: number }[];
}) {
  return (
    <ChartContainer config={chartConfig} className="h-[180px] w-full">
      <BarChart accessibilityLayer data={data} margin={{ left: 0, right: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          fontSize={12}
        />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Bar dataKey="leads" fill="var(--color-leads)" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
