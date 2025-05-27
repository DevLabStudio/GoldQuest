
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import TotalNetWorthCard from "@/components/dashboard/total-net-worth-card";
import SubscriptionsPieChart from "@/components/dashboard/subscriptions-pie-chart";
import IncomeSourceChart from "@/components/dashboard/income-source-chart";
import IncomeExpensesChart from "@/components/dashboard/income-expenses-chart";
import AssetsChart from "@/components/dashboard/assets-chart";
import { getAccounts, type Account } from "@/services/account-sync";
import { getTransactions, type Transaction } from "@/services/transactions";
import { getCategories, type Category, getCategoryStyle } from '@/services/categories';
import { getUserPreferences } from '@/lib/preferences';
import { formatCurrency, convertCurrency, getCurrencySymbol } from '@/lib/currency';
import { startOfMonth, endOfMonth, isWithinInterval, parseISO, format as formatDateFns, isSameDay } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from "@/hooks/use-toast";
import { useDateRange } from '@/contexts/DateRangeContext';
import { useAuthContext } from '@/contexts/AuthContext';


const assetsData = [
  { name: "Gold", value: 15700, fill: "hsl(var(--chart-4))" },
  { name: "Stock", value: 22500, fill: "hsl(var(--chart-1))" },
  { name: "Warehouse", value: 120000, fill: "hsl(var(--chart-3))" },
  { name: "Land", value: 135000, fill: "hsl(var(--chart-2))" },
];


export default function DashboardPage() {
  const { user, isLoadingAuth } = useAuthContext();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [preferredCurrency, setPreferredCurrency] = useState('BRL');
  const { toast } = useToast();
  const { selectedDateRange } = useDateRange();

  const fetchData = useCallback(async () => {
    if (!user || isLoadingAuth || typeof window === 'undefined') {
      setIsLoading(false);
      if (!user && !isLoadingAuth) {
        // toast({ title: "Authentication Error", description: "Please log in to view dashboard data.", variant: "destructive" });
      }
      return;
    }
    setIsLoading(true);
    try {
      const prefs = await getUserPreferences();
      setPreferredCurrency(prefs.preferredCurrency);

      const fetchedAccounts = await getAccounts();
      setAccounts(fetchedAccounts);

      const fetchedCategories = await getCategories();
      setCategories(fetchedCategories);

      if (fetchedAccounts.length > 0) {
        const transactionPromises = fetchedAccounts.map(acc => getTransactions(acc.id));
        const transactionsByAccount = await Promise.all(transactionPromises);
        const combinedTransactions = transactionsByAccount.flat();
        setAllTransactions(combinedTransactions);
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
    if (user && !isLoadingAuth) {
        fetchData();
    } else if (!isLoadingAuth && !user) {
        setIsLoading(false);
        setAccounts([]);
        setAllTransactions([]);
        setCategories([]);
    }

    const handleStorageChange = (event: StorageEvent) => {
        if (typeof window !== 'undefined' && event.type === 'storage' && user && !isLoadingAuth) {
            const isLikelyOurCustomEvent = event.key === null;
            const relevantKeysForThisPage = ['userAccounts', 'userPreferences', 'userCategories', 'userTags', 'transactions-', 'userSubscriptions'];
            const isRelevantExternalChange = typeof event.key === 'string' && relevantKeysForThisPage.some(k => event.key!.includes(k));

            if (isLikelyOurCustomEvent || isRelevantExternalChange) {
                console.log("Storage changed on main dashboard, refetching data...");
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
  }, [fetchData, user, isLoadingAuth]);


  const periodTransactions = useMemo(() => {
    if (isLoading || !user) return [];
    return allTransactions.filter(tx => {
      const txDate = parseISO(tx.date.includes('T') ? tx.date : tx.date + 'T00:00:00Z');
      if (!selectedDateRange.from || !selectedDateRange.to) return true;
      return isWithinInterval(txDate, { start: selectedDateRange.from, end: selectedDateRange.to });
    });
  }, [allTransactions, isLoading, selectedDateRange, user]);


  const incomeSourceDataActual = useMemo(() => {
    if (isLoading || typeof window === 'undefined' || !periodTransactions.length || !user) return [];
    const incomeCategoryTotals: { [key: string]: number } = {};
    const chartColors = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];
    let colorIndex = 0;

    periodTransactions.forEach(tx => {
      if (tx.amount > 0 && tx.category !== 'Transfer') {
        const account = accounts.find(acc => acc.id === tx.accountId);
        if (account && account.includeInNetWorth !== false) {
          const categoryName = tx.category || 'Uncategorized Income';
          const convertedAmount = convertCurrency(tx.amount, tx.transactionCurrency, preferredCurrency);
          incomeCategoryTotals[categoryName] = (incomeCategoryTotals[categoryName] || 0) + convertedAmount;
        }
      }
    });

    return Object.entries(incomeCategoryTotals)
      .map(([source, amount]) => ({
        source: source.charAt(0).toUpperCase() + source.slice(1),
        amount,
        fill: chartColors[colorIndex++ % chartColors.length],
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [periodTransactions, accounts, preferredCurrency, isLoading, user]);

  const monthlyExpensesByCategoryData = useMemo(() => {
    if (isLoading || typeof window === 'undefined' || !periodTransactions.length || !user) return [];
    const expenseCategoryTotals: { [key: string]: number } = {};
    const chartColors = ["hsl(var(--chart-5))", "hsl(var(--chart-4))", "hsl(var(--chart-3))", "hsl(var(--chart-2))", "hsl(var(--chart-1))"]; // Slightly different color order for distinction
    let colorIndex = 0;

    periodTransactions.forEach(tx => {
      if (tx.amount < 0 && tx.category !== 'Transfer') {
        const account = accounts.find(acc => acc.id === tx.accountId);
        if (account && account.includeInNetWorth !== false) {
          const categoryName = tx.category || 'Uncategorized Expense';
          const convertedAmount = convertCurrency(Math.abs(tx.amount), tx.transactionCurrency, preferredCurrency);
          expenseCategoryTotals[categoryName] = (expenseCategoryTotals[categoryName] || 0) + convertedAmount;
        }
      }
    });

    return Object.entries(expenseCategoryTotals)
      .map(([categoryName, amount]) => ({
        source: categoryName.charAt(0).toUpperCase() + categoryName.slice(1), // 'source' key for IncomeSourceChart compatibility
        amount,
        fill: chartColors[colorIndex++ % chartColors.length],
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [periodTransactions, accounts, preferredCurrency, isLoading, user]);


  const monthlyIncomeExpensesDataActual = useMemo(() => {
    if (isLoading || typeof window === 'undefined' || !allTransactions.length || !user) return [];

    const monthlyData: { [month: string]: { income: number; expenses: number } } = {};

    const today = new Date();
    const last12MonthsKeys: string[] = [];
    for (let i = 11; i >= 0; i--) {
        const targetMonthDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const monthKey = formatDateFns(targetMonthDate, 'MMM');
        monthlyData[monthKey] = { income: 0, expenses: 0 };
        last12MonthsKeys.push(monthKey);
    }


    allTransactions.forEach(tx => {
        const txDate = parseISO(tx.date.includes('T') ? tx.date : tx.date + 'T00:00:00Z');
        const monthKey = formatDateFns(txDate, 'MMM');
        const account = accounts.find(acc => acc.id === tx.accountId);

        if (account && monthlyData[monthKey] && tx.category !== 'Transfer' && account.includeInNetWorth !== false) {
            if (tx.amount > 0) {
                monthlyData[monthKey].income += convertCurrency(tx.amount, tx.transactionCurrency, preferredCurrency);
            } else if (tx.amount < 0) {
                monthlyData[monthKey].expenses += convertCurrency(Math.abs(tx.amount), tx.transactionCurrency, preferredCurrency);
            }
        }
    });

    return last12MonthsKeys.map(monthKey => ({
        month: monthKey,
        income: monthlyData[monthKey].income,
        expenses: monthlyData[monthKey].expenses,
    }));
  }, [allTransactions, accounts, preferredCurrency, isLoading, user]);

  const dateRangeLabel = useMemo(() => {
    if (selectedDateRange.from && selectedDateRange.to) {
        if (isSameDay(selectedDateRange.from, selectedDateRange.to)) {
            return formatDateFns(selectedDateRange.from, 'MMM d, yyyy');
        }
        return `${formatDateFns(selectedDateRange.from, 'MMM d')} - ${formatDateFns(selectedDateRange.to, 'MMM d, yyyy')}`;
    }
    return 'All Time';
  }, [selectedDateRange]);


  if (isLoadingAuth || (isLoading && typeof window !== 'undefined' && accounts.length === 0 && !user)) {
    return (
      <div className="container mx-auto py-6 px-4 md:px-6 lg:px-8 space-y-6 min-h-screen">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2"><Skeleton className="h-[160px] w-full" /></div>
          <Skeleton className="h-[160px] w-full" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-6">
          <Skeleton className="h-[300px] w-full" />
          <Skeleton className="h-[300px] w-full" />
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Skeleton className="h-[350px] w-full" />
          <Skeleton className="h-[350px] w-full" />
        </div>
      </div>
    );
  }


  return (
    <div className="container mx-auto py-6 px-4 md:px-6 lg:px-8 space-y-6 min-h-screen">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <TotalNetWorthCard accounts={accounts} preferredCurrency={preferredCurrency} />
        </div>
         <SubscriptionsPieChart dateRangeLabel={dateRangeLabel} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div>
          {isLoading || incomeSourceDataActual.length === 0 ? (
            <Card className="shadow-lg bg-card text-card-foreground h-full">
                 <CardHeader>
                    <CardTitle>Income Source ({dateRangeLabel})</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[250px] pb-0 flex items-center justify-center">
                    {isLoading ? <Skeleton className="h-full w-full" /> : <p className="text-muted-foreground">No income data for this period.</p>}
                  </CardContent>
            </Card>
          ) : (
            <IncomeSourceChart data={incomeSourceDataActual} currency={preferredCurrency} />
          )}
        </div>
        <div>
          {isLoading || monthlyExpensesByCategoryData.length === 0 ? (
            <Card className="shadow-lg bg-card text-card-foreground h-full">
                 <CardHeader>
                    <CardTitle>Expense Breakdown ({dateRangeLabel})</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[250px] pb-0 flex items-center justify-center">
                    {isLoading ? <Skeleton className="h-full w-full" /> : <p className="text-muted-foreground">No expense data for this period.</p>}
                  </CardContent>
            </Card>
          ) : (
            <IncomeSourceChart data={monthlyExpensesByCategoryData} currency={preferredCurrency} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
         {isLoading || monthlyIncomeExpensesDataActual.length === 0 ? (
            <Card className="shadow-lg bg-card text-card-foreground">
                <CardHeader className="flex flex-row items-start justify-between pb-4">
                    <div><CardTitle>Income & Expenses (Last 12 Months)</CardTitle></div>
                </CardHeader>
                <CardContent className="h-[300px] w-full p-0 flex items-center justify-center">
                     {isLoading ? <Skeleton className="h-full w-full" /> : <p className="text-muted-foreground">No income/expense data available.</p>}
                </CardContent>
            </Card>
         ) : (
            <IncomeExpensesChart data={monthlyIncomeExpensesDataActual} currency={getCurrencySymbol(preferredCurrency)} />
         )}
        <AssetsChart data={assetsData} currency={getCurrencySymbol(preferredCurrency)} />
      </div>
    </div>
  );
}

