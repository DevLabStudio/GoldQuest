
'use client';

import type { FC } from 'react';
import Link from 'next/link'; // Import Link
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '@/lib/currency'; // Import formatCurrency

interface SmallStatCardProps {
  title: string;
  amount: number;
  currency: string;
  chartType: 'positive' | 'negative';
  href?: string; // Add href prop for navigation
}

const generateSparklineData = () => {
  return Array.from({ length: 10 }, (_, i) => ({
    name: `Page ${String.fromCharCode(65 + i)}`,
    uv: Math.floor(Math.random() * (350 - 100 + 1)) + 100,
  }));
};


const SmallStatCard: FC<SmallStatCardProps> = ({ title, amount, currency, chartType, href }) => {
  const formattedAmount = `${currency}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const chartColor = chartType === 'positive' ? "hsl(var(--chart-2))" : "hsl(var(--chart-4))";
  const data = generateSparklineData();

  const cardContent = (
    <Card className="shadow-lg bg-card text-card-foreground h-full hover:bg-muted/50 transition-colors">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 pb-2 px-4">
        <div className="text-2xl font-bold mb-1">
          {amount === 0 && !title.toLowerCase().includes("net worth") ? `${currency}0.00` : formattedAmount}
        </div>
        <div className="h-12 w-full">
          {amount !== 0 || title.toLowerCase().includes("net worth") ? (
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
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
              No {title.toLowerCase()} this month.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href} className="block h-full">{cardContent}</Link>;
  }

  return cardContent;
};

export default SmallStatCard;

