
'use client';

import type { FC } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { formatCurrency } from '@/lib/currency'; 

export interface NetWorthChartDataPoint {
  name: string;
  value: number;
  fill: string; 
}

interface NetWorthCompositionChartProps {
  data: NetWorthChartDataPoint[];
  currency: string; // User's preferred currency code
}

const NetWorthCompositionChart: FC<NetWorthCompositionChartProps> = ({ data, currency }) => {
  const chartConfig = data.reduce((acc, item) => {
    acc[item.name] = {
      label: item.name,
      color: item.fill,
    };
    return acc;
  }, {} as ChartConfig);

  const totalValue = data.reduce((sum, item) => sum + item.value, 0);

  if (!data || data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        No data available for composition chart.
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
                      style={{ backgroundColor: props.payload.fill }}
                    />
                    <span>
                      {props.payload.name}: {formatCurrency(Number(value), currency, currency, false)} (
                      {totalValue > 0 ? ((Number(value) / totalValue) * 100).toFixed(1) : 0}%)
                    </span>
                  </div>
                )}
              />
            }
          />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius="80%"
            innerRadius="50%" 
            labelLine={false}
            label={false} 
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} stroke={entry.fill} />
            ))}
          </Pie>
          <ChartLegend
            content={<ChartLegendContent nameKey="name" className="text-xs" />}
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

export default NetWorthCompositionChart;

