
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
import { useDateRange } from '@/contexts/DateRangeContext'; // To get dateRangeLabel if needed
import { isWithinInterval, parseISO, startOfMonth, endOfMonth } from 'date-fns';


export interface SubscriptionPieChartDataPoint {
  name: string; // Category name
  value: number; // Total monthly equivalent amount for this category
  fill: string; // Color for the pie slice
}

// Helper to calculate monthly equivalent cost
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
  // Props can be added if needed, e.g., to pass pre-fetched data or config
  dateRangeLabel: string; // To display in the card description
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
        const prefs = await getUserPreferences();
        setPreferredCurrency(prefs.preferredCurrency);
        const [subs, cats] = await Promise.all([
          getSubscriptions(),
          getCategories(),
        ]);
        setSubscriptions(subs);
        setCategories(cats);
      } catch (error) {
        console.error("Failed to fetch data for subscriptions chart:", error);
        // Handle error appropriately, maybe set an error state
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
        // Consider if subscriptions should be filtered by selectedDateRange
        // For a "current monthly burden" view, we might not filter by date range,
        // or we might check if the subscription is active within the range.
        // For simplicity here, we'll consider all active expense subscriptions.
        // const isActiveInRange = selectedDateRange.from && selectedDateRange.to ?
        //   isWithinInterval(parseISO(sub.startDate), { start: selectedDateRange.from, end: selectedDateRange.to }) ||
        //   isWithinInterval(parseISO(sub.nextPaymentDate), { start: selectedDateRange.from, end: selectedDateRange.to })
        //   : true; // If no date range, assume active

        // if(isActiveInRange) { // If you want to filter by date range
            const monthlyCost = calculateMonthlyEquivalent(
            sub.amount,
            sub.currency,
            sub.frequency,
            preferredCurrency
            );
            categoryMonthlyTotals[sub.category] = (categoryMonthlyTotals[sub.category] || 0) + monthlyCost;
        // }
      }
    });

    return Object.entries(categoryMonthlyTotals)
      .map(([categoryName, totalAmount], index) => {
        const categoryDetails = categories.find(c => c.name === categoryName);
        // Use category specific color if available, otherwise cycle through BAR_COLORS
        let color = BAR_COLORS[index % BAR_COLORS.length];
        if (categoryDetails) {
            const style = getCategoryStyle(categoryDetails);
            // This is tricky as getCategoryStyle returns Tailwind classes.
            // For charts, direct HSL values are better. We'll stick to BAR_COLORS for now.
        }
        return {
          name: categoryName,
          value: parseFloat(totalAmount.toFixed(2)),
          fill: color,
        };
      })
      .filter(item => item.value > 0) // Only include categories with expenses
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

  const totalValue = useMemo(() => chartData.reduce((sum, item) => sum + item.value, 0), [chartData]);


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
      <Card className="shadow-lg bg-card text-card-foreground h-full">
        <CardHeader className="pb-2">
          <CardTitle>Monthly Subscription Costs</CardTitle>
          <CardDescription>By category for {dateRangeLabel}.</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center p-0 h-[250px] sm:h-[300px]">
          <p className="text-muted-foreground">No expense subscription data for this period.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg bg-card text-card-foreground flex flex-col h-full">
      <CardHeader className="pb-2">
        <CardTitle>Monthly Subscription Costs</CardTitle>
        <CardDescription>By category for {dateRangeLabel} ({preferredCurrency}).</CardDescription>
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
                          {totalValue > 0 ? ((Number(value) / totalValue) * 100).toFixed(1) : 0}%)
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
