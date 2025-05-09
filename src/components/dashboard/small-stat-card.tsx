
'use client';

import type { FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '@/lib/currency'; // Import formatCurrency

interface SmallStatCardProps {
  title: string;
  amount: number; // Changed from string to number
  currency: string; // Currency symbol e.g., "$", "R$"
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
  // Use formatCurrency to format the amount, assuming 'currency' is the currency code
  // The currency prop here is expected to be the symbol, so we might need to adjust if it's a code
  // For now, we'll directly use the currency symbol passed.
  // A better approach might be to pass the currency code and derive the symbol inside or via a helper.
  const formattedAmount = `${currency}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;


  const chartColor = chartType === 'positive' ? "hsl(var(--chart-2))" : "hsl(var(--chart-4))"; // Green for positive, Reddish for negative
  const data = generateSparklineData();

  return (
    <Card className="shadow-lg bg-card text-card-foreground h-full">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle> {/* text-base to text-sm */}
      </CardHeader>
      <CardContent className="pt-0 pb-2 px-4"> {/* Adjusted padding */}
        <div className="text-2xl font-bold mb-1">
          {amount === 0 && !title.toLowerCase().includes("net worth") ? `${currency}0.00` : formattedAmount}
        </div>
        <div className="h-12 w-full"> {/* Fixed height for the chart area, h-16 to h-12 */}
          {amount !== 0 || title.toLowerCase().includes("net worth") ? ( // Only show chart if amount is not 0, unless it's net worth
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
};

export default SmallStatCard;
