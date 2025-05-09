
'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

export default function DashboardPage() {
  const [preferredCurrency, setPreferredCurrency] = useState('BRL');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);

  const fetchData = async () => {
    if (typeof window === 'undefined') {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const prefs = getUserPreferences();
      setPreferredCurrency(prefs.preferredCurrency);

      const fetchedAccounts = await getAccounts();
      setAccounts(fetchedAccounts);

      // Fetch transactions for all accounts
      const transactionPromises = fetchedAccounts.map(acc => getTransactions(acc.id));
      const transactionsByAccount = await Promise.all(transactionPromises);
      const combinedTransactions = transactionsByAccount.flat();
      setAllTransactions(combinedTransactions);

      setLastUpdated(new Date());
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
      // Handle error display to user if necessary
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = () => {
    fetchData();
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

  // --- KPI Calculations ---
  const totalNetWorth = useMemo(() => {
    if (isLoading || typeof window === 'undefined') return 0;
    return accounts.reduce((sum, account) => {
      return sum + convertCurrency(account.balance, account.currency, preferredCurrency);
    }, 0);
  }, [accounts, preferredCurrency, isLoading]);

  const currentMonthTransactions = useMemo(() => {
    if (isLoading) return [];
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    return allTransactions.filter(tx => {
      const txDate = new Date(tx.date.includes('T') ? tx.date : tx.date + 'T00:00:00Z');
      return isWithinInterval(txDate, { start: monthStart, end: monthEnd });
    });
  }, [allTransactions, isLoading]);

  const monthlyIncome = useMemo(() => {
    if (isLoading || typeof window === 'undefined') return 0;
    return currentMonthTransactions.reduce((sum, tx) => {
      if (tx.amount > 0) {
        const account = accounts.find(acc => acc.id === tx.accountId);
        if (account) {
          return sum + convertCurrency(tx.amount, account.currency, preferredCurrency);
        }
      }
      return sum;
    }, 0);
  }, [currentMonthTransactions, accounts, preferredCurrency, isLoading]);

  const monthlyExpenses = useMemo(() => {
    if (isLoading || typeof window === 'undefined') return 0;
    return currentMonthTransactions.reduce((sum, tx) => {
      if (tx.amount < 0) {
        const account = accounts.find(acc => acc.id === tx.accountId);
        if (account) {
          // Summing absolute values, display will handle sign
          return sum + convertCurrency(Math.abs(tx.amount), account.currency, preferredCurrency);
        }
      }
      return sum;
    }, 0);
  }, [currentMonthTransactions, accounts, preferredCurrency, isLoading]);

  const totalAssetsValue = useMemo(() => {
    if (isLoading || typeof window === 'undefined') return 0;
    return accounts.reduce((sum, account) => {
      if (account.balance >= 0) { // Considering accounts with positive balance as assets
        return sum + convertCurrency(account.balance, account.currency, preferredCurrency);
      }
      return sum;
    }, 0);
  }, [accounts, preferredCurrency, isLoading]);

  const totalLiabilitiesValue = useMemo(() => {
    if (isLoading || typeof window === 'undefined') return 0;
    return accounts.reduce((sum, account) => {
      if (account.balance < 0) { // Considering accounts with negative balance as liabilities
        return sum + convertCurrency(Math.abs(account.balance), account.currency, preferredCurrency);
      }
      return sum;
    }, 0);
  }, [accounts, preferredCurrency, isLoading]);

  const savingsRate = useMemo(() => {
    if (monthlyIncome === 0) return 0;
    const netSavings = monthlyIncome - monthlyExpenses;
    return netSavings / monthlyIncome;
  }, [monthlyIncome, monthlyExpenses]);

  const netWorthCompositionData = useMemo((): NetWorthChartDataPoint[] => {
    if (isLoading || typeof window === 'undefined') return [];
    const assetCategoryTotal = accounts
      .filter(acc => acc.category === 'asset' && acc.balance > 0)
      .reduce((sum, acc) => sum + convertCurrency(acc.balance, acc.currency, preferredCurrency), 0);

    const cryptoCategoryTotal = accounts
      .filter(acc => acc.category === 'crypto' && acc.balance > 0)
      .reduce((sum, acc) => sum + convertCurrency(acc.balance, acc.currency, preferredCurrency), 0);

    // Add other categories if they exist and are part of net worth
    // For now, focusing on 'asset' and 'crypto' for the chart
    
    const data: NetWorthChartDataPoint[] = [];
    if (assetCategoryTotal > 0) {
      data.push({ name: 'Traditional Assets', value: assetCategoryTotal, fill: 'hsl(var(--chart-1))' });
    }
    if (cryptoCategoryTotal > 0) {
      data.push({ name: 'Crypto Assets', value: cryptoCategoryTotal, fill: 'hsl(var(--chart-2))' });
    }
    return data;
  }, [accounts, preferredCurrency, isLoading]);


  if (isLoading && typeof window !== 'undefined') { // Added client-side check for skeleton
    return (
      <div className="container mx-auto py-6 px-4 md:px-6 lg:px-8 space-y-4">
        <Skeleton className="h-10 w-1/3 mb-4" />
        <Card>
          <CardHeader><Skeleton className="h-8 w-1/2" /></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
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
      <div className="container mx-auto py-6 px-4 md:px-6 lg:px-8 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Dashboard</h1>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
              <div>
                <CardTitle className="text-xl">Financial Summary</CardTitle>
              </div>
              <div className="flex items-center gap-2 mt-2 sm:mt-0">
                <span className="text-xs text-muted-foreground">{formatLastUpdated(lastUpdated)}</span>
                <Button variant="default" size="sm" onClick={handleRefresh} disabled={isLoading}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="date-range" className="text-xs font-medium text-muted-foreground">Period</label>
              <Select defaultValue="thisMonth">
                <SelectTrigger id="date-range">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="thisMonth">This Month</SelectItem>
                  <SelectItem value="lastMonth">Last Month</SelectItem>
                  <SelectItem value="last3months">Last 3 Months</SelectItem>
                  <SelectItem value="thisYear">This Year</SelectItem>
                  <SelectItem value="allTime">All Time</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="account-filter" className="text-xs font-medium text-muted-foreground">Account</label>
              <Select defaultValue="all">
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
              <label htmlFor="category-filter" className="text-xs font-medium text-muted-foreground">Category</label>
              <Select defaultValue="all">
                <SelectTrigger id="category-filter">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {/* Placeholder for categories - fetch and map them */}
                   <SelectItem value="cat-placeholder-1">Category Placeholder 1</SelectItem>
                   <SelectItem value="cat-placeholder-2">Category Placeholder 2</SelectItem>
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
            title="Monthly Income"
            value={formatCurrency(monthlyIncome, preferredCurrency, undefined, false)}
            tooltip="Total income received this month."
            icon={<TrendingUp className="text-green-500" />}
            valueClassName="text-green-600 dark:text-green-500"
          />
          <KpiCard
            title="Monthly Expenses"
            value={formatCurrency(monthlyExpenses, preferredCurrency, undefined, false)}
            tooltip="Total expenses this month."
            icon={<TrendingDown className="text-red-500" />}
            valueClassName="text-red-600 dark:text-red-500"
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
            title="Savings Rate"
            value={`${(savingsRate * 100).toFixed(1)}%`}
            tooltip="Percentage of your income you are saving."
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
              {isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : netWorthCompositionData.length > 0 ? (
                <NetWorthCompositionChart
                  data={netWorthCompositionData}
                  currency={preferredCurrency}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  No portfolio data to display. Add accounts to see your composition.
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Monthly Cash Flow (Coming Soon)</CardTitle>
              <CardDescription>Compare income and expenses over time.</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] sm:h-[350px] flex items-center justify-center">
               {isLoading ? (
                  <Skeleton className="h-full w-full" />
               ) : (
                 <p className="text-muted-foreground">Cash flow chart in development.</p>
               )}
            </CardContent>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  );
}


    