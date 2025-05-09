
'use client';

import type { FC } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltipContent } from '@/components/ui/chart';

interface IncomeSourceData {
  source: string;
  amount: number;
  fill: string;
}

interface IncomeSourceChartProps {
  data: IncomeSourceData[];
  currency: string;
}

const IncomeSourceChart: FC<IncomeSourceChartProps> = ({ data, currency }) => {
  const chartConfig = data.reduce((acc, item) => {
    acc[item.source] = {
      label: item.source,
      color: item.fill,
    };
    return acc;
  }, {} as ChartConfig);
  
  chartConfig['amount'] = { label: `Amount (${currency})`};


  return (
    <Card className="shadow-lg bg-card text-card-foreground h-full">
      <CardHeader>
        <CardTitle>Income Source</CardTitle>
      </CardHeader>
      <CardContent className="h-[250px] pb-0"> {/* Adjust height as needed */}
        <ChartContainer config={chartConfig} className="w-full h-full">
          <ResponsiveContainer>
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
              <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                type="number" 
                axisLine={false} 
                tickLine={false} 
                tickFormatter={(value) => `${currency}${value/1000}k`}
                className="text-xs fill-muted-foreground"
              />
              <YAxis 
                dataKey="source" 
                type="category" 
                axisLine={false} 
                tickLine={false} 
                className="text-xs fill-muted-foreground"
                width={80} // Adjust width for labels
              />
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted))' }}
                content={<ChartTooltipContent 
                            formatter={(value, name, props) => (
                                <div className="flex items-center">
                                <span
                                    className="w-2.5 h-2.5 rounded-full mr-2"
                                    style={{ backgroundColor: props.payload.fill }}
                                />
                                <span>
                                    {props.payload.source}: {currency}{Number(value).toLocaleString()}
                                </span>
                                </div>
                            )}
                        />}
              />
              <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

export default IncomeSourceChart;
