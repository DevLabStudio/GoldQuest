
'use client'; // Make this a Client Component

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getAccounts, type Account } from "@/services/account-sync";
import { DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import SpendingChart from "@/components/dashboard/spending-chart";
import { formatCurrency } from '@/lib/currency'; // Use the new currency formatter
import { getUserPreferences } from '@/lib/preferences'; // Get user preferences
import { Skeleton } from '@/components/ui/skeleton'; // Import Skeleton

// Simple formatter for already-converted total balance
const formatTotalBalance = (amount: number, currencyCode: string): string => {
   try {
    let formatLocale;
    switch (currencyCode.toUpperCase()) {
        case 'BRL': formatLocale = 'pt-BR'; break;
        case 'USD': formatLocale = 'en-US'; break;
        case 'EUR': formatLocale = 'de-DE'; break; // Example
        case 'GBP': formatLocale = 'en-GB'; break;
        default: formatLocale = 'en-US';
    }
    return new Intl.NumberFormat(formatLocale, {
        style: 'currency',
        currency: currencyCode.toUpperCase(),
    }).format(amount);
  } catch (error) {
    console.error(`Error formatting total balance: Amount=${amount}, Currency=${currencyCode}`, error);
    return `${currencyCode.toUpperCase()} ${amount.toFixed(2)}`;
  }
}

export default function Dashboard() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [totalBalanceInPreferred, setTotalBalanceInPreferred] = useState(0);
  const [preferredCurrency, setPreferredCurrency] = useState('BRL'); // Default, will be updated
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Placeholder data for spending trends (can remain static for now)
  const monthlyIncome = 5000; // Assume placeholder is in BRL for simplicity, conversion needed if user pref differs
  const monthlyExpenses = 3500; // Assume placeholder is in BRL
  const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100 : 0;
  const spendingData = [
    { category: "Groceries", amount: 450.75 }, // Assume BRL
    { category: "Utilities", amount: 150.30 },
    { category: "Rent", amount: 1200.00 },
    { category: "Transport", amount: 180.50 },
    { category: "Food", amount: 350.00 },
    { category: "Other", amount: 200.00 },
  ];

  // Fetch data client-side
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // 1. Get Preferences (Client-side safe)
        const prefs = getUserPreferences();
        setPreferredCurrency(prefs.preferredCurrency);

        // 2. Fetch Accounts (Client-side safe as it uses localStorage)
        const fetchedAccounts = await getAccounts();
        setAccounts(fetchedAccounts);

        // 3. Calculate Total Balance (using the fetched preferredCurrency)
        // Note: formatCurrency now handles conversion based on stored preference
        const total = fetchedAccounts.reduce((sum, account) => {
             // Need the raw numeric value converted to preferred currency
             // formatCurrency returns a string, let's adapt or use a dedicated converter
             // For now, we assume formatCurrency could expose a conversion utility or we add one
            const numericValueInPreferred = parseFloat(
                formatCurrency(account.balance, account.currency) // formatCurrency handles the conversion
                .replace(/[^0-9,-]+/g,"") // Remove symbols/letters
                .replace(",", ".") // Handle decimal comma
            );
           return sum + (isNaN(numericValueInPreferred) ? 0 : numericValueInPreferred);
        }, 0);
        setTotalBalanceInPreferred(total);

      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
        setError("Could not load dashboard data. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();

    // Add listener for storage changes (preferences or accounts)
     const handleStorageChange = (event: StorageEvent) => {
        if (event.key === 'userPreferences' || event.key === 'userAccounts') {
            console.log("Storage changed, refetching dashboard data...");
            fetchData(); // Refetch all data on change
        }
     };
     window.addEventListener('storage', handleStorageChange);

     // Cleanup listener
     return () => {
       window.removeEventListener('storage', handleStorageChange);
     };

  }, []); // Empty dependency array ensures this runs once on mount and on storage change

  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
      <h1 className="text-3xl font-bold mb-6">Dashboard Overview</h1>

        {error && (
          <div className="mb-4 p-4 bg-destructive/10 text-destructive border border-destructive rounded-md">
              {error}
          </div>
       )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Total Balance Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Balance ({preferredCurrency})</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <>
                <Skeleton className="h-8 w-3/4 mb-1" />
                <Skeleton className="h-4 w-1/2" />
              </>
            ) : (
              <>
                <div className="text-2xl font-bold">{formatTotalBalance(totalBalanceInPreferred, preferredCurrency)}</div>
                <p className="text-xs text-muted-foreground">Across {accounts.length} accounts</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Monthly Income Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            {/* TODO: Convert placeholder income to preferred currency */}
            <CardTitle className="text-sm font-medium">Monthly Income ({preferredCurrency} - Placeholder)</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
             {isLoading ? (
               <>
                 <Skeleton className="h-8 w-3/4 mb-1" />
                 <Skeleton className="h-4 w-1/2" />
               </>
             ) : (
                <>
                    {/* Format placeholder income */}
                    <div className="text-2xl font-bold">{formatTotalBalance(monthlyIncome, preferredCurrency)}</div>
                    <p className="text-xs text-muted-foreground">+2.1% from last month (example)</p>
                </>
             )}
          </CardContent>
        </Card>

        {/* Monthly Expenses Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            {/* TODO: Convert placeholder expenses to preferred currency */}
            <CardTitle className="text-sm font-medium">Monthly Expenses ({preferredCurrency} - Placeholder)</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
             {isLoading ? (
               <>
                 <Skeleton className="h-8 w-3/4 mb-1" />
                 <Skeleton className="h-4 w-1/2" />
               </>
             ) : (
                 <>
                    {/* Format placeholder expenses */}
                    <div className="text-2xl font-bold">{formatTotalBalance(monthlyExpenses, preferredCurrency)}</div>
                    <p className="text-xs text-muted-foreground">-5.3% from last month (example)</p>
                 </>
             )}
          </CardContent>
        </Card>

         {/* Savings Rate Card */}
         <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Savings Rate (Placeholder)</CardTitle>
             <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
             {isLoading ? (
               <>
                 <Skeleton className="h-8 w-1/4 mb-1" />
                 <Skeleton className="h-4 w-3/4" />
               </>
             ) : (
                 <>
                    <div className="text-2xl font-bold">{savingsRate.toFixed(1)}%</div>
                    <p className="text-xs text-muted-foreground">Based on current month placeholders</p>
                 </>
             )}
          </CardContent>
        </Card>
      </div>

       {/* Account Balances List */}
       <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Account Balances</CardTitle>
            <CardDescription>Current balance for each account (shown in your preferred currency: {preferredCurrency}).</CardDescription>
          </CardHeader>
          <CardContent>
             {isLoading ? (
                 <div className="space-y-4">
                    {[...Array(2)].map((_, i) => (
                      <div key={i} className="flex justify-between items-center border-b pb-2 last:border-b-0">
                        <div>
                          <Skeleton className="h-5 w-32 mb-1" />
                          <Skeleton className="h-4 w-24" />
                        </div>
                        <Skeleton className="h-6 w-20" />
                      </div>
                    ))}
                 </div>
             ) : accounts.length > 0 ? (
                 <ul className="space-y-4">
                 {accounts.map((account) => (
                   <li key={account.id} className="flex justify-between items-center border-b pb-2 last:border-b-0">
                     <div>
                       <p className="font-medium">{account.name}</p>
                       <p className="text-sm text-muted-foreground capitalize">{account.bankName || account.type} ({account.currency})</p>
                     </div>
                     {/* formatCurrency handles conversion */}
                     <p className="font-semibold">{formatCurrency(account.balance, account.currency)}</p>
                   </li>
                 ))}
               </ul>
             ) : (
                <p className="text-muted-foreground">No accounts found. Add accounts to see balances.</p>
             )}
          </CardContent>
        </Card>
       </div>

       {/* Spending Trends Chart */}
       <div className="mt-8">
           <Card>
               <CardHeader>
                    {/* TODO: Convert chart data to preferred currency */}
                   <CardTitle>Spending Trends ({preferredCurrency} - Placeholder)</CardTitle>
                   <CardDescription>Monthly spending by category.</CardDescription>
               </CardHeader>
               <CardContent className="h-80">
                 {isLoading ? (
                     <Skeleton className="h-full w-full" />
                 ) : (
                    /* Pass preferred currency for formatting inside the chart */
                    <SpendingChart data={spendingData} currency={preferredCurrency} />
                 )}
               </CardContent>
           </Card>
       </div>
    </div>
  );
}

    