
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { RefreshCw, TrendingUp, TrendingDown, Wallet, Landmark, Scale, PiggyBank, PlusCircle, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight as TransferIcon, ChevronDown } from "lucide-react";
import KpiCard from "@/components/dashboard/kpi-card";
import NetWorthCompositionChart, { type NetWorthChartDataPoint } from "@/components/dashboard/net-worth-composition-chart";
import { getUserPreferences } from '@/lib/preferences';
import { formatCurrency, convertCurrency } from '@/lib/currency';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { getAccounts, type Account } from "@/services/account-sync";
import { getTransactions, addTransaction, type Transaction } from "@/services/transactions";
import { getCategories, type Category } from '@/services/categories';
import { getTags, type Tag } from '@/services/tags';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
// import type { DateRange } from 'react-day-picker'; // No longer needed here
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"; // DialogTrigger removed as button is global
import AddTransactionForm from '@/components/transactions/add-transaction-form';
import type { AddTransactionFormData } from '@/components/transactions/add-transaction-form';
import { useToast } from "@/hooks/use-toast";
import { useDateRange } from '@/contexts/DateRangeContext'; // Import context hook


export default function DashboardPage() {
  const [preferredCurrency, setPreferredCurrency] = useState('BRL');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const { toast } = useToast();

  const [isAddTransactionDialogOpen, setIsAddTransactionDialogOpen] = useState(false);
  const [transactionTypeToAdd, setTransactionTypeToAdd] = useState<'expense' | 'income' | 'transfer' | null>(null);

  const { selectedDateRange, setSelectedDateRange: setGlobalDateRange } = useDateRange(); // Use global date range
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<string>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');


  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      if (typeof window === 'undefined') {
        if(isMounted) setIsLoading(false);
        return;
      }
      if(isMounted) setIsLoading(true);
      try {
        const prefs = getUserPreferences();
        if(isMounted) setPreferredCurrency(prefs.preferredCurrency);

        const [fetchedAccounts, fetchedCategories, fetchedTagsList] = await Promise.all([
          getAccounts(),
          getCategories(),
          getTags()
        ]);
        if(isMounted) setAccounts(fetchedAccounts);
        if(isMounted) setCategories(fetchedCategories);
        if(isMounted) setTags(fetchedTagsList);

        if (fetchedAccounts.length > 0) {
          const transactionPromises = fetchedAccounts.map(acc => getTransactions(acc.id));
          const transactionsByAccount = await Promise.all(transactionPromises);
          const combinedTransactions = transactionsByAccount.flat();
          if(isMounted) setAllTransactions(combinedTransactions);
        } else {
          if(isMounted) setAllTransactions([]);
        }

        if(isMounted) setLastUpdated(new Date());
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
        if(isMounted) toast({ title: "Error", description: "Failed to load dashboard data.", variant: "destructive" });
      } finally {
        if(isMounted) setIsLoading(false);
      }
    };

    fetchData();

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'userAccounts' || event.key === 'userPreferences' || event.key === 'userCategories' || event.key === 'userTags' || event.key?.startsWith('transactions-')) {
          console.log("Storage changed in dashboard, refetching data...");
          if (isMounted) {
              fetchData();
          }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageChange);
    }

    return () => {
      isMounted = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', handleStorageChange);
      }
    };
  }, [toast]); 

  const handleRefresh = async () => {
     setIsLoading(true);
     try {
       const prefs = getUserPreferences();
       setPreferredCurrency(prefs.preferredCurrency);

       const [fetchedAccounts, fetchedCategories, fetchedTagsList] = await Promise.all([
         getAccounts(),
         getCategories(),
         getTags()
       ]);
       setAccounts(fetchedAccounts);
       setCategories(fetchedCategories);
       setTags(fetchedTagsList);

       if (fetchedAccounts.length > 0) {
         const transactionPromises = fetchedAccounts.map(acc => getTransactions(acc.id));
         const transactionsByAccount = await Promise.all(transactionPromises);
         const combinedTransactions = transactionsByAccount.flat();
         setAllTransactions(combinedTransactions);
       } else {
         setAllTransactions([]);
       }
       setLastUpdated(new Date());
     } catch (error) {
       console.error("Failed to fetch dashboard data:", error);
       toast({ title: "Error", description: "Failed to load dashboard data.", variant: "destructive" });
     } finally {
       setIsLoading(false);
     }
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
      return sum + convertCurrency(account.balance, account.currency, preferredCurrency);
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
      if (tx.amount > 0) {
        const account = accounts.find(acc => acc.id === tx.accountId);
        if (account) {
          return sum + convertCurrency(tx.amount, account.currency, preferredCurrency);
        }
      }
      return sum;
    }, 0);
  }, [selectedPeriodTransactions, accounts, preferredCurrency, isLoading]);

  const periodExpenses = useMemo(() => {
    if (isLoading || typeof window === 'undefined') return 0;
    return selectedPeriodTransactions.reduce((sum, tx) => {
      if (tx.amount < 0) {
        const account = accounts.find(acc => acc.id === tx.accountId);
        if (account) {
          return sum + convertCurrency(Math.abs(tx.amount), account.currency, preferredCurrency);
        }
      }
      return sum;
    }, 0);
  }, [selectedPeriodTransactions, accounts, preferredCurrency, isLoading]);

  const totalAssetsValue = useMemo(() => {
    if (isLoading || typeof window === 'undefined') return 0;
    return accounts.reduce((sum, account) => {
      if (account.balance >= 0) { 
        return sum + convertCurrency(account.balance, account.currency, preferredCurrency);
      }
      return sum;
    }, 0);
  }, [accounts, preferredCurrency, isLoading]);

  const totalLiabilitiesValue = useMemo(() => {
    if (isLoading || typeof window === 'undefined') return 0;
    return accounts.reduce((sum, account) => {
      if (account.balance < 0) { 
        return sum + convertCurrency(Math.abs(account.balance), account.currency, preferredCurrency);
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
      .filter(acc => acc.category === 'asset' && acc.balance > 0)
      .reduce((sum, acc) => sum + convertCurrency(acc.balance, acc.currency, preferredCurrency), 0);

    const cryptoCategoryTotal = accounts
      .filter(acc => acc.category === 'crypto' && acc.balance > 0)
      .reduce((sum, acc) => sum + convertCurrency(acc.balance, acc.currency, preferredCurrency), 0);

    const data: NetWorthChartDataPoint[] = [];
    if (assetCategoryTotal > 0) {
      data.push({ name: 'Traditional Assets', value: assetCategoryTotal, fill: 'hsl(var(--chart-1))' });
    }
    if (cryptoCategoryTotal > 0) {
      data.push({ name: 'Crypto Assets', value: cryptoCategoryTotal, fill: 'hsl(var(--chart-2))' });
    }
    return data;
  }, [accounts, preferredCurrency, isLoading]);

  // openAddTransactionDialog and related handlers are moved to GlobalHeader or kept here if page-specific "Add" is needed
  // For this refactor, assume "Add" button is global. If a page-specific one is desired, it would call similar logic.

  if (isLoading && typeof window !== 'undefined' && accounts.length === 0 && allTransactions.length === 0) {
    return (
      <div className="space-y-4"> {/* Removed container mx-auto and py/px padding */}
        {/* Skeleton for sticky header (if it were here) */}
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
      <div className="space-y-4"> {/* Removed container mx-auto and py/px padding */}
         {/* GlobalHeader handles the sticky top bar with DateRangePicker and Add button */}
         {/* Page specific title and actions (if any beyond global ones) could go here */}
         <div className="flex justify-between items-center"> {/* Removed mb-6 to rely on space-y-4 from parent */}
            <h1 className="text-3xl font-bold">Dashboard</h1>
            {/* "Add" button can be here if specific to dashboard, or rely on GlobalHeader's button */}
         </div>


        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
              <div>
                <CardTitle className="text-xl">Financial Summary</CardTitle>
                <CardDescription>
                  Overview for the selected period. Last updated: {formatLastUpdated(lastUpdated)}
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
            value={formatCurrency(totalNetWorth, preferredCurrency, undefined, false)}
            tooltip="Your total assets minus liabilities."
            icon={<Wallet className="text-primary" />}
          />
          <KpiCard
            title={`Income (${selectedDateRange.from && selectedDateRange.to ? format(selectedDateRange.from, 'MMM d') + ' - ' + format(selectedDateRange.to, 'MMM d, yyyy') : 'All Time'})`}
            value={formatCurrency(periodIncome, preferredCurrency, undefined, false)}
            tooltip={`Total income received in the selected period.`}
            icon={<TrendingUp className="text-green-500" />} 
            valueClassName="text-green-600 dark:text-green-500" 
            href="/revenue"
          />
          <KpiCard
            title={`Expenses (${selectedDateRange.from && selectedDateRange.to ? format(selectedDateRange.from, 'MMM d') + ' - ' + format(selectedDateRange.to, 'MMM d, yyyy') : 'All Time'})`}
            value={formatCurrency(periodExpenses, preferredCurrency, undefined, false)}
            tooltip={`Total expenses in the selected period.`}
            icon={<TrendingDown className="text-red-500" />} 
            valueClassName="text-red-600 dark:text-red-500" 
            href="/expenses"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
           <KpiCard
            title="Total Assets"
            value={formatCurrency(totalAssetsValue, preferredCurrency, undefined, false)}
            tooltip="Sum of all your assets."
            icon={<Landmark className="text-primary" />}
          />
          <KpiCard
            title="Total Liabilities"
            value={formatCurrency(totalLiabilitiesValue, preferredCurrency, undefined, false)}
            tooltip="Sum of all your debts and obligations."
            icon={<Scale className="text-primary" />}
          />
          <KpiCard
            title={`Savings Rate (${selectedDateRange.from && selectedDateRange.to ? format(selectedDateRange.from, 'MMM d') + ' - ' + format(selectedDateRange.to, 'MMM d, yyyy') : 'All Time'})`}
            value={`${(savingsRate * 100).toFixed(1)}%`}
            tooltip="Percentage of your income you are saving in the selected period."
            isPercentage={true}
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
              <CardTitle>Cash Flow (Selected Period)</CardTitle>
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

      {/* Dialog for adding transactions is now handled by GlobalHeader or a page-specific button if re-added */}
    </TooltipProvider>
  );
}

