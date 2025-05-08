
'use client';

import { Pie, PieChart, Cell, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltipContent,
} from '@/components/ui/chart';
import type { FC } from 'react';
import { formatCurrency } from '@/lib/currency';

interface NetWorthCompositionChartProps {
  totalAssets: number;
  totalLiabilities: number;
  currency: string;
}

const NetWorthCompositionChart: FC<NetWorthCompositionChartProps> = ({
  totalAssets,
  totalLiabilities,
  currency,
}) => {
  const netWorth = totalAssets - totalLiabilities;

  // Data for the chart: Assets and Liabilities
  // The image shows 4 segments, but we only have Assets and Liabilities.
  // We will represent Assets with chart-1 (blue) and Liabilities with chart-2 (red-ish, similar to accent color in theme)
  // If you need more segments, you'll need to break down assets/liabilities further.
  const chartData = [
    { name: 'Assets', value: totalAssets, fill: 'hsl(var(--chart-1))' }, // Blueish
    { name: 'Liabilities', value: Math.abs(totalLiabilities), fill: 'hsl(var(--chart-2))' }, // Orange/Red-ish
    // Add more segments here if needed, e.g., different types of assets or liabilities
    // { name: 'Equity', value: netWorth > 0 ? netWorth : 0, fill: 'hsl(var(--chart-3))' }, // Yellowish (if net worth is positive)
    // { name: 'Debt', value: netWorth < 0 ? Math.abs(netWorth) : 0, fill: 'hsl(var(--chart-4))' }, // Grayish (if net worth is negative, representing debt beyond assets)
  ].filter(item => item.value > 0); // Filter out zero/negative values for display


  const chartConfig = {
    assets: {
      label: 'Assets',
      color: 'hsl(var(--chart-1))',
    },
    liabilities: {
      label: 'Liabilities',
      color: 'hsl(var(--chart-2))',
    },
    // equity: {
    //   label: 'Equity',
    //   color: 'hsl(var(--chart-3))',
    // },
    // debt: {
    //   label: 'Debt',
    //   color: 'hsl(var(--chart-4))',
    // },
  } satisfies ChartConfig;

  if (chartData.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        No data available for chart.
      </div>
    );
  }

  const totalValueForPercentage = chartData.reduce((sum, item) => sum + item.value, 0);


  return (
    <ChartContainer config={chartConfig} className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <RechartsTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                hideLabel // Hide default label in tooltip
                formatter={(value, name, props) => {
                  const itemKey = props.payload.name.toLowerCase() as keyof typeof chartConfig;
                  const itemLabel = chartConfig[itemKey]?.label || props.payload.name;
                  const itemColor = chartConfig[itemKey]?.color || props.payload.fill;
                  const percentage = totalValueForPercentage > 0 ? ((value as number / totalValueForPercentage) * 100).toFixed(0) : 0;
                  return (
                    <div className="flex items-center">
                      <span
                        className="w-2.5 h-2.5 rounded-full mr-2"
                        style={{ backgroundColor: itemColor }}
                      />
                      <span>
                        {itemLabel}: {formatCurrency(value as number, currency, undefined, false)} ({percentage}%)
                      </span>
                    </div>
                  );
                }}
              />
            }
          />
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius="60%" // Makes it a doughnut chart
            outerRadius="80%"
            labelLine={false} // No lines to external labels
            label={false} // No external labels
            paddingAngle={chartData.length > 1 ? 2 : 0} // Add padding between segments if more than one
          >
            {chartData.map((entry) => (
              <Cell key={`cell-${entry.name}`} fill={entry.fill} stroke={entry.fill} />
            ))}
          </Pie>
           {/* Custom center text */}
           <text
            x="50%"
            y="46%" // Adjusted y for two lines of text
            textAnchor="middle"
            dominantBaseline="central"
            className="text-sm fill-muted-foreground"
          >
            Total
          </text>
          <text
            x="50%"
            y="56%" // Adjusted y for two lines of text
            textAnchor="middle"
            dominantBaseline="central"
            className="text-2xl font-bold fill-foreground"
          >
            {formatCurrency(netWorth, currency, undefined, false)}
          </text>
          {/* Legend removed to match the image */}
        </PieChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
};

export default NetWorthCompositionChart;
