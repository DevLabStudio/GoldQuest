'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import TotalNetWorthCard from "@/components/dashboard/total-net-worth-card";
import SmallStatCard from "@/components/dashboard/small-stat-card";
import IncomeSourceChart from "@/components/dashboard/income-source-chart";
import SpendingsBreakdown from "@/components/dashboard/spendings-breakdown";
import IncomeExpensesChart from "@/components/dashboard/income-expenses-chart";
import AssetsChart from "@/components/dashboard/assets-chart";
import { DollarSign, TrendingUp, TrendingDown, Home, Users, Car } from "lucide-react";
import { getAccounts, type Account } from "@/services/account-sync";
import { getTransactions, type Transaction } from "@/services/transactions";
import { getCategories, type Category, getCategoryStyle } from '@/services/categories';
import { getUserPreferences } from '@/lib/preferences';
import { formatCurrency, convertCurrency, getCurrencySymbol } from '@/lib/currency'; 
import { startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from "@/hooks/use-toast";


const incomeSourceData = [
  { source: "E-commerce", amount: 2100, fill: "hsl(var(--chart-1))" },
  { source: "Google Adsense", amount: 950, fill: "hsl(var(--chart-3))" },
  { source: "My Shop", amount: 8000, fill: "hsl(var(--chart-5))" },
  { source: "Salary", amount: 13000, fill: "hsl(var(--chart-2))" },
];

const monthlyIncomeExpensesData = [
  { month: "Jan", income: 12000, expenses: 8000 },
  { month: "Feb", income: 15000, expenses: 9500 },
  { month: "Mar", income: 18000, expenses: 12000 },
  { month: "Apr", income: 14000, expenses: 15000 },
  { month: "May", income: 22000, expenses: 10000 },
  { month: "Jun", income: 25000, expenses: 11000 },
  { month: "Jul", income: 23000, expenses: 13000 },
  { month: "Aug", income: 20000, expenses: 12500 },
  { month: "Sep", income: 19000, expenses: 10000 },
  { month: "Oct", income: 21000, expenses: 9000 },
  { month: "Nov", income: 24000, expenses: 11500 },
  { month: "Dec", income: 20239, expenses: 20239 },
];

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
  const [preferredCurrency, setPreferredCurrency] = useState('BRL');
  const { toast } = useToast();

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      if (typeof window === 'undefined') {
        if (isMounted) setIsLoading(false);
        return;
      }
      if (isMounted) setIsLoading(true);
      try {
        const prefs = getUserPreferences();
        if (isMounted) setPreferredCurrency(prefs.preferredCurrency);

        const fetchedAccounts = await getAccounts();
        if (isMounted) setAccounts(fetchedAccounts);

        const fetchedCategories = await getCategories();
        if (isMounted) setCategories(fetchedCategories);

        if (fetchedAccounts.length > 0) {
          const transactionPromises = fetchedAccounts.map(acc => getTransactions(acc.id));
          const transactionsByAccount = await Promise.all(transactionPromises);
          const combinedTransactions = transactionsByAccount.flat();
          if (isMounted) setAllTransactions(combinedTransactions);
        } else {
           if (isMounted) setAllTransactions([]);
        }


      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
        if(isMounted) toast({ title: "Error", description: "Failed to load dashboard data.", variant: "destructive" });
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchData();
    const handleStorageChange = (event: StorageEvent) => {
        if (typeof window !== 'undefined' && ['userAccounts', 'userPreferences', 'userCategories', 'userTags', 'transactions-'].some(key => event.key?.includes(key)) && isMounted) {
            console.log("Storage changed on main dashboard, refetching data...");
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
  }, []); 

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
          return sum + convertCurrency(Math.abs(tx.amount), account.currency, preferredCurrency); // Corrected Math.Abs to Math.abs
        }
      }
      return sum;
    }, 0);
  }, [currentMonthTransactions, accounts, preferredCurrency, isLoading]);

  const spendingsBreakdownDataActual = useMemo(() => {
    if (isLoading || typeof window === 'undefined' || !categories.length) return [];
    const expenseCategoryTotals: { [key: string]: number } = {};

    currentMonthTransactions.forEach(tx => {
      if (tx.amount < 0) { 
        const account = accounts.find(acc => acc.id === tx.accountId);
        if (account) {
          const categoryName = tx.category || 'Uncategorized';
          const convertedAmount = convertCurrency(Math.abs(tx.amount), account.currency, preferredCurrency); // Corrected Math.Abs to Math.abs
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
  }, [currentMonthTransactions, accounts, categories, preferredCurrency, isLoading]);


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
          <Skeleton className="h-[160px] w-full" />
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
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-2">
          <TotalNetWorthCard amount={totalNetWorth} currency={getCurrencySymbol(preferredCurrency)} />
        </div>
        <SmallStatCard
          title="Spendings"
          amount={monthlyExpenses}
          currency={getCurrencySymbol(preferredCurrency)}
          chartType="negative"
          href="/expenses" 
        />
        <SpendingsBreakdown title="Spendings" data={spendingsBreakdownDataActual} currency={preferredCurrency} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-2">
          <IncomeSourceChart data={incomeSourceData} currency={getCurrencySymbol(preferredCurrency)} />
        </div>
        <SmallStatCard
          title="Income"
          amount={monthlyIncome}
          currency={getCurrencySymbol(preferredCurrency)}
          chartType="positive"
          href="/revenue" 
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <IncomeExpensesChart data={monthlyIncomeExpensesData} currency={getCurrencySymbol(preferredCurrency)} />
        <AssetsChart data={assetsData} currency={getCurrencySymbol(preferredCurrency)} />
      </div>
    </div>
  );
}
