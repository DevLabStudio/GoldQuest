
'use client';

import type { FC } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton'; // Import Skeleton

interface MonthlyData {
  month: string;
  income: number;
  expenses: number;
}

interface IncomeExpensesChartProps {
  data: MonthlyData[];
  currency: string;
}

const IncomeExpensesChart: FC<IncomeExpensesChartProps> = ({ data, currency }) => {
  if (!data || data.length === 0) {
    return (
        <Card className="shadow-lg bg-card text-card-foreground">
            <CardHeader className="flex flex-row items-start justify-between pb-4">
                <div>
                    <CardTitle>Income & Expenses</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="h-[300px] w-full p-0 flex items-center justify-center">
                <p className="text-muted-foreground">No income/expense data to display.</p>
            </CardContent>
        </Card>
    );
  }

  const chartConfig = {
    income: {
      label: "Income",
      color: "hsl(var(--chart-2))", // Teal/Green
    },
    expenses: {
      label: "Expenses",
      color: "hsl(var(--chart-5))", // Orange
    },
  } satisfies ChartConfig;

  const maxIncome = Math.max(...data.map(d => d.income));
  const maxExpenses = Math.max(...data.map(d => d.expenses));

  return (
    <Card className="shadow-lg bg-card text-card-foreground">
      <CardHeader className="flex flex-row items-start justify-between pb-4">
        <div>
            <CardTitle>Income & Expenses</CardTitle>
        </div>
        <div className="text-right">
            <p className="text-xs text-muted-foreground">Max Income</p>
            <p className="font-semibold text-green-500">{currency}{maxIncome.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">Max Expenses</p>
            <p className="font-semibold text-orange-500">{currency}{maxExpenses.toLocaleString()}</p>
        </div>
      </CardHeader>
      <CardContent className="h-[300px] w-full p-0">
        <ChartContainer config={chartConfig} className="w-full h-full">
          <ResponsiveContainer>
            <LineChart
              data={data}
              margin={{
                top: 5,
                right: 20,
                left: 0,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                className="text-xs fill-muted-foreground"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => `${currency}${value / 1000}k`}
                className="text-xs fill-muted-foreground"
              />
              <Tooltip
                cursor={true}
                content={
                    <ChartTooltipContent
                        formatter={(value, name) => (
                        <>
                            <span
                            className="w-2.5 h-2.5 rounded-full mr-2"
                            style={{ backgroundColor: name === "income" ? chartConfig.income.color : chartConfig.expenses.color }}
                            />
                            {name.charAt(0).toUpperCase() + name.slice(1)}: {currency}{Number(value).toLocaleString()}
                        </>
                        )}
                        indicator="line"
                    />
                }
              />
              {/* <Legend content={<ChartLegendContent />} /> */}
              <Line
                dataKey="income"
                type="monotone"
                stroke={chartConfig.income.color}
                strokeWidth={2.5}
                dot={false}
                strokeDasharray="4 4" // Dashed line for income
              />
              <Line
                dataKey="expenses"
                type="monotone"
                stroke={chartConfig.expenses.color}
                strokeWidth={2.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

export default IncomeExpensesChart;

