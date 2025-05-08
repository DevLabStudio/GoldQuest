
'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Cell } from 'recharts'; // Added Cell
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import type { FC } from 'react';

const formatChartCurrency = (value: number, currencyCode: string) => {
   try {
        let formatLocale;
        switch (currencyCode.toUpperCase()) {
            case 'BRL': formatLocale = 'pt-BR'; break;
            case 'USD': formatLocale = 'en-US'; break;
            case 'EUR': formatLocale = 'de-DE'; break;
            case 'GBP': formatLocale = 'en-GB'; break;
            default: formatLocale = 'en-US';
        }
        return new Intl.NumberFormat(formatLocale, {
            style: 'currency',
            currency: currencyCode.toUpperCase(),
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value);
    } catch (error) {
        console.error(`Error formatting chart currency: Value=${value}, Currency=${currencyCode}`, error);
        return `${currencyCode.toUpperCase()} ${value.toFixed(0)}`;
    }
};

interface SpendingChartProps {
  data: Array<{ category: string; amount: number }>;
  currency: string;
}

// Define an array of colors using CSS variables from the theme
const BAR_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const SpendingChart: FC<SpendingChartProps> = ({ data, currency }) => {
  // Create a dynamic chartConfig based on the data categories and BAR_COLORS
  const chartConfig = data.reduce((acc, item, index) => {
    acc[item.category] = {
      label: item.category,
      color: BAR_COLORS[index % BAR_COLORS.length],
    };
    return acc;
  }, {} as ChartConfig);

  // Add a general 'amount' config for tooltip label if not inferring from data keys
   chartConfig.amount = {
     label: `Amount (${currency})`,
     // This color might be a fallback if cell colors aren't picked up by tooltip consistently
     color: BAR_COLORS[0]
   };


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
          stroke="hsl(var(--muted-foreground))"
          interval={0}
        />
        <YAxis
           tickFormatter={(value) => formatChartCurrency(value, currency)}
           tickLine={false}
           axisLine={false}
           width={80}
           stroke="hsl(var(--muted-foreground))"
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
                // nameKey tells the tooltip which property of the data item to use for the "name"
                nameKey="category"
                // labelKey might not be needed if formatter handles the value directly
                // labelKey="amount"
                formatter={(value, name, props) => {
                  // props.payload contains the original data item, including its 'category'
                  // 'name' here would be the dataKey "amount"
                  // 'value' is the actual amount
                  const categoryConfig = chartConfig[props.payload.category as string];
                  const color = categoryConfig ? categoryConfig.color : BAR_COLORS[0]; // Fallback color
                  return (
                    <div className="flex items-center">
                       <span
                        className="w-2.5 h-2.5 rounded-full mr-2"
                        style={{ backgroundColor: color }}
                      />
                      <span>{props.payload.category}: {formatChartCurrency(value as number, currency)}</span>
                    </div>
                  );
                }}
                indicator="dot" // This might be overridden by custom formatter styling
            />}
        />
        <Bar dataKey="amount" radius={4}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
};

export default SpendingChart;
