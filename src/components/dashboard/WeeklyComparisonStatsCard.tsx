
'use client';

import type { FC } from 'react';
import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { formatCurrency, getCurrencySymbol, convertCurrency } from '@/lib/currency';
import { Skeleton } from '@/components/ui/skeleton';
import type { Transaction } from '@/services/transactions';
import {
    startOfDay, endOfDay,
    startOfWeek as startOfWeekDFNS, endOfWeek as endOfWeekDFNS,
    startOfMonth as startOfMonthDFNS, endOfMonth as endOfMonthDFNS,
    startOfYear as startOfYearDFNS, endOfYear as endOfYearDFNS,
    eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval,
    isWithinInterval as isWithinIntervalDFNS, parseISO, format as formatDateFns, differenceInDays, isSameDay
} from 'date-fns';
import { BarChart2 } from 'lucide-react';
import { useDateRange } from '@/contexts/DateRangeContext';


interface WeeklyComparisonStatsCardProps {
  preferredCurrency: string;
  periodTransactions: Transaction[];
  isLoading: boolean;
}

const WeeklyComparisonStatsCard: FC<WeeklyComparisonStatsCardProps> = ({ preferredCurrency, periodTransactions, isLoading }) => {
  const { selectedDateRange } = useDateRange();

  const chartData = useMemo(() => {
    if (isLoading || !periodTransactions) return [];

    let startDate: Date, endDate: Date;
    const isAllTimeSelection = !selectedDateRange.from && !selectedDateRange.to;

    let isFullYearSelection = false;
    if (selectedDateRange.from && selectedDateRange.to) {
        const fromStartOfYear = startOfYearDFNS(selectedDateRange.from);
        const fromEndOfYear = endOfYearDFNS(selectedDateRange.from);
        if (isSameDay(selectedDateRange.from, fromStartOfYear) && isSameDay(selectedDateRange.to, fromEndOfYear)) {
            isFullYearSelection = true;
        }
    }


    if (selectedDateRange.from && selectedDateRange.to) {
        startDate = selectedDateRange.from;
        endDate = selectedDateRange.to;
    } else if (periodTransactions.length > 0) {
        const dates = periodTransactions.map(tx => parseISO(tx.date.includes('T') ? tx.date : tx.date + 'T00:00:00Z').getTime());
        startDate = startOfDay(new Date(Math.min(...dates)));
        endDate = endOfDay(new Date(Math.max(...dates)));
    } else {
        return [];
    }

    const durationInDays = differenceInDays(endDate, startDate) + 1;
    let granularity: 'daily' | 'weekly' | 'monthly' = 'daily';

    if (isAllTimeSelection || isFullYearSelection) {
        granularity = 'monthly';
    } else {
        if (durationInDays > 180) {
            granularity = 'monthly';
        } else if (durationInDays > 31) {
            granularity = 'weekly';
        } else {
            granularity = 'daily';
        }
    }

    const data: { name: string; income: number; expenses: number }[] = [];

    if (granularity === 'daily') {
        const daysInPeriod = eachDayOfInterval({ start: startDate, end: endDate });
        for (const day of daysInPeriod) {
            const income = periodTransactions
                .filter(tx => tx.amount > 0 && tx.category !== "Transfer" && isSameDay(parseISO(tx.date.includes('T') ? tx.date : tx.date + 'T00:00:00Z'), day))
                .reduce((sum, tx) => sum + convertCurrency(tx.amount, tx.transactionCurrency, preferredCurrency), 0);
            const expenses = periodTransactions
                .filter(tx => tx.amount < 0 && tx.category !== "Transfer" && isSameDay(parseISO(tx.date.includes('T') ? tx.date : tx.date + 'T00:00:00Z'), day))
                .reduce((sum, tx) => sum + Math.abs(convertCurrency(tx.amount, tx.transactionCurrency, preferredCurrency)), 0);
            data.push({ name: formatDateFns(day, 'dd/MM'), income, expenses });
        }
    } else if (granularity === 'weekly') {
        const weeksInPeriod = eachWeekOfInterval({ start: startDate, end: endDate }, { weekStartsOn: 1 });
        for (const weekStart of weeksInPeriod) {
            const actualWeekEnd = endOfWeekDFNS(weekStart, { weekStartsOn: 1 });
            const effectiveWeekEnd = actualWeekEnd > endDate ? endDate : actualWeekEnd;

            const income = periodTransactions
                .filter(tx => {
                    const txDate = parseISO(tx.date.includes('T') ? tx.date : tx.date + 'T00:00:00Z');
                    return tx.amount > 0 && tx.category !== "Transfer" && isWithinIntervalDFNS(txDate, { start: weekStart, end: effectiveWeekEnd });
                })
                .reduce((sum, tx) => sum + convertCurrency(tx.amount, tx.transactionCurrency, preferredCurrency), 0);
            const expenses = periodTransactions
                .filter(tx => {
                    const txDate = parseISO(tx.date.includes('T') ? tx.date : tx.date + 'T00:00:00Z');
                    return tx.amount < 0 && tx.category !== "Transfer" && isWithinIntervalDFNS(txDate, { start: weekStart, end: effectiveWeekEnd });
                })
                .reduce((sum, tx) => sum + Math.abs(convertCurrency(tx.amount, tx.transactionCurrency, preferredCurrency)), 0);
            data.push({ name: `W${formatDateFns(weekStart, 'w')}`, income, expenses });
        }
    } else { // monthly
        const monthsInPeriod = eachMonthOfInterval({ start: startDate, end: endDate });
        for (const monthStart of monthsInPeriod) {
            const actualMonthEnd = endOfMonthDFNS(monthStart);
            const effectiveMonthEnd = actualMonthEnd > endDate ? endDate : actualMonthEnd;

            const income = periodTransactions
                .filter(tx => {
                    const txDate = parseISO(tx.date.includes('T') ? tx.date : tx.date + 'T00:00:00Z');
                    return tx.amount > 0 && tx.category !== "Transfer" && isWithinIntervalDFNS(txDate, { start: monthStart, end: effectiveMonthEnd });
                })
                .reduce((sum, tx) => sum + convertCurrency(tx.amount, tx.transactionCurrency, preferredCurrency), 0);
            const expenses = periodTransactions
                .filter(tx => {
                    const txDate = parseISO(tx.date.includes('T') ? tx.date : tx.date + 'T00:00:00Z');
                    return tx.amount < 0 && tx.category !== "Transfer" && isWithinIntervalDFNS(txDate, { start: monthStart, end: effectiveMonthEnd });
                })
                .reduce((sum, tx) => sum + Math.abs(convertCurrency(tx.amount, tx.transactionCurrency, preferredCurrency)), 0);
            data.push({ name: formatDateFns(monthStart, 'MMM yy'), income, expenses });
        }
    }
    return data;

  }, [periodTransactions, preferredCurrency, isLoading, selectedDateRange]);


  const chartConfig = {
    income: {
      label: "Income",
      color: "hsl(var(--chart-2))",
    },
    expenses: {
      label: "Expenses",
      color: "hsl(var(--chart-4))",
    },
  } satisfies ChartConfig;

  if (isLoading) {
     return (
      <Card>
        <CardHeader className="py-3 px-4">
          <Skeleton className="h-5 w-1/4 mb-0.5" />
          <Skeleton className="h-3 w-1/2" />
        </CardHeader>
        <CardContent className="pt-2 pb-3 px-4 min-h-[280px] flex items-center justify-center">
            <Skeleton className="h-full w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-base">Statistics</CardTitle>
        <CardDescription className="text-xs">Income vs. Expenses trend for the selected period.</CardDescription>
      </CardHeader>
      <CardContent className={chartData.length > 0 ? "h-[280px] pb-0 pt-2 px-4" : "p-4 text-center min-h-[280px] flex flex-col items-center justify-center"}>
        {chartData.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-full w-full">
            <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={6}
                    className="text-xs fill-muted-foreground"
                    tickFormatter={(value) => value} // Use the 'name' value directly
                />
                <YAxis
                    tickFormatter={(value) => `${getCurrencySymbol(preferredCurrency)}${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value.toFixed(0)}`}
                    tickLine={false} axisLine={false} tickMargin={6} className="text-xs fill-muted-foreground"
                />
                <ChartTooltip
                    cursor={false}
                    content={
                    <ChartTooltipContent
                        formatter={(value, name) => (
                        <>
                            <span
                            className="w-2 h-2 rounded-full mr-1.5"
                            style={{ backgroundColor: chartConfig[name as keyof typeof chartConfig]?.color || 'transparent' }}
                            />
                            {chartConfig[name as keyof typeof chartConfig]?.label || name}: {formatCurrency(Number(value), preferredCurrency, preferredCurrency, false)}
                        </>
                        )}
                        indicator="dot"
                    />
                    }
                />
                <Legend content={<ChartLegendContent wrapperStyle={{paddingTop: 8}} className="text-xs"/>} />
                <Bar dataKey="income" fill="var(--color-income)" radius={3} barSize={chartData.length > 15 ? 6 : (chartData.length > 7 ? 8 : 10)} />
                <Bar dataKey="expenses" fill="var(--color-expenses)" radius={3} barSize={chartData.length > 15 ? 6 : (chartData.length > 7 ? 8 : 10)} />
                </BarChart>
            </ResponsiveContainer>
            </ChartContainer>
        ) : (
            <>
              <BarChart2 className="h-8 w-8 text-muted-foreground/50 mb-1" />
              <p className="text-muted-foreground text-xs">
                No income or expense data for the selected period.
              </p>
            </>
        )}
      </CardContent>
    </Card>
  );
};

export default WeeklyComparisonStatsCard;

