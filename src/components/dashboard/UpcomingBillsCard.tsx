
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
    .slice(0, 3); 

  if (isLoading) {
     return (
      <Card className="h-full">
        <CardHeader className="py-3 px-4">
          <Skeleton className="h-5 w-3/5 mb-0.5" />
          <Skeleton className="h-3 w-4/5" />
        </CardHeader>
        <CardContent className="space-y-3 pt-2 pb-3 px-4">
          {[...Array(2)].map((_, i) => (
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
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
        <div>
            <CardTitle className="text-base">Upcoming Bills</CardTitle>
            <CardDescription className="text-xs">Your next recurring payments.</CardDescription>
        </div>
        <Link href="/financial-control" passHref>
            <Button variant="ghost" size="sm" className="text-xs text-primary hover:text-primary/80 h-auto px-1.5 py-0.5">
                View All <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
        </Link>
      </CardHeader>
      <CardContent className="pt-2 pb-3 px-4">
        {upcomingBills.length > 0 ? (
          <div className="space-y-2">
            {upcomingBills.map(bill => {
                const dueDate = parseISO(bill.nextPaymentDate);
                const account = accounts.find(acc => acc.id === bill.accountId);
                const { icon: CategoryIcon } = getCategoryStyle(bill.category); 
                
                let lastChargeDate = 'N/A'; 
                if (bill.lastPaidMonth) {
                    try {
                        const [year, month] = bill.lastPaidMonth.split('-').map(Number);
                        lastChargeDate = formatDateFns(new Date(year, month -1, parseInt(formatDateFns(dueDate, 'dd')) ), 'dd MMM, yyyy');
                    } catch (e) { /* ignore date parse error */ }
                }

              return (
                <div key={bill.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col items-center justify-center p-1.5 bg-background rounded-md border w-10 h-10">
                        <span className="text-xs text-muted-foreground">{formatDateFns(dueDate, 'MMM')}</span>
                        <span className="text-base font-bold text-primary">{formatDateFns(dueDate, 'dd')}</span>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-foreground truncate max-w-[100px]" title={bill.name}>{bill.name}</p>
                      <p className="text-xs text-muted-foreground">{bill.category} - {bill.frequency}</p>
                    </div>
                  </div>
                  <p className="text-xs font-semibold text-foreground">
                    {formatCurrency(bill.amount, bill.currency, preferredCurrency, false)}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <CalendarDays className="mx-auto h-10 w-10 text-muted-foreground/50 mb-1.5" />
            No upcoming bills.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default UpcomingBillsCard;
