
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import TotalBalanceCard from "@/components/dashboard/TotalBalanceCard";
import RecentTransactionsCard from "@/components/dashboard/RecentTransactionsCard";
import BudgetManagementCard from "@/components/dashboard/BudgetManagementCard";
import WeeklyComparisonStatsCard from "@/components/dashboard/WeeklyComparisonStatsCard";
import ExpensesBreakdownCard from "@/components/dashboard/ExpensesBreakdownCard";
import NetWorthCompositionChart, { type NetWorthChartDataPoint } from "@/components/dashboard/net-worth-composition-chart";
import UpcomingBillsCard from '@/components/dashboard/UpcomingBillsCard';
import SubscriptionsBarChart from '@/components/dashboard/subscriptions-bar-chart'; // Changed from PieChart to BarChart

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
  
  const recentTransactionsForDisplay = useMemo(() => {
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
      .slice(0, 5); 
  }, [periodTransactions, categories, preferredCurrency, isLoading]);

  const netWorthCompositionData = useMemo((): NetWorthChartDataPoint[] => {
    if (isLoading || typeof window === 'undefined' || !accounts.length) return [];
    
    const assetCategoryTotal = accounts
      .filter(acc => acc.category === 'asset' && acc.includeInNetWorth !== false && acc.balances && acc.primaryCurrency)
      .reduce((sum, acc) => {
        const primaryBalance = acc.balances.find(b => b.currency === acc.primaryCurrency);
        if (primaryBalance && primaryBalance.amount > 0) { 
          sum += convertCurrency(primaryBalance.amount, acc.primaryCurrency!, preferredCurrency);
        }
        return sum;
      }, 0);

    const cryptoCategoryTotal = accounts
      .filter(acc => acc.category === 'crypto' && acc.includeInNetWorth !== false && acc.balances && acc.primaryCurrency)
      .reduce((sum, acc) => {
         const primaryBalance = acc.balances.find(b => b.currency === acc.primaryCurrency);
        if (primaryBalance && primaryBalance.amount > 0) { 
          sum += convertCurrency(primaryBalance.amount, acc.primaryCurrency!, preferredCurrency);
        }
        return sum;
      }, 0);

    const data: NetWorthChartDataPoint[] = [];
    if (assetCategoryTotal > 0) {
      data.push({ name: 'Traditional Assets', value: assetCategoryTotal, fill: 'hsl(var(--chart-1))' });
    }
    if (cryptoCategoryTotal > 0) {
      data.push({ name: 'Crypto Assets', value: cryptoCategoryTotal, fill: 'hsl(var(--chart-2))' });
    }
        
    return data;
  }, [accounts, preferredCurrency, isLoading]);

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
                    transactions={recentTransactionsForDisplay} 
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
                <BudgetManagementCard preferredCurrency={preferredCurrency} isLoading={isLoading} />
                <Card>
                    <CardHeader className="py-3 px-4">
                        <CardTitle className="text-base">Portfolio Composition</CardTitle>
                        <CardDescription className="text-xs">Distribution of your positive assets.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[280px] sm:h-[300px] pt-0 pb-3 px-4">
                        {isLoading || accounts.length === 0 ? (
                            <div className="flex h-full items-center justify-center">
                                <Skeleton className="h-full w-full" />
                            </div>
                        ) : netWorthCompositionData.length > 0 ? (
                            <NetWorthCompositionChart
                            data={netWorthCompositionData}
                            currency={preferredCurrency}
                            />
                        ) : (
                            <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                                No portfolio data to display.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    </div>
  );
}

