
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
import { format as formatDateFns, parseISO, isFuture, differenceInDays } from 'date-fns';
import { CalendarDays, ArrowRight } from 'lucide-react';

interface UpcomingBillsCardProps {
  subscriptions: Subscription[];
  preferredCurrency: string;
  isLoading: boolean;
  accounts: Account[];
}

const UpcomingBillsCard: FC<UpcomingBillsCardProps> = ({ subscriptions, preferredCurrency, isLoading, accounts }) => {
  const upcomingBills = subscriptions
    .filter(sub => sub.type === 'expense' && isFuture(parseISO(sub.nextPaymentDate)))
    .sort((a, b) => parseISO(a.nextPaymentDate).getTime() - parseISO(b.nextPaymentDate).getTime())
    .slice(0, 3); // Show top 3 upcoming

  if (isLoading) {
     return (
      <Card className="h-full">
        <CardHeader>
          <Skeleton className="h-6 w-3/5 mb-1" />
          <Skeleton className="h-4 w-4/5" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-md" />
                <div>
                  <Skeleton className="h-4 w-24 mb-1" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
            <CardTitle>Upcoming Bills</CardTitle>
            <CardDescription>Your next recurring payments.</CardDescription>
        </div>
        <Link href="/financial-control" passHref>
            <Button variant="ghost" size="sm" className="text-xs text-primary hover:text-primary/80">
                View All <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {upcomingBills.length > 0 ? (
          <div className="space-y-3">
            {upcomingBills.map(bill => {
                const dueDate = parseISO(bill.nextPaymentDate);
                const account = accounts.find(acc => acc.id === bill.accountId);
                const { icon: CategoryIcon } = getCategoryStyle(bill.category); // Use category to get icon
                
                let lastChargeDate = 'N/A'; // Placeholder
                if (bill.lastPaidMonth) {
                    // Attempt to reconstruct a plausible last paid date from month string
                    try {
                        const [year, month] = bill.lastPaidMonth.split('-').map(Number);
                        lastChargeDate = formatDateFns(new Date(year, month -1, parseInt(formatDateFns(dueDate, 'dd')) ), 'dd MMM, yyyy');
                    } catch (e) { /* ignore date parse error */ }
                }


              return (
                <div key={bill.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-center justify-center p-2 bg-background rounded-md border w-12 h-12">
                        <span className="text-xs text-muted-foreground">{formatDateFns(dueDate, 'MMM')}</span>
                        <span className="text-lg font-bold text-primary">{formatDateFns(dueDate, 'dd')}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground truncate max-w-[120px]" title={bill.name}>{bill.name}</p>
                      <p className="text-xs text-muted-foreground">{bill.category} - {bill.frequency}</p>
                      {/* <p className="text-xs text-muted-foreground">Last Charge - {lastChargeDate}</p> */}
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {formatCurrency(bill.amount, bill.currency, preferredCurrency, false)}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-10 text-muted-foreground">
            <CalendarDays className="mx-auto h-12 w-12 text-muted-foreground/50 mb-2" />
            No upcoming bills to show.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default UpcomingBillsCard;
