'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import type { FC } from 'react';

// Helper function to format currency for chart labels/tooltips
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

// Updated chartConfig to use the primary gold color
const chartConfig = {
  amount: {
    label: 'Amount (BRL)',
    color: 'hsl(var(--primary))', // Use primary color (gold)
  },
} satisfies ChartConfig;

interface SpendingChartProps {
  data: Array<{ category: string; amount: number }>;
}

const SpendingChart: FC<SpendingChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
        <div className="flex h-full items-center justify-center text-muted-foreground">
            No spending data available.
        </div>
    )
  }
  return (
    <ChartContainer config={chartConfig} className="h-full w-full">
      <BarChart
        accessibilityLayer
        data={data}
        margin={{
          top: 20,
          right: 20,
          left: 20,
          bottom: 5,
        }}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="category"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
          stroke="hsl(var(--muted-foreground))" // Ensure axis text is visible
        />
        <YAxis
           tickFormatter={(value) => formatCurrency(value)}
           tickLine={false}
           axisLine={false}
           width={80} // Adjust width to accommodate formatted currency labels
           stroke="hsl(var(--muted-foreground))" // Ensure axis text is visible
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
                labelKey="category"
                formatter={(value) => formatCurrency(value as number)}
                indicator="dot"
            />}
        />
        {/* Use CSS variable defined in chartConfig for the bar fill */}
        <Bar dataKey="amount" fill="var(--color-amount)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
};

export default SpendingChart;
