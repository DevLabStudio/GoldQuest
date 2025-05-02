'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAccounts, type Account } from "@/services/account-sync";
import { getTransactions, type Transaction } from "@/services/transactions";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from '@/components/ui/skeleton';
import { ShoppingCart, Home, Car, Utensils, PiggyBank, AlertCircle } from 'lucide-react'; // Example icons

// Helper function to format currency
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
};

// Helper function to format date
const formatDate = (dateString: string): string => {
    try {
        // Assuming dateString is in 'YYYY-MM-DD' format
        const date = new Date(dateString + 'T00:00:00'); // Add time to avoid timezone issues
        if (isNaN(date.getTime())) {
            throw new Error('Invalid date');
        }
        return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
    } catch (error) {
        console.error("Error formatting date:", dateString, error);
        return 'Invalid Date';
    }
};

// Map categories to icons and colors (simple example)
const categoryStyles: { [key: string]: { icon: React.ElementType, color: string } } = {
  groceries: { icon: ShoppingCart, color: 'bg-green-100 text-green-800 border-green-300' },
  rent: { icon: Home, color: 'bg-blue-100 text-blue-800 border-blue-300' },
  utilities: { icon: PiggyBank, color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  transportation: { icon: Car, color: 'bg-purple-100 text-purple-800 border-purple-300' },
  food: { icon: Utensils, color: 'bg-red-100 text-red-800 border-red-300' },
  default: { icon: AlertCircle, color: 'bg-gray-100 text-gray-800 border-gray-300' },
};

const getCategoryStyle = (category: string) => {
  return categoryStyles[category.toLowerCase()] || categoryStyles.default;
};


export default function TransactionsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAccounts = async () => {
      setIsLoadingAccounts(true);
      setError(null);
      try {
        const fetchedAccounts = await getAccounts();
        setAccounts(fetchedAccounts);
        if (fetchedAccounts.length > 0 && !selectedAccountId) {
          // Default to the first account if none is selected
           setSelectedAccountId(fetchedAccounts[0].id);
        }
      } catch (err) {
        console.error("Failed to fetch accounts:", err);
        setError("Could not load accounts. Please try again later.");
      } finally {
        setIsLoadingAccounts(false);
      }
    };
    fetchAccounts();
  }, []); // Run only once on mount

 useEffect(() => {
    const fetchTransactions = async () => {
      if (!selectedAccountId) {
        setTransactions([]); // Clear transactions if no account is selected
        return;
      }
      setIsLoadingTransactions(true);
      setError(null);
      try {
        const fetchedTransactions = await getTransactions(selectedAccountId);
        setTransactions(fetchedTransactions);
      } catch (err) {
        console.error("Failed to fetch transactions:", err);
        setError(`Could not load transactions for the selected account.`);
        setTransactions([]); // Clear transactions on error
      } finally {
        setIsLoadingTransactions(false);
      }
    };

    fetchTransactions();
  }, [selectedAccountId]); // Re-run when selectedAccountId changes

  const handleAccountChange = (accountId: string) => {
     setSelectedAccountId(accountId);
  };

  const selectedAccountName = useMemo(() => {
      return accounts.find(acc => acc.id === selectedAccountId)?.name || 'Selected Account';
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
                  {account.name} ({formatCurrency(account.balance)})
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
                Showing transactions for: {isLoadingAccounts ? <Skeleton className="h-4 w-32 inline-block" /> : selectedAccountName}
           </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingTransactions ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : transactions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => {
                    const { icon: CategoryIcon, color } = getCategoryStyle(transaction.category);
                    return (
                        <TableRow key={transaction.id}>
                        <TableCell className="whitespace-nowrap">{formatDate(transaction.date)}</TableCell>
                        <TableCell>{transaction.description}</TableCell>
                        <TableCell>
                            <Badge variant="outline" className={`flex items-center gap-1 ${color}`}>
                                <CategoryIcon className="h-3 w-3" />
                                <span className="capitalize">{transaction.category}</span>
                            </Badge>
                        </TableCell>
                        <TableCell className={`text-right font-medium ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(transaction.amount)}
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
