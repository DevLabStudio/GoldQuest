
'use client';

import type { FC } from 'react';
import { useMemo } from 'react'; // Import useMemo
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import type { Transaction } from '@/services/transactions';
import type { Account } from '@/services/account-sync';
import { formatCurrency, convertCurrency } from '@/lib/currency';

interface MonthlySummarySidebarProps {
  transactions: Transaction[];
  accounts: Account[];
  preferredCurrency: string;
  transactionType: 'expense' | 'income' | 'transfer' | 'all'; // To tailor summary
  isLoading?: boolean;
}

interface MonthlySummary {
  monthYear: string; // e.g., "May 2025"
  transactionCount: number;
  totalAmountByCurrency: Record<string, number>; // e.g., { "BRL": -100, "USD": -50 }
}

const MonthlySummarySidebar: FC<MonthlySummarySidebarProps> = ({
  transactions,
  accounts,
  preferredCurrency,
  transactionType,
  isLoading,
}) => {
  const monthlySummaries = useMemo(() => {
    if (!transactions || transactions.length === 0 || accounts.length === 0) {
      return [];
    }

    const summaries: Record<string, MonthlySummary> = {};

    transactions.forEach(tx => {
      const txDate = parseISO(tx.date.includes('T') ? tx.date : tx.date + 'T00:00:00Z');
      const monthYearKey = format(txDate, 'yyyy-MM'); // Key for grouping: "2025-05"
      const displayMonthYear = format(txDate, 'MMMM yyyy'); // For display: "May 2025"

      if (!summaries[monthYearKey]) {
        summaries[monthYearKey] = {
          monthYear: displayMonthYear,
          transactionCount: 0,
          totalAmountByCurrency: {},
        };
      }

      summaries[monthYearKey].transactionCount++;
      const account = accounts.find(acc => acc.id === tx.accountId);
      if (account) {
        const currency = account.currency;
        summaries[monthYearKey].totalAmountByCurrency[currency] =
          (summaries[monthYearKey].totalAmountByCurrency[currency] || 0) + tx.amount;
      }
    });

    return Object.values(summaries).sort((a, b) => {
      // Sort by date, newest first
      const dateA = parseISO(Object.keys(summaries).find(key => summaries[key].monthYear === a.monthYear)! + '-01');
      const dateB = parseISO(Object.keys(summaries).find(key => summaries[key].monthYear === b.monthYear)! + '-01');
      return dateB.getTime() - dateA.getTime();
    });
  }, [transactions, accounts]);

  const getSummaryLabel = () => {
    switch (transactionType) {
      case 'expense': return 'Spent';
      case 'income': return 'Received';
      case 'transfer': return 'Moved';
      case 'all': return 'Net';
      default: return 'Amount';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-1/4" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (monthlySummaries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Monthly Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No transactions to summarize for this period.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Summary</CardTitle>
        <CardDescription>Breakdown by month.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-h-[600px] overflow-y-auto">
        {monthlySummaries.map(summary => (
          <div key={summary.monthYear} className="border-b pb-3 last:border-b-0 last:pb-0">
            <h4 className="text-md font-semibold mb-1">{summary.monthYear}</h4>
            <div className="text-sm text-muted-foreground">
              Transactions: {summary.transactionCount}
            </div>
            {Object.entries(summary.totalAmountByCurrency).map(([currency, amount]) => {
              // For "all" or "transfer", show net. For specific types, filter.
              let displayAmount = amount;
              if (transactionType === 'expense' && amount > 0) return null; // Don't show income in expense summary
              if (transactionType === 'income' && amount < 0) return null;  // Don't show expense in income summary
              
              // For transfers, we typically show absolute amount moved.
              if (transactionType === 'transfer') displayAmount = Math.abs(amount);

              return (
                <div key={currency} className="text-sm">
                  {getSummaryLabel()}:{' '}
                  <span className={`font-medium ${
                    displayAmount < 0 ? 'text-red-500 dark:text-red-400' : (displayAmount > 0 ? 'text-green-500 dark:text-green-400' : '')
                  }`}>
                    {formatCurrency(displayAmount, currency, undefined, false)}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default MonthlySummarySidebar;

