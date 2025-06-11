
'use client';

import type { FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCurrency } from '@/lib/currency';
import { getCategoryStyle } from '@/services/categories'; 
import type { Category } from '@/services/categories';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, TrendingUp, TrendingDown } from 'lucide-react';
import Link from 'next/link';

interface ExpenseItemData {
  name: string;
  amount: number;
  categoryDetails?: Category;
  trendPercentage?: number;
  trendDirection?: 'up' | 'down' | 'neutral';
}

interface ExpensesBreakdownCardProps {
  data: ExpenseItemData[];
  currency: string;
  isLoading: boolean;
}

const CategoryExpenseItem: FC<{ item: ExpenseItemData, currency: string }> = ({ item, currency }) => {
  const { icon: CategoryIcon, color: categoryColor } = getCategoryStyle(item.categoryDetails || item.name);

  return (
    <Link
        href={item.categoryDetails ? `/categories/${item.categoryDetails.id}` : "/expenses"}
        className="block p-2.5 bg-muted/30 hover:bg-muted/50 rounded-lg transition-colors"
    >
        <div className="flex items-center justify-between mb-0.5">
            <div className="flex items-center gap-1.5">
            <div className={`p-1.5 rounded-full ${categoryColor} bg-opacity-20`}>
                <CategoryIcon />
            </div>
            <span className="text-xs font-medium text-foreground">{item.name}</span>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div className="text-base font-semibold text-foreground">
            {formatCurrency(item.amount, currency, currency, false)}
        </div>
        {item.trendPercentage !== undefined && item.trendDirection && item.trendDirection !== 'neutral' && (
            <div className={`text-xs flex items-center ${item.trendDirection === 'up' ? 'text-red-500' : 'text-green-500'}`}>
                {item.trendDirection === 'up' ? <TrendingUp className="h-2.5 w-2.5 mr-0.5" /> : <TrendingDown className="h-2.5 w-2.5 mr-0.5" />}
                {Math.abs(item.trendPercentage).toFixed(0)}%
                <span className="text-muted-foreground ml-1 text-xs">vs prev. period</span>
            </div>
        )}
        {item.trendDirection === 'neutral' && item.trendPercentage !== undefined && (
            <div className="text-xs flex items-center text-muted-foreground">
                <span className="h-2.5 w-2.5 mr-0.5">–</span>
                0%
                <span className="text-muted-foreground ml-1 text-xs">vs prev. period</span>
            </div>
        )}
         {item.trendPercentage === undefined && ( // Handle case where trend is N/A (e.g., All Time)
            <div className="text-xs flex items-center text-muted-foreground">
                <span className="text-muted-foreground ml-1 text-xs">Trend N/A</span>
            </div>
        )}
    </Link>
  );
};

const ExpensesBreakdownCard: FC<ExpensesBreakdownCardProps> = ({ data, currency, isLoading }) => {
    if (isLoading) {
        return (
            <Card>
                <CardHeader className="py-3 px-4">
                    <Skeleton className="h-5 w-3/4 mb-0.5" />
                    <Skeleton className="h-3 w-1/2" />
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2 pb-3 px-4">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="p-2.5 bg-muted/30 rounded-lg space-y-1.5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <Skeleton className="h-7 w-7 rounded-full" />
                                    <Skeleton className="h-3 w-16" />
                                </div>
                                <Skeleton className="h-3 w-3" />
                            </div>
                            <Skeleton className="h-5 w-1/2" />
                            <Skeleton className="h-2.5 w-1/3" />
                        </div>
                    ))}
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
        <CardHeader className="py-3 px-4">
            <CardTitle className="text-base">Expenses Breakdown</CardTitle>
            <CardDescription className="text-xs">Your spending by category for the selected period.</CardDescription>
        </CardHeader>
        <CardContent className="pt-2 pb-3 px-4">
            {data.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.map((item, index) => (
                <CategoryExpenseItem key={item.name + index} item={item} currency={currency} />
                ))}
            </div>
            ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
                No expense data to display for this period.
            </div>
            )}
        </CardContent>
        </Card>
    );
};

export default ExpensesBreakdownCard;
