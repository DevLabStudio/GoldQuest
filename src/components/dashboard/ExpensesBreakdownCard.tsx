
'use client';

import type { FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCurrency } from '@/lib/currency';
import { getCategoryStyle } from '@/services/categories'; // To get consistent icons/styles
import type { Category } from '@/services/categories';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, TrendingUp, TrendingDown, House, UtensilsCrossed, Car, Clapperboard, ShoppingBag, LayoutGrid } from 'lucide-react';
import Link from 'next/link';

interface ExpenseItemData {
  name: string;
  amount: number;
  categoryDetails?: Category;
  // Placeholder for future trend data
  // trendPercentage?: number;
  // trendDirection?: 'up' | 'down' | 'neutral';
}

interface ExpensesBreakdownCardProps {
  data: ExpenseItemData[];
  currency: string;
  isLoading: boolean;
}

const CategoryExpenseItem: FC<{ item: ExpenseItemData, currency: string }> = ({ item, currency }) => {
  const { icon: CategoryIcon, color: categoryColor } = getCategoryStyle(item.categoryDetails || item.name);

  // Placeholder trend
  const trendPercentage = Math.floor(Math.random() * 25) + 1;
  const trendDirection = Math.random() > 0.5 ? 'up' : 'down';

  return (
    <Link
        href={item.categoryDetails ? `/categories/${item.categoryDetails.id}` : "/expenses"}
        className="block p-3 bg-muted/30 hover:bg-muted/50 rounded-lg transition-colors"
    >
        <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
            <div className={`p-2 rounded-full ${categoryColor} bg-opacity-20`}>
                <CategoryIcon />
            </div>
            <span className="text-sm font-medium text-foreground">{item.name}</span>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="text-lg font-semibold text-foreground">
            {formatCurrency(item.amount, currency, currency, false)}
        </div>
        {/* Placeholder for trend */}
        <div className={`text-xs flex items-center ${trendDirection === 'up' ? 'text-red-500' : 'text-green-500'}`}>
            {trendDirection === 'up' ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
            {trendPercentage}%
            <span className="text-muted-foreground ml-1">*vs last month</span>
        </div>
    </Link>
  );
};

const ExpensesBreakdownCard: FC<ExpensesBreakdownCardProps> = ({ data, currency, isLoading }) => {
    if (isLoading) {
        return (
            <Card className="h-full">
                <CardHeader>
                    <Skeleton className="h-6 w-3/4 mb-1" />
                    <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="p-3 bg-muted/30 rounded-lg space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Skeleton className="h-8 w-8 rounded-full" />
                                    <Skeleton className="h-4 w-20" />
                                </div>
                                <Skeleton className="h-4 w-4" />
                            </div>
                            <Skeleton className="h-6 w-1/2" />
                            <Skeleton className="h-3 w-1/3" />
                        </div>
                    ))}
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="h-full">
        <CardHeader>
            <CardTitle>Expenses Breakdown</CardTitle>
            <CardDescription>Your spending by category for the selected period. <span className="text-xs text-muted-foreground/80">(*Comparison data is placeholder)</span></CardDescription>
        </CardHeader>
        <CardContent>
            {data.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.map((item, index) => (
                <CategoryExpenseItem key={item.name + index} item={item} currency={currency} />
                ))}
            </div>
            ) : (
            <div className="text-center py-10 text-muted-foreground">
                No expense data to display for this period.
            </div>
            )}
        </CardContent>
        </Card>
    );
};

export default ExpensesBreakdownCard;
