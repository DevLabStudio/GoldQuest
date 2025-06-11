
'use client';

import type { FC } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { getSubscriptions, type Subscription, type SubscriptionFrequency } from '@/services/subscriptions';
import { getCategories, type Category as CategoryType, getCategoryStyle } from '@/services/categories';
import { getUserPreferences } from '@/lib/preferences';
import { convertCurrency, formatCurrency, getCurrencySymbol } from '@/lib/currency';
import { useDateRange } from '@/contexts/DateRangeContext';
import { isWithinInterval, parseISO, startOfMonth, endOfMonth } from 'date-fns';


export interface SubscriptionBarChartDataPoint {
  name: string; // Category name
  value: number; // Monthly cost
  fill: string; // Color for the bar
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

interface SubscriptionsBarChartProps {
  dateRangeLabel: string;
}

const SubscriptionsBarChart: FC<SubscriptionsBarChartProps> = ({ dateRangeLabel }) => {
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

  const chartData = useMemo((): SubscriptionBarChartDataPoint[] => {
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
        let color = BAR_COLORS[index % BAR_COLORS.length];
        return {
          name: categoryName,
          value: parseFloat(totalAmount.toFixed(2)),
          fill: color,
        };
      })
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value); // Sort for better bar chart display
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
      <Card className="shadow-lg bg-card text-card-foreground">
        <CardHeader className="py-3 px-4">
          <Skeleton className="h-5 w-3/4 mb-0.5" />
          <Skeleton className="h-4 w-1/2 mt-0.5" />
        </CardHeader>
        <CardContent className="p-0 min-h-[300px] flex items-center justify-center">
          <Skeleton className="h-full w-full" />
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card className="shadow-lg bg-card text-card-foreground">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-base">Subscriptions</CardTitle>
          <CardDescription className="text-xs">
            Total Monthly: {formatCurrency(0, preferredCurrency, preferredCurrency, false)} ({dateRangeLabel})
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center p-4 text-center min-h-[100px]">
          <p className="text-muted-foreground text-sm">No expense subscription data to display for the selected period.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg bg-card text-card-foreground flex flex-col">
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-base">Subscriptions</CardTitle>
        <CardDescription className="text-xs">
            Monthly Cost by Category ({formatCurrency(totalMonthlySubscriptionCost, preferredCurrency, preferredCurrency, false)} Total / {dateRangeLabel})
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 p-0 min-h-[300px] pb-4">
        <ChartContainer
          config={chartConfig}
          className="w-full h-full"
        >
          <ResponsiveContainer width="100%" height={Math.max(280, chartData.length * 35 + 60)}> {/* Dynamic height */}
            <BarChart
              layout="vertical"
              data={chartData}
              margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
            >
              <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                type="number"
                tickFormatter={(value) => getCurrencySymbol(preferredCurrency) + (value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value.toFixed(0))}
                axisLine={false}
                tickLine={false}
                className="text-xs fill-muted-foreground"
                tickMargin={6}
              />
              <YAxis
                dataKey="name"
                type="category"
                width={100}
                tickLine={false}
                axisLine={false}
                className="text-xs fill-muted-foreground truncate"
                tickMargin={6}
              />
              <RechartsTooltip
                cursor={{ fill: 'hsl(var(--muted))' }}
                content={
                  <ChartTooltipContent
                    formatter={(value, name, props) => (
                      <div className="flex items-center">
                        <span
                          className="w-2.5 h-2.5 rounded-full mr-2"
                          style={{ backgroundColor: props.payload.fill }}
                        />
                        <span>
                          {props.payload.name}: {formatCurrency(Number(value), preferredCurrency, preferredCurrency, false)}
                        </span>
                      </div>
                    )}
                    labelClassName="font-semibold"
                    wrapperClassName="rounded-lg border bg-popover px-2.5 py-1.5 text-xs shadow-xl"

                  />
                }
              />
              <Bar dataKey="value" layout="vertical" radius={[0, 4, 4, 0]} barSize={20}>
                {chartData.map((entry) => (
                  <Cell key={`cell-${entry.name}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

export default SubscriptionsBarChart;
