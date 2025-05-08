
'use client';

import type { FC } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip as RechartsTooltip } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltipContent } from '@/components/ui/chart'; // Use existing Chart components if possible

interface PaymentData {
  name: string;
  value: number;
  percentage: number;
  fill: string;
}

interface PaymentDistributionChartProps {
  data: PaymentData[];
  totalValue: number;
}

const PaymentDistributionChart: FC<PaymentDistributionChartProps> = ({ data, totalValue }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Sem dados de pagamento.
      </div>
    );
  }

  const chartConfig = data.reduce((acc, item) => {
    acc[item.name] = { label: item.name, color: item.fill };
    return acc;
  }, {} as ChartConfig);


  return (
    <ChartContainer config={chartConfig} className="h-full w-full aspect-square">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <RechartsTooltip
            cursor={false}
            content={<ChartTooltipContent hideLabel प्रसिद्ध nameKey="name" formatter={(value, name, props) => {
                const item = data.find(d => d.name === name);
                return `${item?.percentage}% (${(value as number).toLocaleString()})`;
            }} />}
          />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius="60%"
            outerRadius="80%"
            strokeWidth={2}
            labelLine={false}
          >
            {data.map((entry) => (
              <Cell key={`cell-${entry.name}`} fill={entry.fill} stroke={entry.fill} />
            ))}
          </Pie>
          {/* Center Text */}
          <foreignObject x="50%" y="50%" width="100" height="100" style={{ transform: 'translate(-50px, -30px)' }}>
            <div style={{ textAlign: 'center' }}>
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="text-2xl font-bold text-foreground">
                {totalValue.toLocaleString()}
              </div>
            </div>
          </foreignObject>
          <Legend
            content={({ payload }) => (
              <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs pt-4">
                {payload?.map((entry, index) => (
                  <li key={`item-${index}`} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                    {entry.value} ({data.find(d=>d.name === entry.value)?.percentage}%)
                  </li>
                ))}
              </ul>
            )}
            verticalAlign="bottom"
            align="center"
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
};

export default PaymentDistributionChart;
