
'use client';

import type { FC } from 'react';
import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts'; // Changed Tooltip alias
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart'; // Added ChartTooltip
import { formatCurrency, getCurrencySymbol } from '@/lib/currency';
import { Skeleton } from '@/components/ui/skeleton';
import type { Transaction } from '@/services/transactions';
import { subDays, format, startOfWeek, endOfWeek, eachDayOfInterval, parseISO, isSameDay } from 'date-fns';


interface WeeklyComparisonStatsCardProps {
  preferredCurrency: string;
  periodTransactions: Transaction[];
  isLoading: boolean;
}

const WeeklyComparisonStatsCard: FC<WeeklyComparisonStatsCardProps> = ({ preferredCurrency, periodTransactions, isLoading }) => {
  const chartData = useMemo(() => {
    if (isLoading || !periodTransactions) return [];

    const today = new Date();
    const startOfThisWeek = startOfWeek(today, { weekStartsOn: 0 }); // Sunday
    const endOfThisWeek = endOfWeek(today, { weekStartsOn: 0 });
    // const startOfLastWeek = startOfWeek(subDays(today, 7), { weekStartsOn: 0 });
    // const endOfLastWeek = endOfWeek(subDays(today, 7), { weekStartsOn: 0 });

    const thisWeekDays = eachDayOfInterval({ start: startOfThisWeek, end: endOfThisWeek });
    // const lastWeekDays = eachDayOfInterval({ start: startOfLastWeek, end: endOfLastWeek });

    const data = thisWeekDays.map(day => {
        const dayKey = format(day, 'd EEE'); // e.g., "17 Sun"

        const thisWeekSpending = periodTransactions
            .filter(tx => tx.amount < 0 && tx.category !== "Transfer" && isSameDay(parseISO(tx.date), day))
            .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
        
        // For simplicity, last week's data will be random placeholders
        const lastWeekSpending = Math.random() * (thisWeekSpending > 0 ? thisWeekSpending * 1.5 : 5000);


        return {
            name: dayKey,
            thisWeek: thisWeekSpending,
            lastWeek: lastWeekSpending,
        };
    });
    return data;

  }, [periodTransactions, preferredCurrency, isLoading]);


  const chartConfig = {
    thisWeek: {
      label: "This week",
      color: "hsl(var(--chart-1))",
    },
    lastWeek: {
      label: "Last week",
      color: "hsl(var(--chart-2))",
    },
  } satisfies ChartConfig;

  if (isLoading) {
     return (
      <Card className="h-full">
        <CardHeader>
          <Skeleton className="h-6 w-3/4 mb-1" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent>
            <Skeleton className="h-60 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Statistics</CardTitle>
        <CardDescription>Weekly spending comparison (Placeholder data for 'Last Week').</CardDescription>
      </CardHeader>
      <CardContent className="h-[300px] pb-0">
        {chartData.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-full w-full">
            <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} className="text-xs fill-muted-foreground" />
                <YAxis 
                    tickFormatter={(value) => `${getCurrencySymbol(preferredCurrency)}${value / 1000}k`}
                    tickLine={false} axisLine={false} tickMargin={8} className="text-xs fill-muted-foreground"
                />
                <ChartTooltip
                    cursor={false}
                    content={
                    <ChartTooltipContent
                        formatter={(value, name) => (
                        <>
                            <span
                            className="w-2.5 h-2.5 rounded-full mr-2"
                            style={{ backgroundColor: name === "thisWeek" ? chartConfig.thisWeek.color : chartConfig.lastWeek.color }}
                            />
                            {name === "thisWeek" ? "This Week" : "Last Week"}: {formatCurrency(Number(value), preferredCurrency, preferredCurrency, false)}
                        </>
                        )}
                        indicator="dot"
                    />
                    }
                />
                <Legend content={<ChartLegendContent wrapperStyle={{paddingTop: 10}}/>} />
                <Bar dataKey="thisWeek" fill="var(--color-thisWeek)" radius={4} barSize={15}/>
                <Bar dataKey="lastWeek" fill="var(--color-lastWeek)" radius={4} barSize={15}/>
                </BarChart>
            </ResponsiveContainer>
            </ChartContainer>
        ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
                No spending data for this week.
            </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WeeklyComparisonStatsCard;

