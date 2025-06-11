
'use client';

import type { FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress"; // Using ShadCN progress
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/currency';
import { Target, Edit3, PlusCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface GoalsCardProps {
  preferredCurrency: string;
  isLoading: boolean;
}

const GoalsCard: FC<GoalsCardProps> = ({ preferredCurrency, isLoading }) => {
  // Placeholder data - replace with actual data fetching and logic
  const targetAmount = 20000;
  const achievedAmount = 12500;
  const currentMonthTarget = 20000; // This might be same as targetAmount for simple goals
  const progressPercentage = (achievedAmount / targetAmount) * 100;

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="py-3 px-4">
          <Skeleton className="h-5 w-1/2 mb-0.5" />
          <Skeleton className="h-3 w-1/3" />
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center space-y-3 pt-2 pb-3 px-4">
            <Skeleton className="h-6 w-3/4 mb-1" />
            <Skeleton className="h-20 w-20 rounded-full" />
            <div className="w-full space-y-0.5">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
            </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full">
      <CardHeader className="py-3 px-4">
        <div className="flex justify-between items-center">
            <CardTitle className="text-base">Goals</CardTitle>
            <Button variant="ghost" size="sm" className="text-xs text-primary h-auto px-1.5 py-0.5">
                 <Edit3 className="mr-1 h-3 w-3" /> Edit Goal
            </Button>
        </div>
        <CardDescription className="text-xs">Your progress towards financial targets.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center pt-2 pb-3 px-4">
        <div className="flex items-center justify-between w-full mb-1">
            <p className="text-xl font-bold text-primary">{formatCurrency(targetAmount, preferredCurrency, preferredCurrency, false)}</p>
            <p className="text-xs text-muted-foreground">May, 2024</p> {/* Placeholder date */}
        </div>

        <div className="relative w-28 h-28 my-2"> {/* Reduced size from w-36 h-36 */}
            <svg className="w-full h-full" viewBox="0 0 36 36">
                <path
                className="text-muted/20"
                strokeWidth="3"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                className="text-primary"
                strokeWidth="3"
                strokeDasharray={`${progressPercentage}, 100`}
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                transform="rotate(-90 18 18)"
                d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Target className="h-5 w-5 text-primary mb-0.5"/> {/* Reduced icon size */}
                <span className="text-base font-semibold text-primary">{`${progressPercentage.toFixed(0)}%`}</span> {/* Reduced font size */}
            </div>
        </div>

        <div className="w-full text-center text-xs text-muted-foreground mb-2">
          Target vs Achievement
        </div>

        <div className="w-full space-y-0.5 text-xs"> {/* Reduced font size */}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Target Achieved:</span>
            <span className="font-medium text-green-500">{formatCurrency(achievedAmount, preferredCurrency, preferredCurrency, false)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">This month Target:</span>
            <span className="font-medium">{formatCurrency(currentMonthTarget, preferredCurrency, preferredCurrency, false)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default GoalsCard;
