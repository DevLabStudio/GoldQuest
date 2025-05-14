
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react'; // Added useCallback
import type { FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import TotalNetWorthCard from "@/components/dashboard/total-net-worth-card";
import SpendingsBreakdown from "@/components/dashboard/spendings-breakdown";
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


const assetsData = [
  { name: "Gold", value: 15700, fill: "hsl(var(--chart-4))" },
  { name: "Stock", value: 22500, fill: "hsl(var(--chart-1))" },
  { name: "Warehouse", value: 120000, fill: "hsl(var(--chart-3))" },
  { name: "Land", value: 135000, fill: "hsl(var(--chart-2))" },
];


export default function DashboardPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [preferredCurrency, setPreferredCurrency] = useState('BRL'); // Default
  const { toast } = useToast();
  const { selectedDateRange } = useDateRange();

  const fetchData = useCallback(async () => {
    if (typeof window === 'undefined') {
      setIsLoading(false);
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
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
      toast({ title: "Error", description: "Failed to load dashboard data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);


  useEffect(() => {
    fetchData();
    const handleStorageChange = (event: StorageEvent) => {
        if (typeof window !== 'undefined' && event.type === 'storage') {
            const isLikelyOurCustomEvent = event.key === null;
            const relevantKeysForThisPage = ['userAccounts', 'userPreferences', 'userCategories', 'userTags', 'transactions-'];
            const isRelevantExternalChange = typeof event.key === 'string' && relevantKeysForThisPage.some(k => event.key.includes(k));

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
  }, [fetchData]);

  const totalNetWorth = useMemo(() => {
    if (isLoading || typeof window === 'undefined') return 0;
    return accounts
        .filter(acc => acc.includeInNetWorth !== false) 
        .reduce((sum, account) => {
            return sum + convertCurrency(account.balance, account.currency, preferredCurrency);
        }, 0);
  }, [accounts, preferredCurrency, isLoading]);


  const periodTransactions = useMemo(() => {
    if (isLoading) return [];
    return allTransactions.filter(tx => {
      const txDate = parseISO(tx.date.includes('T') ? tx.date : tx.date + 'T00:00:00Z');
      if (!selectedDateRange.from || !selectedDateRange.to) return true;
      return isWithinInterval(txDate, { start: selectedDateRange.from, end: selectedDateRange.to });
    });
  }, [allTransactions, isLoading, selectedDateRange]);


  const monthlyIncome = useMemo(() => {
    if (isLoading || typeof window === 'undefined') return 0;
    return periodTransactions.reduce((sum, tx) => {
      if (tx.amount > 0 && tx.category !== 'Transfer') { 
        const account = accounts.find(acc => acc.id === tx.accountId);
        if (account && account.includeInNetWorth !== false) { 
          return sum + convertCurrency(tx.amount, tx.transactionCurrency, preferredCurrency);
        }
      }
      return sum;
    }, 0);
  }, [periodTransactions, accounts, preferredCurrency, isLoading]);

  const monthlyExpenses = useMemo(() => {
    if (isLoading || typeof window === 'undefined') return 0;
    return periodTransactions.reduce((sum, tx) => {
      if (tx.amount < 0 && tx.category !== 'Transfer') { 
        const account = accounts.find(acc => acc.id === tx.accountId);
        if (account && account.includeInNetWorth !== false) { 
          return sum + convertCurrency(Math.abs(tx.amount), tx.transactionCurrency, preferredCurrency);
        }
      }
      return sum;
    }, 0);
  }, [periodTransactions, accounts, preferredCurrency, isLoading]);


  const spendingsBreakdownDataActual = useMemo(() => {
    if (isLoading || typeof window === 'undefined' || !categories.length || !periodTransactions.length) return [];
    const expenseCategoryTotals: { [key: string]: number } = {};

    periodTransactions.forEach(tx => {
      if (tx.amount < 0 && tx.category !== 'Transfer') { 
        const account = accounts.find(acc => acc.id === tx.accountId);
        if (account && account.includeInNetWorth !== false) { 
          const categoryName = tx.category || 'Uncategorized';
          const convertedAmount = convertCurrency(Math.abs(tx.amount), tx.transactionCurrency, preferredCurrency);
          expenseCategoryTotals[categoryName] = (expenseCategoryTotals[categoryName] || 0) + convertedAmount;
        }
      }
    });

    return Object.entries(expenseCategoryTotals)
      .map(([name, amount]) => {
        const { icon: CategoryIcon, color } = getCategoryStyle(name);

        const categoryStyle = getCategoryStyle(name);
        const bgColor = categoryStyle.color.split(' ').find(cls => cls.startsWith('bg-')) || 'bg-gray-500 dark:bg-gray-700';

        return {
          name: name.charAt(0).toUpperCase() + name.slice(1),
          amount,
          icon: <CategoryIcon />,
          bgColor: bgColor,
        };
      })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);
  }, [periodTransactions, accounts, categories, preferredCurrency, isLoading]);

  const incomeSourceDataActual = useMemo(() => {
    if (isLoading || typeof window === 'undefined' || !periodTransactions.length) return [];
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
  }, [periodTransactions, accounts, preferredCurrency, isLoading]);


  const monthlyIncomeExpensesDataActual = useMemo(() => {
    if (isLoading || typeof window === 'undefined' || !allTransactions.length) return [];

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
  }, [allTransactions, accounts, preferredCurrency, isLoading]);

  const dateRangeLabel = useMemo(() => {
    if (selectedDateRange.from && selectedDateRange.to) {
        if (isSameDay(selectedDateRange.from, selectedDateRange.to)) {
            return formatDateFns(selectedDateRange.from, 'MMM d, yyyy');
        }
        return `${formatDateFns(selectedDateRange.from, 'MMM d')} - ${formatDateFns(selectedDateRange.to, 'MMM d, yyyy')}`;
    }
    return 'All Time';
  }, [selectedDateRange]);


  if (isLoading && typeof window !== 'undefined' && accounts.length === 0) {
    return (
      <div className="container mx-auto py-6 px-4 md:px-6 lg:px-8 space-y-6 min-h-screen">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <div className="xl:col-span-2"><Skeleton className="h-[160px] w-full" /></div>
          <Skeleton className="h-[160px] w-full" />
          <Skeleton className="h-[160px] w-full" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <div className="xl:col-span-2"><Skeleton className="h-[300px] w-full" /></div>
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
         <SpendingsBreakdown title={`Top Spendings (${dateRangeLabel})`} data={spendingsBreakdownDataActual} currency={preferredCurrency} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
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

