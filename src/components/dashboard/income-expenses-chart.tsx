
'use client';

import type { FC } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { formatCurrency, getCurrencySymbol } from '@/lib/currency'; // Keep this import

interface MonthlyData {
  month: string;
  income: number;
  expenses: number;
}

interface IncomeExpensesChartProps {
  data: MonthlyData[];
  currency: string; // This should be the currency SYMBOL e.g. '$', '€', 'R$'
}

const IncomeExpensesChart: FC<IncomeExpensesChartProps> = ({ data, currency }) => {
  if (!data || data.length === 0) {
    return (
        <Card className="shadow-lg bg-card text-card-foreground">
            <CardHeader className="flex flex-row items-start justify-between pb-4">
                <div>
                    <CardTitle>Income & Expenses (Last 12 Months)</CardTitle>
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

  const maxIncome = Math.max(...data.map(d => d.income), 0);
  const maxExpenses = Math.max(...data.map(d => d.expenses), 0);
  const overallMax = Math.max(maxIncome, maxExpenses);


  return (
    <Card className="shadow-lg bg-card text-card-foreground">
      <CardHeader className="flex flex-row items-start justify-between pb-4">
        <div>
            <CardTitle>Income & Expenses (Last 12 Months)</CardTitle>
        </div>
        <div className="text-right">
            <p className="text-xs text-muted-foreground">Max Value</p>
            <p className="font-semibold text-primary">{currency}{overallMax.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
        </div>
      </CardHeader>
      <CardContent className="h-[300px] w-full p-0">
        <ChartContainer config={chartConfig} className="w-full h-full">
          <ResponsiveContainer>
            <BarChart
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
                tickFormatter={(value) => `${currency}${(value / 1000).toFixed(0)}k`}
                className="text-xs fill-muted-foreground"
                domain={[0, 'dataMax + 1000']} // Ensure y-axis accommodates max value
              />
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted))' }}
                content={
                    <ChartTooltipContent
                        formatter={(value, name) => (
                        <>
                            <span
                            className="w-2.5 h-2.5 rounded-full mr-2"
                            style={{ backgroundColor: name === "income" ? chartConfig.income.color : chartConfig.expenses.color }}
                            />
                            {name.charAt(0).toUpperCase() + name.slice(1)}: {currency}{Number(value).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        </>
                        )}
                        indicator="dot"
                    />
                }
              />
              <Legend content={<ChartLegendContent wrapperStyle={{paddingTop: 10}} />} />
              <Bar
                dataKey="income"
                fill={chartConfig.income.color}
                radius={[4, 4, 0, 0]} // Rounded top corners for bars
                barSize={20}
              />
              <Bar
                dataKey="expenses"
                fill={chartConfig.expenses.color}
                radius={[4, 4, 0, 0]} // Rounded top corners for bars
                barSize={20}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

export default IncomeExpensesChart;
