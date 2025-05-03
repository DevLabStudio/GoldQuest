
'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import type { FC } from 'react';
import { getUserPreferences } from '@/lib/preferences'; // Import preferences

// Use the preference-aware formatter if needed, or a simpler one if data is pre-converted
const formatChartCurrency = (value: number, currencyCode: string) => {
   try {
        // Determine locale based on target currency
        let formatLocale;
        switch (currencyCode.toUpperCase()) {
            case 'BRL': formatLocale = 'pt-BR'; break;
            case 'USD': formatLocale = 'en-US'; break;
            case 'EUR': formatLocale = 'de-DE'; break; // Example
            case 'GBP': formatLocale = 'en-GB'; break;
            default: formatLocale = 'en-US';
        }
        return new Intl.NumberFormat(formatLocale, {
            style: 'currency',
            currency: currencyCode.toUpperCase(),
        }).format(value);
    } catch (error) {
        console.error(`Error formatting chart currency: Value=${value}, Currency=${currencyCode}`, error);
        return `${currencyCode.toUpperCase()} ${value.toFixed(2)}`;
    }
};


interface SpendingChartProps {
  data: Array<{ category: string; amount: number }>;
  currency: string; // Accept preferred currency
}

const SpendingChart: FC<SpendingChartProps> = ({ data, currency }) => {
  // Updated chartConfig to use the primary gold color and dynamic label
    const chartConfig = {
        amount: {
            label: `Amount (${currency})`, // Use dynamic currency label
            color: 'hsl(var(--primary))', // Use primary color (gold)
        },
    } satisfies ChartConfig;


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
           // Format Y-axis labels with the passed currency
           tickFormatter={(value) => formatChartCurrency(value, currency)}
           tickLine={false}
           axisLine={false}
           width={90} // Adjust width if needed for longer currency formats
           stroke="hsl(var(--muted-foreground))" // Ensure axis text is visible
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
                labelKey="category"
                // Format tooltip value with the passed currency
                formatter={(value) => formatChartCurrency(value as number, currency)}
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
