

'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAccounts, type Account } from "@/services/account-sync";
import { getTransactions, type Transaction } from "@/services/transactions"; // Assuming this still works
import { Badge } from "@/components/ui/badge";
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/currency'; // Use the new currency formatter
import { getUserPreferences } from '@/lib/preferences'; // Get user preferences
import { ShoppingCart, Home, Car, Utensils, PiggyBank, AlertCircle } from 'lucide-react';

// Helper function to format date (keep as is)
const formatDate = (dateString: string): string => {
    try {
        // Ensure timezone consistency - parse as UTC if no time provided
        const date = new Date(dateString.includes('T') ? dateString : dateString + 'T00:00:00Z');
        if (isNaN(date.getTime())) throw new Error('Invalid date');
        // Use a locale-neutral format or stick with pt-BR if that's the target audience
        return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date); // YYYY-MM-DD
        // return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
    } catch (error) {
        console.error("Error formatting date:", dateString, error);
        return 'Invalid Date';
    }
};


// Category styles (keep as is or adapt if needed)
const categoryStyles: { [key: string]: { icon: React.ElementType, color: string } } = {
  groceries: { icon: ShoppingCart, color: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700' },
  rent: { icon: Home, color: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700' },
  utilities: { icon: PiggyBank, color: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700' },
  transportation: { icon: Car, color: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700' },
  food: { icon: Utensils, color: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700' },
  default: { icon: AlertCircle, color: 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-700/30 dark:text-gray-300 dark:border-gray-600' },
};
const getCategoryStyle = (category: string) => {
    const lowerCategory = category?.toLowerCase() || 'default';
    return categoryStyles[lowerCategory] || categoryStyles.default;
}


export default function TransactionsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preferredCurrency, setPreferredCurrency] = useState('BRL'); // Default preference

  // Fetch preferences on mount - Client-side only
  useEffect(() => {
    if (typeof window !== 'undefined') {
        const prefs = getUserPreferences();
        setPreferredCurrency(prefs.preferredCurrency);
    }
  }, []);

  // Fetch Accounts Effect - Client-side only access to localStorage
  useEffect(() => {
    let isMounted = true; // Flag to prevent state updates on unmounted component
    const fetchAccounts = async () => {
      if (typeof window === 'undefined') {
         setIsLoadingAccounts(false);
         setError("Account data can only be loaded on the client.");
         return;
     }
      setIsLoadingAccounts(true);
      setError(null);
      try {
        const fetchedAccounts = await getAccounts();
        if (isMounted) {
            setAccounts(fetchedAccounts);
            // Auto-select first account only if no account is currently selected
            // or if the selected account no longer exists
            const currentSelectionExists = fetchedAccounts.some(acc => acc.id === selectedAccountId);
            if (fetchedAccounts.length > 0 && (!selectedAccountId || !currentSelectionExists)) {
               setSelectedAccountId(fetchedAccounts[0].id);
            } else if (fetchedAccounts.length === 0) {
               setSelectedAccountId(null); // Clear selection if no accounts
            }
        }
      } catch (err) {
        console.error("Failed to fetch accounts:", err);
        if (isMounted) setError("Could not load accounts. Please try again later.");
      } finally {
        if (isMounted) setIsLoadingAccounts(false);
      }
    };
    fetchAccounts();

     // Add storage listener for preference/account changes - Client-side only
     const handleStorageChange = (event: StorageEvent) => {
         if (typeof window !== 'undefined' && (event.key === 'userAccounts' || event.key === 'userPreferences')) {
             console.log("Storage changed, refetching data...");
             const prefs = getUserPreferences();
             if (isMounted) { // Check if component is still mounted
                 setPreferredCurrency(prefs.preferredCurrency);
                 fetchAccounts(); // Refetch accounts too, their balances/selection might change
             }
         }
     };
     if (typeof window !== 'undefined') {
        window.addEventListener('storage', handleStorageChange);
     }

     return () => {
         isMounted = false; // Cleanup function sets flag to false
         if (typeof window !== 'undefined') {
            window.removeEventListener('storage', handleStorageChange);
         }
     }

  }, [selectedAccountId]); // Re-run if selectedAccountId changes externally maybe?

  // Fetch Transactions Effect
 useEffect(() => {
    let isMounted = true; // Component mount flag
    const fetchTransactions = async () => {
      // Ensure this only runs client-side if localStorage is needed by getTransactions indirectly
      if (typeof window === 'undefined') {
        if (isMounted) {
            setTransactions([]);
            setIsLoadingTransactions(false);
            // Optionally set an error or message indicating client-side required
        }
        return;
      }

      const currentAccount = accounts.find(acc => acc.id === selectedAccountId);
      if (!selectedAccountId || !currentAccount) {
        if (isMounted) {
            setTransactions([]);
            setIsLoadingTransactions(false);
        }
        return;
      }
      if (isMounted) setIsLoadingTransactions(true);
      if (isMounted) setError(null);
      try {
        // Assuming getTransactions returns amounts in the account's original currency
        const fetchedTransactions = await getTransactions(selectedAccountId);
         if (isMounted) setTransactions(fetchedTransactions);
      } catch (err) {
        console.error("Failed to fetch transactions:", err);
         if (isMounted) setError(`Could not load transactions for the selected account.`);
         if (isMounted) setTransactions([]);
      } finally {
         if (isMounted) setIsLoadingTransactions(false);
      }
    };

    fetchTransactions();
     return () => { isMounted = false }; // Cleanup on unmount or re-run
  }, [selectedAccountId, accounts]); // Re-run when selectedAccountId or accounts list changes

  const handleAccountChange = (accountId: string) => {
     setSelectedAccountId(accountId);
  };

  const selectedAccount = useMemo(() => {
      return accounts.find(acc => acc.id === selectedAccountId);
  }, [accounts, selectedAccountId]);


  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
      <h1 className="text-3xl font-bold mb-6">Transactions</h1>

       {error && (
          <div className="mb-4 p-4 bg-destructive/10 text-destructive border border-destructive rounded-md">
              {error}
          </div>
       )}


      <div className="mb-6">
        <label htmlFor="account-select" className="block text-sm font-medium text-muted-foreground mb-1">
          Select Account
        </label>
        {isLoadingAccounts ? (
             <Skeleton className="h-10 w-full md:w-1/2 lg:w-1/3" />
        ) : (
          <Select
            value={selectedAccountId ?? ''}
            onValueChange={handleAccountChange}
            disabled={accounts.length === 0}
          >
            <SelectTrigger id="account-select" className="w-full md:w-1/2 lg:w-1/3">
              <SelectValue placeholder="Select an account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                    {/* Display original balance first, then converted if different */}
                  {account.name} ({formatCurrency(account.balance, account.currency, undefined, false)}
                  {account.currency !== preferredCurrency && ` / ${formatCurrency(account.balance, account.currency, undefined, true)}`})
                </SelectItem>
              ))}
               {accounts.length === 0 && <SelectItem value="no-accounts" disabled>No accounts available</SelectItem>}
            </SelectContent>
          </Select>
        )}
      </div>


      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
           <CardDescription>
                {isLoadingAccounts && "Loading accounts..."}
                {/* Update description to reflect display currency */}
                {selectedAccount && `Showing transactions for: ${selectedAccount.name}. Amounts displayed in ${preferredCurrency}.`}
                {!selectedAccount && !isLoadingAccounts && "Select an account to view transactions."}
           </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingTransactions ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : transactions.length > 0 && selectedAccount ? ( // Ensure selectedAccount exists
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount ({preferredCurrency})</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => {
                    const { icon: CategoryIcon, color } = getCategoryStyle(transaction.category);
                    // Format transaction amount converting to preferred currency
                    const formattedAmount = formatCurrency(transaction.amount, selectedAccount.currency, undefined, true); // Explicitly convert
                    return (
                        <TableRow key={transaction.id}>
                        <TableCell className="whitespace-nowrap">{formatDate(transaction.date)}</TableCell>
                        <TableCell>{transaction.description}</TableCell>
                        <TableCell>
                            <Badge variant="outline" className={`flex items-center gap-1 ${color} border`}> {/* Added border for visibility */}
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
                {selectedAccountId ? "No transactions found for this account." : "Select an account to view transactions."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

