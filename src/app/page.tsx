
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import TotalBalanceCard from "@/components/dashboard/TotalBalanceCard";
import RecentTransactionsCard from "@/components/dashboard/RecentTransactionsCard";
import InvestmentsOverviewCard from "@/components/dashboard/InvestmentsOverviewCard";
import WeeklyComparisonStatsCard from "@/components/dashboard/WeeklyComparisonStatsCard";
import ExpensesBreakdownCard from "@/components/dashboard/ExpensesBreakdownCard";
import UpcomingBillsCard from '@/components/dashboard/UpcomingBillsCard';

import { getAccounts, type Account } from "@/services/account-sync";
import { getTransactions, type Transaction } from "@/services/transactions";
import { getCategories, type Category } from '@/services/categories';
import { getSubscriptions, type Subscription } from '@/services/subscriptions';
import { getUserPreferences } from '@/lib/preferences';
import { formatCurrency, convertCurrency, getCurrencySymbol } from '@/lib/currency';
import { startOfMonth, endOfMonth, isWithinInterval, parseISO, format as formatDateFns, isSameDay, subDays, differenceInCalendarDays, addDays } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from "@/hooks/use-toast";
import { useDateRange } from '@/contexts/DateRangeContext';
import type { DateRange } from 'react-day-picker';
import { useAuthContext } from '@/contexts/AuthContext';

// Helper function to get the previous equivalent period
const getPreviousPeriod = (currentRange: DateRange): DateRange | null => {
  if (!currentRange.from || !currentRange.to) {
    // For "All Time" or undefined ranges, we can't define a simple equivalent previous period.
    // Or, we could default to "previous month" relative to today if that makes sense.
    // For now, return null to indicate trend is N/A for such cases.
    return null;
  }

  const duration = differenceInCalendarDays(currentRange.to, currentRange.from);
  const previousPeriodTo = subDays(currentRange.from, 1);
  const previousPeriodFrom = subDays(previousPeriodTo, duration);

  return { from: previousPeriodFrom, to: previousPeriodTo };
};


export default function DashboardPage() {
  const { user, isLoadingAuth, userPreferences } = useAuthContext();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const preferredCurrency = useMemo(() => userPreferences?.preferredCurrency || 'BRL', [userPreferences]);
  const { toast } = useToast();
  const { selectedDateRange } = useDateRange();

  const fetchData = useCallback(async () => {
    if (!user || isLoadingAuth || typeof window === 'undefined') {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [fetchedAccounts, fetchedCategories, fetchedSubscriptions] = await Promise.all([
        getAccounts(),
        getCategories(),
        getSubscriptions(),
      ]);
      setAccounts(fetchedAccounts);
      setCategories(fetchedCategories);
      setSubscriptions(fetchedSubscriptions);
      
      if (fetchedAccounts.length > 0) {
        const transactionPromises = fetchedAccounts.map(acc => getTransactions(acc.id));
        const transactionsByAccount = await Promise.all(transactionPromises);
        const combinedTransactions = transactionsByAccount.flat();
        setAllTransactions(combinedTransactions.sort((a,b) => parseISO(b.date).getTime() - parseISO(a.date).getTime()));
      } else {
        setAllTransactions([]);
      }
    } catch (error: any) {
      console.error("Failed to fetch dashboard data:", error);
      toast({ title: "Error", description: "Failed to load dashboard data. " + error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast, user, isLoadingAuth]);


  useEffect(() => {
    if (user && !isLoadingAuth && userPreferences) { 
        fetchData();
    } else if (!isLoadingAuth && !user) {
        setIsLoading(false);
        setAccounts([]);
        setAllTransactions([]);
        setCategories([]);
        setSubscriptions([]);
    }

    const handleStorageChange = (event: StorageEvent) => {
        if (typeof window !== 'undefined' && event.type === 'storage' && user && !isLoadingAuth && userPreferences) {
            const isLikelyOurCustomEvent = event.key === null;
            const relevantKeysForThisPage = ['userAccounts', 'userPreferences', 'userCategories', 'userTags', 'transactions-', 'userSubscriptions'];
            const isRelevantExternalChange = typeof event.key === 'string' && relevantKeysForThisPage.some(k => event.key && event.key.includes(k));

            if (isLikelyOurCustomEvent || isRelevantExternalChange) {
                fetchData();
            }
        }
    };

    if (typeof window !== 'undefined') {
        window.addEventListener('storage', handleStorageChange);
    }
    return () => {
        if (typeof window !== 'undefined') {
            window.removeEventListener('storage', handleStorageChange);
        }
    };
  }, [fetchData, user, isLoadingAuth, userPreferences]);

  const periodTransactions = useMemo(() => {
    if (isLoading || !user) return [];
    return allTransactions.filter(tx => {
      const txDate = parseISO(tx.date.includes('T') ? tx.date : tx.date + 'T00:00:00Z');
      if (!selectedDateRange.from || !selectedDateRange.to) return true; 
      return isWithinInterval(txDate, { start: selectedDateRange.from, end: selectedDateRange.to });
    });
  }, [allTransactions, isLoading, selectedDateRange, user]);
  

  const expensesBreakdownData = useMemo(() => {
    if (isLoading || !periodTransactions.length || !categories.length) return [];

    const categoryTotalsCurrentPeriod: { [key: string]: number } = {};
    periodTransactions.forEach(tx => {
      if (tx.amount < 0 && tx.category !== 'Transfer') {
        const categoryName = categories.find(c => c.name === tx.category)?.name || 'Others';
        categoryTotalsCurrentPeriod[categoryName] = (categoryTotalsCurrentPeriod[categoryName] || 0) + Math.abs(convertCurrency(tx.amount, tx.transactionCurrency, preferredCurrency));
      }
    });

    const previousPeriodDateRange = getPreviousPeriod(selectedDateRange);
    let categoryTotalsPreviousPeriod: { [key: string]: number } = {};

    if (previousPeriodDateRange && previousPeriodDateRange.from && previousPeriodDateRange.to) {
      const previousPeriodTxs = allTransactions.filter(tx => {
        const txDate = parseISO(tx.date.includes('T') ? tx.date : tx.date + 'T00:00:00Z');
        return isWithinInterval(txDate, { start: previousPeriodDateRange.from!, end: previousPeriodDateRange.to! });
      });

      previousPeriodTxs.forEach(tx => {
        if (tx.amount < 0 && tx.category !== 'Transfer') {
          const categoryName = categories.find(c => c.name === tx.category)?.name || 'Others';
          categoryTotalsPreviousPeriod[categoryName] = (categoryTotalsPreviousPeriod[categoryName] || 0) + Math.abs(convertCurrency(tx.amount, tx.transactionCurrency, preferredCurrency));
        }
      });
    }

    return Object.entries(categoryTotalsCurrentPeriod)
      .map(([categoryName, currentAmount]) => {
        const previousAmount = categoryTotalsPreviousPeriod[categoryName] || 0;
        let trendPercentage: number | undefined = undefined;
        let trendDirection: 'up' | 'down' | 'neutral' = 'neutral';

        if (previousPeriodDateRange) { // Only calculate trend if there's a previous period
          if (previousAmount > 0) {
            trendPercentage = ((currentAmount - previousAmount) / previousAmount) * 100;
            if (trendPercentage > 1) trendDirection = 'up'; // Spending increased
            else if (trendPercentage < -1) trendDirection = 'down'; // Spending decreased
          } else if (currentAmount > 0) {
            trendPercentage = 100; // Went from 0 to some spending
            trendDirection = 'up';
          } else {
            trendPercentage = 0; // Both 0
            trendDirection = 'neutral';
          }
        }

        return {
          name: categoryName,
          amount: currentAmount,
          categoryDetails: categories.find(c => c.name === categoryName),
          trendPercentage: trendPercentage,
          trendDirection: trendDirection,
        };
      })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [periodTransactions, allTransactions, categories, preferredCurrency, isLoading, selectedDateRange]);


  const dateRangeLabel = useMemo(() => {
    if (selectedDateRange.from && selectedDateRange.to) {
        if (isSameDay(selectedDateRange.from, selectedDateRange.to)) {
            return formatDateFns(selectedDateRange.from, 'MMM d, yyyy');
        }
        return `${formatDateFns(selectedDateRange.from, 'MMM d')} - ${formatDateFns(selectedDateRange.to, 'MMM d, yyyy')}`;
    }
    return 'All Time';
  }, [selectedDateRange]);


  if (isLoadingAuth || (!userPreferences && user)) { 
    return (
      <div className="container mx-auto py-4 px-4 md:px-6 lg:px-8 min-h-screen">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-60 w-full" />
                <Skeleton className="h-80 w-full" />
                <Skeleton className="h-72 w-full" />
            </div>
            <div className="lg:col-span-1 space-y-4">
                <Skeleton className="h-[376px] w-full" />
                <Skeleton className="h-72 w-full" />
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-4 px-4 md:px-6 lg:px-8 min-h-screen">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left Column */}
            <div className="lg:col-span-2 space-y-4">
                <TotalBalanceCard accounts={accounts} preferredCurrency={preferredCurrency} isLoading={isLoading} />
                <WeeklyComparisonStatsCard preferredCurrency={preferredCurrency} periodTransactions={periodTransactions} isLoading={isLoading} />
                <RecentTransactionsCard 
                    transactions={periodTransactions} 
                    categories={categories}
                    accounts={accounts}
                    preferredCurrency={preferredCurrency} 
                    isLoading={isLoading}
                />
                <ExpensesBreakdownCard 
                    data={expensesBreakdownData} 
                    currency={preferredCurrency} 
                    isLoading={isLoading}
                />
            </div>

            {/* Right Column */}
            <div className="lg:col-span-1 space-y-4">
                <UpcomingBillsCard 
                    subscriptions={subscriptions} 
                    preferredCurrency={preferredCurrency} 
                    isLoading={isLoading}
                    accounts={accounts}
                />
                <InvestmentsOverviewCard 
                    accounts={accounts} 
                    preferredCurrency={preferredCurrency} 
                    isLoading={isLoading} 
                />
            </div>
        </div>
    </div>
  );
}
