
'use client';

import type { FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/currency';
import { TrendingUp, TrendingDown, MoreHorizontal, ArrowRight, BarChartBig, Landmark, ShoppingCart, DollarSign } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface BudgetManagementCardProps {
  preferredCurrency: string;
  isLoading: boolean;
}

interface BudgetItem {
  name: string;
  value: number;
  percentage: number;
  trend: number;
  icon: React.ReactNode;
  color: string; // Tailwind color class for the square icon
}

const BudgetManagementCard: FC<BudgetManagementCardProps> = ({ preferredCurrency, isLoading }) => {
  // Placeholder data
  const totalBudgetValue = 4800;
  const totalBudgetTrend = 21.7;

  const budgetItems: BudgetItem[] = [
    { name: 'Assets', value: 2200, percentage: 42, trend: 11, icon: <Landmark className="h-5 w-5" />, color: 'bg-orange-400' },
    { name: 'Spending', value: 1900, percentage: 24, trend: -9, icon: <ShoppingCart className="h-5 w-5" />, color: 'bg-pink-400' },
    { name: 'Investing', value: 900, percentage: 20, trend: -4, icon: <BarChartBig className="h-5 w-5" />, color: 'bg-teal-400' },
    { name: 'Allocation', value: 700, percentage: 16, trend: 37, icon: <DollarSign className="h-5 w-5" />, color: 'bg-slate-400' },
  ];
  const progressSegments = [
    { name: 'Assets', value: 42, color: 'bg-orange-400' },
    { name: 'Spending', value: 24, color: 'bg-pink-400' },
    { name: 'Investment', value: 20, color: 'bg-teal-400' },
    { name: 'Allocation', value: 16, color: 'bg-slate-400' },
  ];


  if (isLoading) {
    return (
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-6 w-6 rounded-full" />
        </CardHeader>
        <CardContent className="px-4 py-3 space-y-3">
          <Skeleton className="h-10 w-1/3" />
          <div className="flex flex-col space-y-1.5">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-3 w-1/4" />
                <Skeleton className="h-3 w-3/4 rounded-full" />
                <Skeleton className="h-3 w-10" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
        <div className="flex items-center gap-2">
          <BarChartBig className="h-5 w-5 text-primary" />
          <CardTitle className="text-base font-semibold">Budget Management</CardTitle>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">More options</span>
        </Button>
      </CardHeader>
      <CardContent className="px-4 py-3 space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-foreground">
            {formatCurrency(totalBudgetValue, preferredCurrency, preferredCurrency, false).replace('.00','k')}
          </span>
          <div className={`flex items-center text-xs font-medium ${totalBudgetTrend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {totalBudgetTrend >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {Math.abs(totalBudgetTrend)}%
          </div>
        </div>

        <div className="space-y-1.5">
          {progressSegments.map((item) => (
            <div key={item.name} className="flex items-center text-xs">
              <span className="w-20 shrink-0 text-muted-foreground">{item.name}</span>
              <div className="flex-grow h-2 bg-muted rounded-full overflow-hidden">
                <div className={`${item.color} h-2 rounded-full`} style={{ width: `${item.value}%` }} />
              </div>
              <span className="ml-2 w-8 text-right font-medium">{item.value}%</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          {budgetItems.map((item) => (
            <div key={item.name} className="bg-muted/40 p-3 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-sm ${item.color}`} />
                  <span className="text-xs font-medium text-foreground">{item.name}</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="text-lg font-semibold text-foreground">
                {formatCurrency(item.value, preferredCurrency, preferredCurrency, false).replace('.00','K')}
              </div>
              <div className={`text-xs flex items-center ${item.trend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {item.trend >= 0 ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
                {Math.abs(item.trend)}%
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default BudgetManagementCard;
