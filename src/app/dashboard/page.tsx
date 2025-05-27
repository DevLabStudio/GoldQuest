
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, TrendingUp, TrendingDown, Wallet, Landmark, Scale, PiggyBank } from "lucide-react";
import KpiCard from "@/components/dashboard/kpi-card";
import NetWorthCompositionChart, { type NetWorthChartDataPoint } from "@/components/dashboard/net-worth-composition-chart";
import { getUserPreferences } from '@/lib/preferences';
import { formatCurrency, convertCurrency } from '@/lib/currency';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { getAccounts, type Account } from "@/services/account-sync";
import { getTransactions, type Transaction } from "@/services/transactions";
import { getCategories, type Category } from '@/services/categories';
import { format as formatDateFns, isWithinInterval, parseISO, isSameDay } from 'date-fns'; 
import { useToast } from "@/hooks/use-toast";
import { useDateRange } from '@/contexts/DateRangeContext'; 
import { useAuthContext } from '@/contexts/AuthContext';


export default function DashboardPage() {
  const { user, isLoadingAuth } = useAuthContext();
  const [preferredCurrency, setPreferredCurrency] = useState('BRL'); 
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const { toast } = useToast();

  const { selectedDateRange } = useDateRange(); 
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<string>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');


  const fetchData = useCallback(async () => {
      if (!user || isLoadingAuth || typeof window === 'undefined') {
        setIsLoading(false);
        if (!user && !isLoadingAuth) {
            toast({ title: "Authentication Error", description: "Please log in to view dashboard data.", variant: "destructive" });
        }
        return;
      }
      setIsLoading(true);
      try {
        const prefs = await getUserPreferences(); 
        setPreferredCurrency(prefs.preferredCurrency);

        const [fetchedAccounts, fetchedCategoriesList] = await Promise.all([
          getAccounts(),
          getCategories(),
        ]);
        setAccounts(fetchedAccounts);
        setCategories(fetchedCategoriesList);

        if (fetchedAccounts.length > 0) {
          const transactionPromises = fetchedAccounts.map(acc => getTransactions(acc.id));
          const transactionsByAccount = await Promise.all(transactionPromises);
          const combinedTransactions = transactionsByAccount.flat();
          setAllTransactions(combinedTransactions);
        } else {
          setAllTransactions([]);
        }

        setLastUpdated(new Date());
      } catch (error: any) {
        console.error("Failed to fetch dashboard data:", error);
        toast({ title: "Error", description: "Failed to load dashboard data. " + error.message, variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    }, [toast, user, isLoadingAuth]);

  useEffect(() => {
    if (user && !isLoadingAuth) {
        fetchData();
    } else if (!isLoadingAuth && !user) {
        setIsLoading(false);
        setAccounts([]);
        setAllTransactions([]);
        setCategories([]);
    }

    const handleStorageChange = (event: StorageEvent) => {
      if (event.type === 'storage' && user && !isLoadingAuth) {
            const isLikelyOurCustomEvent = event.key === null;
            const relevantKeysForThisPage = ['userAccounts', 'userPreferences', 'userCategories', 'userTags', 'transactions-']; 
            const isRelevantExternalChange = typeof event.key === 'string' && relevantKeysForThisPage.some(k => event.key!.includes(k));

            if (isLikelyOurCustomEvent || isRelevantExternalChange) {
                fetchData();
            }
        }
    };

    if (typeof window !== 'undefined') window.addEventListener('storage', handleStorageChange);
    return () => {
      if (typeof window !== 'undefined') window.removeEventListener('storage', handleStorageChange);
    };
  }, [fetchData, user, isLoadingAuth]); 

  const handleRefresh = async () => {
     await fetchData();
  };

  const formatLastUpdated = (date: Date | null) => {
    if (!date) return "Updating...";
    const now = new Date();
    const diffSeconds = Math.round((now.getTime() - date.getTime()) / 1000);
    if (diffSeconds < 60) return `Updated ${diffSeconds}s ago`;
    const diffMinutes = Math.round(diffSeconds / 60);
    if (diffMinutes === 1) return "Updated 1 min ago";
    return `Updated ${diffMinutes} mins ago`;
  };

  const totalNetWorth = useMemo(() => {
    if (isLoading || typeof window === 'undefined') return 0;
    return accounts.reduce((sum, account) => {
      if (account.includeInNetWorth !== false && account.balances && account.primaryCurrency) {
        const primaryBalanceEntry = account.balances.find(b => b.currency === account.primaryCurrency);
        if (primaryBalanceEntry) {
          sum += convertCurrency(primaryBalanceEntry.amount, primaryBalanceEntry.currency, preferredCurrency);
        }
      }
      return sum;
    }, 0);
  }, [accounts, preferredCurrency, isLoading]);

  const selectedPeriodTransactions = useMemo(() => {
    if (isLoading) return [];
    return allTransactions.filter(tx => {
      const txDate = parseISO(tx.date.includes('T') ? tx.date : tx.date + 'T00:00:00Z');
      const isInDateRange = selectedDateRange.from && selectedDateRange.to ? 
                            isWithinInterval(txDate, { start: selectedDateRange.from, end: selectedDateRange.to }) : 
                            true; 
      
      const matchesAccountFilter = selectedAccountFilter === 'all' || tx.accountId === selectedAccountFilter;
      const matchesCategoryFilter = selectedCategoryFilter === 'all' || tx.category === selectedCategoryFilter;

      return isInDateRange && matchesAccountFilter && matchesCategoryFilter;
    });
  }, [allTransactions, isLoading, selectedDateRange, selectedAccountFilter, selectedCategoryFilter]);

  const periodIncome = useMemo(() => {
    if (isLoading || typeof window === 'undefined') return 0;
    return selectedPeriodTransactions.reduce((sum, tx) => {
      if (tx.amount > 0 && tx.category !== 'Transfer') { 
        const account = accounts.find(acc => acc.id === tx.accountId);
        if (account && account.includeInNetWorth !== false) {
          sum += convertCurrency(tx.amount, tx.transactionCurrency, preferredCurrency);
        }
      }
      return sum;
    }, 0);
  }, [selectedPeriodTransactions, accounts, preferredCurrency, isLoading]);

  const periodExpenses = useMemo(() => {
    if (isLoading || typeof window === 'undefined') return 0;
    return selectedPeriodTransactions.reduce((sum, tx) => {
      if (tx.amount < 0 && tx.category !== 'Transfer') { 
        const account = accounts.find(acc => acc.id === tx.accountId);
        if (account && account.includeInNetWorth !== false) {
          sum += convertCurrency(Math.abs(tx.amount), tx.transactionCurrency, preferredCurrency);
        }
      }
      return sum;
    }, 0);
  }, [selectedPeriodTransactions, accounts, preferredCurrency, isLoading]);

  const totalAssetsValue = useMemo(() => {
    if (isLoading || typeof window === 'undefined') return 0;
    return accounts.reduce((sum, account) => {
      if (account.includeInNetWorth !== false && account.balances && account.primaryCurrency) {
        const primaryBalanceEntry = account.balances.find(b => b.currency === account.primaryCurrency);
        if (primaryBalanceEntry && primaryBalanceEntry.amount >= 0) { 
          sum += convertCurrency(primaryBalanceEntry.amount, primaryBalanceEntry.currency, preferredCurrency);
        }
      }
      return sum;
    }, 0);
  }, [accounts, preferredCurrency, isLoading]);

  const totalLiabilitiesValue = useMemo(() => {
    if (isLoading || typeof window === 'undefined') return 0;
    return accounts.reduce((sum, account) => {
      if (account.includeInNetWorth !== false && account.balances && account.primaryCurrency) {
        const primaryBalanceEntry = account.balances.find(b => b.currency === account.primaryCurrency);
         if (primaryBalanceEntry && primaryBalanceEntry.amount < 0) { 
          sum += convertCurrency(Math.abs(primaryBalanceEntry.amount), primaryBalanceEntry.currency, preferredCurrency);
        }
      }
      return sum;
    }, 0);
  }, [accounts, preferredCurrency, isLoading]);

  const savingsRate = useMemo(() => {
    if (periodIncome === 0) return 0;
    const netSavings = periodIncome - periodExpenses;
    return netSavings / periodIncome;
  }, [periodIncome, periodExpenses]);

  const netWorthCompositionData = useMemo((): NetWorthChartDataPoint[] => {
    if (isLoading || typeof window === 'undefined') return [];
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


  if (isLoadingAuth || (isLoading && typeof window !== 'undefined' && accounts.length === 0 && allTransactions.length === 0)) {
    return (
      <div className="space-y-4"> 
        <Card>
          <CardHeader><Skeleton className="h-8 w-1/2" /></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }


  return (
    <TooltipProvider>
      <div className="space-y-4"> 
         <div className="flex justify-between items-center"> 
            <h1 className="text-3xl font-bold">Dashboard</h1>
         </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
              <div>
                <CardTitle className="text-xl">Financial Summary</CardTitle>
                <CardDescription>
                  Overview for {dateRangeLabel}. Last updated: {formatLastUpdated(lastUpdated)}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 mt-2 sm:mt-0">
                <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh Data
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="account-filter" className="text-xs font-medium text-muted-foreground">Account Filter</label>
              <Select defaultValue={selectedAccountFilter} onValueChange={setSelectedAccountFilter} disabled={accounts.length === 0}>
                <SelectTrigger id="account-filter">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts</SelectItem>
                  {accounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="category-filter" className="text-xs font-medium text-muted-foreground">Category Filter</label>
              <Select defaultValue={selectedCategoryFilter} onValueChange={setSelectedCategoryFilter} disabled={categories.length === 0}>
                <SelectTrigger id="category-filter">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                   {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <KpiCard
            title="Net Worth"
            value={totalNetWorth}
            currency={preferredCurrency}
            tooltip="Your total assets minus liabilities."
            icon={<Wallet className="text-primary" />}
          />
          <KpiCard
            title={`Income (${dateRangeLabel})`}
            value={periodIncome}
            currency={preferredCurrency}
            tooltip={`Total income received in the selected period.`}
            icon={<TrendingUp className="text-green-500" />} 
            valueClassName="text-green-600 dark:text-green-500" 
            href="/revenue"
          />
          <KpiCard
            title={`Expenses (${dateRangeLabel})`}
            value={periodExpenses}
            currency={preferredCurrency}
            tooltip={`Total expenses in the selected period.`}
            icon={<TrendingDown className="text-red-500" />} 
            valueClassName="text-red-600 dark:text-red-500" 
            href="/expenses"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
           <KpiCard
            title="Total Assets"
            value={totalAssetsValue}
            currency={preferredCurrency}
            tooltip="Sum of all your assets."
            icon={<Landmark className="text-primary" />}
          />
          <KpiCard
            title="Total Liabilities"
            value={totalLiabilitiesValue}
            currency={preferredCurrency}
            tooltip="Sum of all your debts and obligations."
            icon={<Scale className="text-primary" />}
          />
          <KpiCard
            title={`Savings Rate (${dateRangeLabel})`}
            value={savingsRate * 100} 
            isPercentage={true}
            tooltip="Percentage of your income you are saving in the selected period."
            icon={<PiggyBank className="text-primary" />}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Portfolio Composition ({preferredCurrency})</CardTitle>
              <CardDescription>Distribution of your assets.</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] sm:h-[350px]">
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
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  No portfolio data to display. Add accounts with balances to see your composition.
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Cash Flow ({dateRangeLabel})</CardTitle>
              <CardDescription>Compare income and expenses over the selected period.</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] sm:h-[350px] flex items-center justify-center">
               {isLoading && accounts.length === 0 ? (
                  <Skeleton className="h-full w-full" />
               ) : (
                 <p className="text-muted-foreground">Cash flow chart for selected period in development.</p>
               )}
            </CardContent>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  );
}

    