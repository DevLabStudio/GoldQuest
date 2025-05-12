
'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent
} from '@/components/ui/chart';
import type { FC } from 'react';
import { formatCurrency, getCurrencySymbol } from '@/lib/currency';
import { getCategoryStyle } from '@/services/categories'; // To get consistent colors

interface GroupCategorySpendingChartProps {
  data: Array<{ category: string; amount: number }>;
  currency: string;
}

const BAR_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
];


const GroupCategorySpendingChart: FC<GroupCategorySpendingChartProps> = ({ data, currency }) => {

  const chartConfig = data.reduce((acc, item, index) => {
    const style = getCategoryStyle(item.category);
    // Extract HSL value from Tailwind class string if present
    // e.g., 'bg-green-100 text-green-800' -> we'd want a chart color, not bg
    // For now, using predefined BAR_COLORS, but ideally, this would map to category's defined color
    let chartColor = BAR_COLORS[index % BAR_COLORS.length];
    // A more robust way would be to have a mapping from category name to a specific chart hsl color
    // Or parse the `style.color` if it consistently provides a usable chart color string.
    
    // Example: if style.color was "hsl(210 40% 96%)", we could use that directly.
    // As style.color is a Tailwind class string like "bg-green-500", we use BAR_COLORS as fallback.

    acc[item.category] = {
      label: item.category,
      color: chartColor, // Use the category's theme color or a default
    };
    return acc;
  }, {} as ChartConfig);

  const totalValue = data.reduce((sum, item) => sum + item.amount, 0);

  if (!data || data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        No spending data for this group.
      </div>
    );
  }

  return (
    <ChartContainer
      config={chartConfig}
      className="mx-auto aspect-square max-h-[300px] sm:max-h-[350px]"
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <RechartsTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                hideLabel
                formatter={(value, name, props) => (
                  <div className="flex items-center">
                    <span
                      className="w-2.5 h-2.5 rounded-full mr-2"
                      style={{ backgroundColor: chartConfig[props.payload.category as string]?.color || BAR_COLORS[0] }}
                    />
                    <span>
                      {props.payload.category}: {formatCurrency(Number(value), currency, currency, false)} (
                      {totalValue > 0 ? ((Number(value) / totalValue) * 100).toFixed(1) : 0}%)
                    </span>
                  </div>
                )}
              />
            }
          />
          <Pie
            data={data}
            dataKey="amount"
            nameKey="category"
            cx="50%"
            cy="50%"
            outerRadius="80%"
            innerRadius="50%"
            labelLine={false}
            label={false}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={chartConfig[entry.category]?.color || BAR_COLORS[index % BAR_COLORS.length]} />
            ))}
          </Pie>
          <ChartLegend
            content={<ChartLegendContent nameKey="category" className="text-xs"/>}
            verticalAlign="bottom"
            align="center"
            iconSize={10}
            wrapperStyle={{paddingTop: 10}}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
};

export default GroupCategorySpendingChart;

