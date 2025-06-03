
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import TotalBalanceCard from "@/components/dashboard/TotalBalanceCard"; // Renamed for clarity
import RecentTransactionsCard from "@/components/dashboard/RecentTransactionsCard";
import UpcomingBillsCard from "@/components/dashboard/UpcomingBillsCard";
import GoalsCard from "@/components/dashboard/GoalsCard"; // Placeholder for now
import WeeklyComparisonStatsCard from "@/components/dashboard/WeeklyComparisonStatsCard"; // Placeholder for now
import ExpensesBreakdownCard from "@/components/dashboard/ExpensesBreakdownCard";

import { getAccounts, type Account } from "@/services/account-sync";
import { getTransactions, type Transaction } from "@/services/transactions";
import { getCategories, type Category } from '@/services/categories';
import { getSubscriptions, type Subscription } from '@/services/subscriptions';
import { getUserPreferences } from '@/lib/preferences';
import { formatCurrency, convertCurrency, getCurrencySymbol } from '@/lib/currency';
import { startOfMonth, endOfMonth, isWithinInterval, parseISO, format as formatDateFns, isSameDay, subDays } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from "@/hooks/use-toast";
import { useDateRange } from '@/contexts/DateRangeContext';
import { useAuthContext } from '@/contexts/AuthContext';

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
      // Preferences already available via useAuthContext -> userPreferences
      const fetchedAccounts = await getAccounts();
      setAccounts(fetchedAccounts);

      const fetchedCategories = await getCategories();
      setCategories(fetchedCategories);
      
      const fetchedSubscriptions = await getSubscriptions();
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
    if (user && !isLoadingAuth && userPreferences) { // Ensure preferences are loaded too
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
      if (!selectedDateRange.from || !selectedDateRange.to) return true; // All time if no range selected
      return isWithinInterval(txDate, { start: selectedDateRange.from, end: selectedDateRange.to });
    });
  }, [allTransactions, isLoading, selectedDateRange, user]);
  
  const recentTransactionsForDisplay = useMemo(() => {
    // Show last 5 transactions regardless of date range, or filtered by date range if a specific range is active
    const source = (selectedDateRange.from || selectedDateRange.to) ? periodTransactions : allTransactions;
    return source.slice(0, 5);
  }, [periodTransactions, allTransactions, selectedDateRange]);


  const expensesBreakdownData = useMemo(() => {
    if (isLoading || !periodTransactions.length || !categories.length) return [];
    const categoryTotals: { [key: string]: number } = {};
    periodTransactions.forEach(tx => {
      if (tx.amount < 0 && tx.category !== 'Transfer') {
        const categoryName = categories.find(c => c.name === tx.category)?.name || 'Others';
        categoryTotals[categoryName] = (categoryTotals[categoryName] || 0) + Math.abs(convertCurrency(tx.amount, tx.transactionCurrency, preferredCurrency));
      }
    });
    return Object.entries(categoryTotals)
      .map(([category, amount]) => ({ name: category, amount, categoryDetails: categories.find(c=>c.name === category) }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5); // Show top 5, plus an "Others" if more
  }, [periodTransactions, categories, preferredCurrency, isLoading]);


  if (isLoadingAuth || (!userPreferences && user)) { // Check for userPreferences too
    return (
      <div className="container mx-auto py-4 px-4 md:px-6 lg:px-8 min-h-screen">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <div className="lg:col-span-2 space-y-4">
                <Skeleton className="h-40 w-full" /> {/* Total Balance Placeholder */}
            </div>
            <div className="space-y-4">
                <Skeleton className="h-60 w-full" /> {/* Goals Placeholder */}
                <Skeleton className="h-64 w-full" /> {/* Upcoming Bills Placeholder */}
            </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
             <div className="lg:col-span-2">
                 <Skeleton className="h-80 w-full" /> {/* Recent Transactions Placeholder */}
             </div>
             <div>
                 <Skeleton className="h-72 w-full" /> {/* Statistics Placeholder */}
             </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Skeleton className="h-72 w-full" /> {/* Expenses Breakdown Placeholder */}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-4 px-4 md:px-6 lg:px-8 min-h-screen">
        {/* Top Row: Total Balance (2/3 width), Goals (1/3 width), Upcoming Bills (1/3 width on smaller screens, moves below Goals) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4"> {/* Added mb-4 */}
            {/* Total Balance Card - Takes 2/3 width on large screens */}
            <div className="lg:col-span-2">
                <TotalBalanceCard accounts={accounts} preferredCurrency={preferredCurrency} isLoading={isLoading} />
            </div>

            {/* Right Column for Goals and Upcoming Bills */}
            <div className="space-y-4">
                <GoalsCard preferredCurrency={preferredCurrency} isLoading={isLoading} />
                <UpcomingBillsCard subscriptions={subscriptions} preferredCurrency={preferredCurrency} isLoading={isLoading || isLoadingAuth} accounts={accounts}/>
            </div>
        </div>

        {/* Second Row: Recent Transactions (2/3 width), Statistics (1/3 width) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4"> {/* Added mb-4 */}
            <div className="lg:col-span-2">
                <RecentTransactionsCard 
                    transactions={recentTransactionsForDisplay} 
                    categories={categories}
                    accounts={accounts}
                    preferredCurrency={preferredCurrency} 
                    isLoading={isLoading}
                />
            </div>
            <div>
                <WeeklyComparisonStatsCard preferredCurrency={preferredCurrency} periodTransactions={periodTransactions} isLoading={isLoading} />
            </div>
        </div>

        {/* Third Row: Expenses Breakdown (Full Width or as desired) */}
        <ExpensesBreakdownCard 
            data={expensesBreakdownData} 
            currency={preferredCurrency} 
            isLoading={isLoading}
        />
    </div>
  );
}
