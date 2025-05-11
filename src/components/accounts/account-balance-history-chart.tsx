
'use client';

import type { FC } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { formatCurrency, getCurrencySymbol } from '@/lib/currency';

interface AccountBalanceHistoryChartProps {
  data: Array<{ date: string; [key: string]: any }>; // Date string and account balances
  accountConfigs: ChartConfig; // Maps account name to label and color
  preferredCurrency: string;
}

const AccountBalanceHistoryChart: FC<AccountBalanceHistoryChartProps> = ({ data, accountConfigs, preferredCurrency }) => {
  const accountNames = Object.keys(accountConfigs);

  if (!data || data.length === 0 || accountNames.length === 0) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">No data available for history chart.</div>;
  }
  
  const yAxisTickFormatter = (value: number) => {
    const symbol = getCurrencySymbol(preferredCurrency);
    if (Math.abs(value) >= 1000000) return `${symbol}${(value / 1000000).toFixed(1)}M`;
    if (Math.abs(value) >= 1000) return `${symbol}${(value / 1000).toFixed(0)}k`;
    return `${symbol}${value.toFixed(0)}`;
  };


  return (
    <ChartContainer config={accountConfigs} className="h-full w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            className="text-xs fill-muted-foreground"
            // Consider adding a tickFormatter for dates if needed, e.g., format(parseISO(value), 'MMM dd')
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={yAxisTickFormatter}
            className="text-xs fill-muted-foreground"
          />
          <Tooltip
            content={
              <ChartTooltipContent
                indicator="line"
                labelFormatter={(label) => `Date: ${label}`}
                formatter={(value, name) => (
                  <div className="flex items-center">
                    <span
                      className="w-2.5 h-2.5 rounded-full mr-2"
                      style={{ backgroundColor: accountConfigs[name as string]?.color }}
                    />
                    <span>
                      {accountConfigs[name as string]?.label || name}: {formatCurrency(Number(value), preferredCurrency, preferredCurrency, false)}
                    </span>
                  </div>
                )}
              />
            }
          />
          <Legend content={<ChartLegendContent wrapperStyle={{paddingTop: 10}}/>} />
          {accountNames.map((accountName) => (
            <Line
              key={accountName}
              dataKey={accountName}
              type="stepAfter" // Makes it a step chart like the image
              stroke={accountConfigs[accountName]?.color || '#8884d8'}
              strokeWidth={2}
              dot={{ r: 3, strokeWidth: 1, fill: accountConfigs[accountName]?.color }}
              activeDot={{ r: 5, strokeWidth: 2 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
};

export default AccountBalanceHistoryChart;
