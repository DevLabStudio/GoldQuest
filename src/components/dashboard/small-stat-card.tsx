
'use client';

import type { FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface SmallStatCardProps {
  title: string;
  amount: number;
  currency: string;
  chartType: 'positive' | 'negative';
}

// Dummy data for the sparkline, customize as needed
const generateSparklineData = () => {
  return Array.from({ length: 10 }, (_, i) => ({
    name: `Page ${String.fromCharCode(65 + i)}`,
    uv: Math.floor(Math.random() * (350 - 100 + 1)) + 100, // Random data for visual
  }));
};


const SmallStatCard: FC<SmallStatCardProps> = ({ title, amount, currency, chartType }) => {
  const formattedAmount = new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: currency === '$' ? 'USD' : currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount).replace('US$', '$');

  const chartColor = chartType === 'positive' ? "hsl(var(--chart-2))" : "hsl(var(--chart-4))"; // Green for positive, Reddish for negative
  const data = generateSparklineData();

  return (
    <Card className="shadow-lg bg-card text-card-foreground h-full">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold mb-1">{formattedAmount}</div>
        <div className="h-16 w-full"> {/* Fixed height for the chart area */}
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
              <Line
                type="monotone"
                dataKey="uv"
                stroke={chartColor}
                strokeWidth={2.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default SmallStatCard;
