
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAccounts, type Account } from "@/services/account-sync";
import { getTransactions, type Transaction } from "@/services/transactions.tsx";
import { getCategoryStyle } from '@/services/categories.tsx';
import { Badge } from "@/components/ui/badge";
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/currency';
import { getUserPreferences } from '@/lib/preferences';
import { format } from 'date-fns';

// Helper function to format date
const formatDate = (dateString: string): string => {
    try {
        const date = new Date(dateString.includes('T') ? dateString : dateString + 'T00:00:00Z');
        if (isNaN(date.getTime())) throw new Error('Invalid date');
        return format(date, 'PP'); // Use a user-friendly format like 'Jul 15, 2024'
    } catch (error) {
        console.error("Error formatting date:", dateString, error);
        return 'Invalid Date';
    }
};

export default function RevenuePage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preferredCurrency, setPreferredCurrency] = useState('BRL');

  // Fetch preferences and all data on mount - Client-side only
  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
       if (typeof window === 'undefined') {
         if (isMounted) {
           setIsLoading(false);
           setError("Revenue data can only be loaded on the client.");
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
        const transactionPromises = fetchedAccounts.map(acc => getTransactions(acc.id));
        const transactionsByAccount = await Promise.all(transactionPromises);
        const combinedTransactions = transactionsByAccount.flat();

        // Sort transactions by date (newest first)
        combinedTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        if (isMounted) setAllTransactions(combinedTransactions);

      } catch (err) {
        console.error("Failed to fetch revenue data:", err);
        if (isMounted) setError("Could not load revenue data. Please try again later.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchData();

     // Add storage listener for preference/account changes - Client-side only
     const handleStorageChange = (event: StorageEvent) => {
         if (typeof window !== 'undefined' && (event.key === 'userAccounts' || event.key === 'userPreferences')) {
             console.log("Storage changed, refetching revenue data...");
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

  }, []); // Empty dependency array

  // Filter transactions to only include income (positive amounts)
  const incomeTransactions = useMemo(() => {
    return allTransactions.filter(tx => tx.amount > 0);
  }, [allTransactions]);

  // Find the account for a given transaction ID
   const getAccountForTransaction = (accountId: string): Account | undefined => {
        return accounts.find(acc => acc.id === accountId);
   };


  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
      <h1 className="text-3xl font-bold mb-6">Revenue / Income</h1>

       {error && (
          <div className="mb-4 p-4 bg-destructive/10 text-destructive border border-destructive rounded-md">
              {error}
          </div>
       )}

      {/* Income Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Income Transactions</CardTitle>
           <CardDescription>
                Showing recent income transactions across all accounts. Amounts displayed in {preferredCurrency}.
           </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => ( // Show a few skeleton rows
                  <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : incomeTransactions.length > 0 ? (
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
                {incomeTransactions.map((transaction) => {
                    const account = getAccountForTransaction(transaction.accountId);
                    if (!account) return null; // Should not happen if data is consistent

                    const { icon: CategoryIcon, color } = getCategoryStyle(transaction.category);
                    const formattedAmount = formatCurrency(transaction.amount, account.currency, undefined, true); // Convert to preferred

                    return (
                        <TableRow key={transaction.id} className="hover:bg-muted/50">
                            <TableCell className="whitespace-nowrap">{formatDate(transaction.date)}</TableCell>
                            <TableCell className="text-muted-foreground">{account.name}</TableCell>
                            <TableCell>{transaction.description}</TableCell>
                            <TableCell>
                                <Badge variant="outline" className={`flex items-center gap-1 ${color} border`}>
                                    <CategoryIcon />
                                    <span className="capitalize">{transaction.category || 'Uncategorized'}</span>
                                </Badge>
                            </TableCell>
                            <TableCell className={`text-right font-medium text-green-500 dark:text-green-400`}>
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
                No income transactions found yet.
              </p>
              {/* TODO: Optional: Add a button or link to add transactions */}
            </div>
          )}
        </CardContent>
         {/* TODO: Optional: Add button in footer if transactions exist */}
         {!isLoading && incomeTransactions.length > 0 && (
             <CardContent className="pt-4 border-t">
                  {/* TODO: Add button to open 'Add Transaction' dialog */}
                  {/* Example: <AddTransactionButton /> */}
             </CardContent>
         )}
      </Card>
      {/* Future: Could add income charts or summaries here */}
    </div>
  );
}

