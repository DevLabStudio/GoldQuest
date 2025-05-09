
'use client';

import type { FC } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltipContent } from '@/components/ui/chart';

interface AssetData {
  name: string;
  value: number;
  fill: string;
}

interface AssetsChartProps {
  data: AssetData[];
  currency: string;
}

const AssetsChart: FC<AssetsChartProps> = ({ data, currency }) => {
  const chartConfig = data.reduce((acc, item) => {
    acc[item.name] = {
      label: item.name,
      color: item.fill,
    };
    return acc;
  }, {} as ChartConfig);
  
  chartConfig['value'] = {label: `Value (${currency})`};

  return (
    <Card className="shadow-lg bg-card text-card-foreground flex flex-col h-full">
      <CardHeader className="pb-2">
        <CardTitle>Assets</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col items-center justify-center p-0">
        <div className="w-full h-[200px] mb-2"> {/* Chart area */}
          <ChartContainer config={chartConfig} className="w-full h-full">
            <ResponsiveContainer>
              <PieChart>
                <RechartsTooltip
                  cursor={false}
                  content={<ChartTooltipContent 
                                formatter={(value, name, props) => (
                                    <div className="flex items-center">
                                    <span
                                        className="w-2.5 h-2.5 rounded-full mr-2"
                                        style={{ backgroundColor: props.payload.fill }}
                                    />
                                    <span>
                                        {props.payload.name}: {currency}{Number(value).toLocaleString()}
                                    </span>
                                    </div>
                                )}
                            />}
                />
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius="60%"
                  outerRadius="80%"
                  paddingAngle={data.length > 1 ? 2 : 0}
                  labelLine={false}
                  label={false}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} stroke={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 px-6 pb-4 text-sm w-full max-w-md"> {/* Legend area */}
          {data.map((asset) => (
            <div key={asset.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: asset.fill }} />
                <span>{asset.name}</span>
              </div>
              <span className="font-medium">{currency}{asset.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default AssetsChart;
