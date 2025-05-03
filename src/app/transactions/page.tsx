
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAccounts, type Account } from "@/services/account-sync";
import { getTransactions, type Transaction } from "@/services/transactions"; // Use updated service
import { Badge } from "@/components/ui/badge";
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, convertCurrency } from '@/lib/currency'; // Use formatters and converters
import { getUserPreferences } from '@/lib/preferences'; // Get user preferences
import SpendingChart from '@/components/dashboard/spending-chart'; // Reuse the chart
import { ShoppingCart, Home, Car, Utensils, PiggyBank, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';

// Helper function to format date (consistent with previous implementation)
const formatDate = (dateString: string): string => {
    try {
        const date = new Date(dateString.includes('T') ? dateString : dateString + 'T00:00:00Z');
        if (isNaN(date.getTime())) throw new Error('Invalid date');
        return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date); // YYYY-MM-DD
    } catch (error) {
        console.error("Error formatting date:", dateString, error);
        return 'Invalid Date';
    }
};

// Category styles (consistent with previous implementation)
const categoryStyles: { [key: string]: { icon: React.ElementType, color: string } } = {
  groceries: { icon: ShoppingCart, color: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700' },
  rent: { icon: Home, color: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700' },
  utilities: { icon: PiggyBank, color: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700' },
  transportation: { icon: Car, color: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700' },
  food: { icon: Utensils, color: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700' },
  income: { icon: TrendingUp, color: 'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-700' }, // Example income
  salary: { icon: TrendingUp, color: 'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-700' }, // Example income
  default: { icon: AlertCircle, color: 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-700/30 dark:text-gray-300 dark:border-gray-600' },
};
const getCategoryStyle = (category: string) => {
    const lowerCategory = category?.toLowerCase() || 'default';
    return categoryStyles[lowerCategory] || categoryStyles.default;
}


export default function TransactionsOverviewPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preferredCurrency, setPreferredCurrency] = useState('BRL'); // Default preference

  // Fetch preferences and all data on mount - Client-side only
  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
       if (typeof window === 'undefined') {
         if (isMounted) {
           setIsLoading(false);
           setError("Transaction data can only be loaded on the client.");
         }
         return;
       }

      if (isMounted) setIsLoading(true);
      if (isMounted) setError(null);
      try {
        // 1. Get Preferences
        const prefs = getUserPreferences();
        if (isMounted) setPreferredCurrency(prefs.preferredCurrency);

        // 2. Fetch Accounts
        const fetchedAccounts = await getAccounts();
        if (isMounted) setAccounts(fetchedAccounts);

        // 3. Fetch Transactions for *all* accounts
        // In a real app, you might have a dedicated endpoint for this or paginate
        const transactionPromises = fetchedAccounts.map(acc => getTransactions(acc.id));
        const transactionsByAccount = await Promise.all(transactionPromises);
        const combinedTransactions = transactionsByAccount.flat();

        // Sort transactions by date (newest first)
        combinedTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

         if (isMounted) setAllTransactions(combinedTransactions);

      } catch (err) {
        console.error("Failed to fetch transaction data:", err);
        if (isMounted) setError("Could not load transaction data. Please try again later.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchData();

     // Add storage listener for preference/account changes - Client-side only
     const handleStorageChange = (event: StorageEvent) => {
         if (typeof window !== 'undefined' && (event.key === 'userAccounts' || event.key === 'userPreferences')) {
             console.log("Storage changed, refetching transaction overview data...");
             if (isMounted) fetchData(); // Refetch all data on change
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
     }

  }, []); // Empty dependency array ensures this runs once on mount and handles storage changes

  // Calculate spending data for the chart (convert to preferred currency)
  const spendingData = useMemo(() => {
      if (isLoading || !accounts.length || !allTransactions.length) return [];

      const categoryTotals: { [key: string]: number } = {};

      allTransactions.forEach(tx => {
          if (tx.amount < 0) { // Only consider expenses for spending chart
              const account = accounts.find(acc => acc.id === tx.accountId);
              if (account) {
                 const convertedAmount = convertCurrency(Math.abs(tx.amount), account.currency, preferredCurrency);
                 const category = tx.category?.toLowerCase() || 'uncategorized';
                 categoryTotals[category] = (categoryTotals[category] || 0) + convertedAmount;
              }
          }
      });

      return Object.entries(categoryTotals)
          .map(([category, amount]) => ({ category: category.charAt(0).toUpperCase() + category.slice(1), amount }))
          .sort((a, b) => b.amount - a.amount); // Sort descending by amount

  }, [allTransactions, accounts, preferredCurrency, isLoading]);


  // Find the account for a given transaction ID
   const getAccountForTransaction = (accountId: string): Account | undefined => {
        return accounts.find(acc => acc.id === accountId);
   };


  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
      <h1 className="text-3xl font-bold mb-6">Transactions Overview</h1>

       {error && (
          <div className="mb-4 p-4 bg-destructive/10 text-destructive border border-destructive rounded-md">
              {error}
          </div>
       )}

       {/* Spending Trends Chart */}
       <div className="mb-8">
           <Card>
               <CardHeader>
                   {/* Update Title to reflect preferred currency */}
                   <CardTitle>Spending by Category ({preferredCurrency})</CardTitle>
                   <CardDescription>Breakdown of expenses across all accounts.</CardDescription>
               </CardHeader>
               <CardContent className="h-80">
                 {isLoading ? (
                     <Skeleton className="h-full w-full" />
                 ) : spendingData.length > 0 ? (
                     /* Pass converted data and preferred currency */
                    <SpendingChart data={spendingData} currency={preferredCurrency} />
                 ) : (
                     <div className="flex h-full items-center justify-center text-muted-foreground">
                         No spending data available to display chart.
                     </div>
                 )}
               </CardContent>
           </Card>
       </div>

      {/* All Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Transactions</CardTitle>
           <CardDescription>
                {/* Update description to reflect display currency */}
                Showing recent transactions across all accounts. Amounts displayed in {preferredCurrency}.
           </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(10)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : allTransactions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount ({preferredCurrency})</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allTransactions.map((transaction) => {
                    const account = getAccountForTransaction(transaction.accountId);
                    if (!account) return null; // Should not happen if data is consistent

                    const { icon: CategoryIcon, color } = getCategoryStyle(transaction.category);
                    // Format transaction amount converting to preferred currency
                    const formattedAmount = formatCurrency(transaction.amount, account.currency, undefined, true); // Explicitly convert
                    return (
                        <TableRow key={transaction.id} className="hover:bg-muted/50">
                            <TableCell className="whitespace-nowrap">{formatDate(transaction.date)}</TableCell>
                            <TableCell className="text-muted-foreground">{account.name}</TableCell>
                            <TableCell>{transaction.description}</TableCell>
                            <TableCell>
                                <Badge variant="outline" className={`flex items-center gap-1 ${color} border`}>
                                    <CategoryIcon className="h-3 w-3" />
                                    <span className="capitalize">{transaction.category || 'Uncategorized'}</span>
                                </Badge>
                            </TableCell>
                            <TableCell className={`text-right font-medium ${transaction.amount >= 0 ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                                {formattedAmount}
                            </TableCell>
                        </TableRow>
                    );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-10">
              <p className="text-muted-foreground">
                No transactions found across any accounts yet.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
