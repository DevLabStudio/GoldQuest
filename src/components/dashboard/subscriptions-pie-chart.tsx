
'use client';

import type { FC } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { getSubscriptions, type Subscription, type SubscriptionFrequency } from '@/services/subscriptions';
import { getCategories, type Category as CategoryType, getCategoryStyle } from '@/services/categories';
import { getUserPreferences } from '@/lib/preferences';
import { convertCurrency, formatCurrency } from '@/lib/currency';
import { useDateRange } from '@/contexts/DateRangeContext';
import { isWithinInterval, parseISO, startOfMonth, endOfMonth } from 'date-fns';


export interface SubscriptionPieChartDataPoint {
  name: string;
  value: number;
  fill: string;
}

const calculateMonthlyEquivalent = (
  amount: number,
  currency: string,
  frequency: SubscriptionFrequency,
  preferredDisplayCurrency: string,
): number => {
  const amountInPreferredCurrency = convertCurrency(amount, currency, preferredDisplayCurrency);
  switch (frequency) {
    case 'daily': return amountInPreferredCurrency * 30;
    case 'weekly': return amountInPreferredCurrency * 4;
    case 'bi-weekly': return amountInPreferredCurrency * 2;
    case 'monthly': return amountInPreferredCurrency;
    case 'quarterly': return amountInPreferredCurrency / 3;
    case 'semi-annually': return amountInPreferredCurrency / 6;
    case 'annually': return amountInPreferredCurrency / 12;
    default: return 0;
  }
};

const BAR_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

interface SubscriptionsPieChartProps {
  dateRangeLabel: string;
}

const SubscriptionsPieChart: FC<SubscriptionsPieChartProps> = ({ dateRangeLabel }) => {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [categories, setCategories] = useState<CategoryType[]>([]);
  const [preferredCurrency, setPreferredCurrency] = useState('BRL');
  const [isLoading, setIsLoading] = useState(true);
  const { selectedDateRange } = useDateRange();


  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        if (typeof window !== 'undefined') {
            const prefs = await getUserPreferences();
            setPreferredCurrency(prefs.preferredCurrency);
        }
        const [subs, cats] = await Promise.all([
          getSubscriptions(),
          getCategories(),
        ]);
        setSubscriptions(subs);
        setCategories(cats);
      } catch (error) {
        console.error("Failed to fetch data for subscriptions chart:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const chartData = useMemo((): SubscriptionPieChartDataPoint[] => {
    if (isLoading || subscriptions.length === 0 || categories.length === 0) {
      return [];
    }

    const categoryMonthlyTotals: Record<string, number> = {};

    subscriptions.forEach(sub => {
      if (sub.type === 'expense') {
        const subStartDate = parseISO(sub.startDate);
        let isActiveInRange = true;
        if (selectedDateRange.from && selectedDateRange.to) {
           isActiveInRange = subStartDate <= selectedDateRange.to;
        }

        if(isActiveInRange) {
            const monthlyCost = calculateMonthlyEquivalent(
            sub.amount,
            sub.currency,
            sub.frequency,
            preferredCurrency
            );
            categoryMonthlyTotals[sub.category] = (categoryMonthlyTotals[sub.category] || 0) + monthlyCost;
        }
      }
    });

    return Object.entries(categoryMonthlyTotals)
      .map(([categoryName, totalAmount], index) => {
        const categoryDetails = categories.find(c => c.name === categoryName);
        let color = BAR_COLORS[index % BAR_COLORS.length];
        return {
          name: categoryName,
          value: parseFloat(totalAmount.toFixed(2)),
          fill: color,
        };
      })
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [isLoading, subscriptions, categories, preferredCurrency, selectedDateRange]);

  const chartConfig = useMemo(() => {
    return chartData.reduce((acc, item) => {
      acc[item.name] = {
        label: item.name,
        color: item.fill,
      };
      return acc;
    }, {} as ChartConfig);
  }, [chartData]);

  const totalMonthlySubscriptionCost = useMemo(() => {
    return chartData.reduce((sum, item) => sum + item.value, 0);
  }, [chartData]);


  if (isLoading) {
    return (
      <Card className="shadow-lg bg-card text-card-foreground h-full">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2 mt-1" />
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center p-0 h-[250px] sm:h-[300px]">
          <Skeleton className="h-full w-full" />
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card className="shadow-lg bg-card text-card-foreground"> {/* Removed h-full */}
        <CardHeader className="pb-2">
          <CardTitle>Subscriptions</CardTitle>
          <CardDescription>
            Total Monthly: {formatCurrency(0, preferredCurrency, preferredCurrency, false)} ({dateRangeLabel})
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center p-6 text-center min-h-[100px]"> {/* Removed fixed height, added padding and text-center, min-height */}
          <p className="text-muted-foreground">No expense subscription data to display for the selected period.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg bg-card text-card-foreground flex flex-col h-full">
      <CardHeader className="pb-2">
        <CardTitle>Subscriptions</CardTitle>
        <CardDescription>
            Total Monthly: {formatCurrency(totalMonthlySubscriptionCost, preferredCurrency, preferredCurrency, false)} ({dateRangeLabel})
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col items-center justify-center p-0 h-[250px] sm:h-[300px]">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square w-full h-full max-h-[280px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <RechartsTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    hideLabel
                    formatter={(value, name, props) => (
                      <div className="flex items-center">
                        <span
                          className="w-2.5 h-2.5 rounded-full mr-2"
                          style={{ backgroundColor: props.payload.fill }}
                        />
                        <span>
                          {props.payload.name}: {formatCurrency(Number(value), preferredCurrency, preferredCurrency, false)} (
                          {totalMonthlySubscriptionCost > 0 ? ((Number(value) / totalMonthlySubscriptionCost) * 100).toFixed(1) : 0}%)
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius="70%"
                innerRadius="40%"
                labelLine={false}
                label={false}
              >
                {chartData.map((entry) => (
                  <Cell key={`cell-${entry.name}`} fill={entry.fill} stroke={entry.fill} />
                ))}
              </Pie>
               <Legend content={<ChartLegendContent nameKey="name" className="text-xs [&_svg]:size-3"/>} verticalAlign="bottom" align="center" iconSize={10} wrapperStyle={{paddingTop: 10}}/>
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

export default SubscriptionsPieChart;
