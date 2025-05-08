
'use client';

import { Pie, PieChart, Cell, Legend, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import type { FC } from 'react';
import { formatCurrency } from '@/lib/currency'; // Using the existing formatCurrency

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
  const chartData = [
    { name: 'Assets', value: totalAssets, fill: 'hsl(var(--chart-1))' },
    { name: 'Liabilities', value: totalLiabilities, fill: 'hsl(var(--chart-2))' },
  ].filter(item => item.value > 0);

  const chartConfig = {
    assets: {
      label: 'Assets',
      color: 'hsl(var(--chart-1))',
    },
    liabilities: {
      label: 'Liabilities',
      color: 'hsl(var(--chart-2))',
    },
  } satisfies ChartConfig;

  if (chartData.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        No data available for chart.
      </div>
    );
  }

  const RADIAN = Math.PI / 180;
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name, value }: any) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + (radius + 20) * Math.cos(-midAngle * RADIAN); // Adjust radius for label position
    const y = cy + (radius + 20) * Math.sin(-midAngle * RADIAN); // Adjust radius for label position
    const percentage = (percent * 100).toFixed(0);

    return (
      <text
        x={x}
        y={y}
        fill="hsl(var(--foreground))"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        className="text-xs"
      >
        {`${name} (${percentage}%)`}
      </text>
    );
  };

  return (
    <ChartContainer config={chartConfig} className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <RechartsTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name) => (
                  <div className="flex items-center">
                    <span
                      className="w-2.5 h-2.5 rounded-full mr-2"
                      style={{ backgroundColor: name === 'Assets' ? chartConfig.assets.color : chartConfig.liabilities.color }}
                    />
                    <span>
                      {name === 'Assets' ? chartConfig.assets.label : chartConfig.liabilities.label}: {formatCurrency(value as number, currency, undefined, false)}
                    </span>
                  </div>
                )}
                 labelFormatter={(label, payload) => {
                    if (payload && payload.length > 0 && payload[0].name) {
                       const itemKey = payload[0].name.toLowerCase() as keyof typeof chartConfig;
                       return chartConfig[itemKey]?.label || payload[0].name;
                    }
                    return label;
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
            outerRadius={80} // Adjust as needed
            labelLine={true} // Show lines to labels
            label={renderCustomizedLabel}
          >
            {chartData.map((entry) => (
              <Cell key={`cell-${entry.name}`} fill={entry.fill} stroke={entry.fill} />
            ))}
          </Pie>
          <ChartLegend
            content={<ChartLegendContent nameKey="name" />}
            verticalAlign="bottom"
            align="center"
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
};

export default NetWorthCompositionChart;
