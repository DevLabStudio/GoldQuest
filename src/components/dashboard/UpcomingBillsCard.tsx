
'use client';

import type { FC } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { Subscription } from '@/services/subscriptions';
import type { Account } from '@/services/account-sync';
import { getCategoryStyle } from '@/services/categories';
import { formatCurrency } from '@/lib/currency';
import { format as formatDateFns, parseISO } from 'date-fns';
import { CalendarDays, ArrowRight, TrendingUp, TrendingDown } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area'; // Added ScrollArea
import { cn } from '@/lib/utils';

interface SubscriptionsCardProps {
  subscriptions: Subscription[];
  preferredCurrency: string;
  isLoading: boolean;
  accounts: Account[];
}

const SubscriptionsCard: FC<SubscriptionsCardProps> = ({ subscriptions, preferredCurrency, isLoading, accounts }) => {
  // Show all subscriptions, sorted by next payment date
  const processedSubscriptions = subscriptions
    .sort((a, b) => parseISO(a.nextPaymentDate).getTime() - parseISO(b.nextPaymentDate).getTime());

  if (isLoading) {
     return (
      <Card>
        <CardHeader className="py-3 px-4">
          <Skeleton className="h-5 w-3/5 mb-0.5" />
          <Skeleton className="h-3 w-4/5" />
        </CardHeader>
        <CardContent className="space-y-3 pt-2 pb-3 px-4">
          {[...Array(3)].map((_, i) => ( // Show more skeletons as we expect more items potentially
            <div key={i} className="flex items-center justify-between py-1.5 border-b">
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded-md" />
                <div>
                  <Skeleton className="h-3 w-20 mb-0.5" />
                  <Skeleton className="h-2 w-16" />
                </div>
              </div>
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
        <div>
            <CardTitle className="text-base">Subscriptions</CardTitle>
            <CardDescription className="text-xs">Your recurring income and expenses.</CardDescription>
        </div>
        <Link href="/financial-control" passHref>
            <Button variant="ghost" size="sm" className="text-xs text-primary hover:text-primary/80 h-auto px-1.5 py-0.5">
                Manage <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
        </Link>
      </CardHeader>
      <CardContent className={processedSubscriptions.length > 0 ? "pt-2 pb-3 px-4" : "p-4 text-center"}>
        {processedSubscriptions.length > 0 ? (
          <ScrollArea className="h-[260px] pr-2">
            <div className="space-y-2">
              {processedSubscriptions.map(sub => {
                  const dueDate = parseISO(sub.nextPaymentDate);
                  // const account = accounts.find(acc => acc.id === sub.accountId);
                  const { icon: CategoryIcon } = getCategoryStyle(sub.category);
                  const isIncome = sub.type === 'income';

                return (
                  <div key={sub.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "flex flex-col items-center justify-center p-1.5 rounded-md border w-10 h-10",
                        isIncome ? "bg-green-500/10 border-green-500/30" : "bg-red-500/10 border-red-500/30"
                      )}>
                          <span className={cn("text-xs", isIncome ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>{formatDateFns(dueDate, 'MMM')}</span>
                          <span className={cn("text-base font-bold", isIncome ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>{formatDateFns(dueDate, 'dd')}</span>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-foreground truncate max-w-[100px] sm:max-w-[120px]" title={sub.name}>{sub.name}</p>
                        <p className="text-xs text-muted-foreground">{sub.category} - {sub.frequency}</p>
                      </div>
                    </div>
                    <div className="text-right">
                        <p className={cn(
                            "text-xs font-semibold",
                            isIncome ? "text-green-500 dark:text-green-400" : "text-red-500 dark:text-red-400"
                        )}>
                            {isIncome ? '+' : '-'}
                            {formatCurrency(sub.amount, sub.currency, preferredCurrency, false)}
                        </p>
                        {sub.currency.toUpperCase() !== preferredCurrency.toUpperCase() && (
                            <p className="text-xs text-muted-foreground">
                                (≈ {formatCurrency(sub.amount, sub.currency, preferredCurrency, true)})
                            </p>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-muted-foreground text-sm"> {/* Ensure consistent padding & text size */}
            <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground/50 mb-1" />
            <p>No subscriptions found.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SubscriptionsCard;
