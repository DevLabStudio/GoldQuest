
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAccounts, type Account } from "@/services/account-sync";
import { getTransactions, updateTransaction, deleteTransaction, type Transaction } from "@/services/transactions"; // Removed .tsx
import { getCategories, getCategoryStyle, Category } from '@/services/categories'; // Removed .tsx
import { getTags, type Tag, getTagStyle } from '@/services/tags'; // Removed .tsx
import { Badge } from "@/components/ui/badge";
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, convertCurrency } from '@/lib/currency'; // Use formatters and converters
import { getUserPreferences } from '@/lib/preferences'; // Get user preferences
import SpendingChart from '@/components/dashboard/spending-chart'; // Reuse the chart
import { format } from 'date-fns'; // Import date-fns for formatting
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Edit, Trash2, MoreHorizontal } from 'lucide-react';
import AddTransactionForm from '@/components/transactions/add-transaction-form'; // For editing
import { useToast } from '@/hooks/use-toast';
import type { AddTransactionFormData } from '@/components/transactions/add-transaction-form'; // Import form data type

// Define the initial limit for transactions
const INITIAL_TRANSACTION_LIMIT = 50;

// Helper function to format date (consistent with previous implementation)
const formatDate = (dateString: string): string => {
    try {
        // Handle both YYYY-MM-DD and ISO strings more robustly
        const date = new Date(dateString.includes('T') ? dateString : dateString + 'T00:00:00Z');
        if (isNaN(date.getTime())) throw new Error('Invalid date');
        return format(date, 'PP'); // Use a user-friendly format like 'Jul 15, 2024'
    } catch (error) {
        console.error("Error formatting date:", dateString, error);
        return 'Invalid Date';
    }
};


export default function TransactionsOverviewPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]); // State for categories
  const [tags, setTags] = useState<Tag[]>([]); // State for tags
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preferredCurrency, setPreferredCurrency] = useState('BRL'); // Default preference
  const { toast } = useToast();

  // State for Edit/Delete Modals
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);


   const fetchData = async () => {
       if (typeof window === 'undefined') {
           setIsLoading(false);
           setError("Transaction data can only be loaded on the client.");
           return;
       }

      setIsLoading(true);
      setError(null);
      try {
        // 1. Get Preferences
        const prefs = getUserPreferences();
        setPreferredCurrency(prefs.preferredCurrency);

        // 2. Fetch Accounts
        const fetchedAccounts = await getAccounts();
        setAccounts(fetchedAccounts);

         // 3. Fetch Categories
        const fetchedCategories = await getCategories();
        setCategories(fetchedCategories);

        // 4. Fetch Tags
        const fetchedTags = await getTags();
        setTags(fetchedTags);

        // 5. Fetch Transactions for *all* accounts with a limit
        const transactionPromises = fetchedAccounts.map(acc => getTransactions(acc.id, { limit: INITIAL_TRANSACTION_LIMIT }));
        const transactionsByAccount = await Promise.all(transactionPromises);
        const combinedTransactions = transactionsByAccount.flat();

        // Sort transactions by date (newest first)
        combinedTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

         setAllTransactions(combinedTransactions);

      } catch (err) {
        console.error("Failed to fetch transaction data:", err);
        setError("Could not load transaction data. Please try again later.");
          toast({
            title: "Error",
            description: "Failed to load required data.",
            variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

  // Fetch data on mount and listen for storage changes
  useEffect(() => {
    let isMounted = true;
    fetchData();

     const handleStorageChange = (event: StorageEvent) => {
         // Check for accounts, preferences, categories, or tags changes
         if (typeof window !== 'undefined' && ['userAccounts', 'userPreferences', 'userCategories', 'userTags'].includes(event.key || '')) {
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
  // Spending chart might need all transactions, consider fetching them separately or accepting the limit
  const spendingData = useMemo(() => {
      if (isLoading || !accounts.length || !allTransactions.length) return [];

      const categoryTotals: { [key: string]: number } = {};

      allTransactions.forEach(tx => {
          if (tx.amount < 0) { // Only consider expenses for spending chart
              const account = accounts.find(acc => acc.id === tx.accountId);
              if (account) {
                 // Convert absolute value of expense to preferred currency
                 const convertedAmount = convertCurrency(Math.abs(tx.amount), account.currency, preferredCurrency);
                 const category = tx.category || 'Uncategorized'; // Use category name directly
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

   // --- Edit and Delete Handlers ---
    const openEditDialog = (transaction: Transaction) => {
        setSelectedTransaction(transaction);
        setIsEditDialogOpen(true);
    };

    // Changed parameter type to match form data for type safety
    const handleUpdateTransaction = async (formData: AddTransactionFormData) => {
        if (!selectedTransaction) return;

        // Ensure formData corresponds to an expense or income, not transfer
        if (formData.type === 'transfer') {
            console.error("Update handler received transfer data. This should not happen.");
            toast({ title: "Update Error", description: "Cannot update transaction type to transfer.", variant: "destructive" });
            return;
        }

        // Determine amount based on type from form data
        const transactionAmount = formData.type === 'expense' ? -Math.abs(formData.amount) : Math.abs(formData.amount);

        const transactionToUpdate: Transaction = {
            ...selectedTransaction,
            amount: transactionAmount,
            date: format(formData.date, 'yyyy-MM-dd'),
            description: formData.description || selectedTransaction.description,
            category: formData.category || selectedTransaction.category,
            tags: formData.tags || [],
        };

        setIsLoading(true);
        try {
            await updateTransaction(transactionToUpdate);
            await fetchData();
            setIsEditDialogOpen(false);
            setSelectedTransaction(null);
            toast({
                title: "Success",
                description: `Transaction "${transactionToUpdate.description}" updated.`,
            });
        } catch (err: any) {
            console.error("Failed to update transaction:", err);
            toast({
                title: "Error Updating Transaction",
                description: err.message || "Could not update the transaction.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };


   const openDeleteDialog = (transaction: Transaction) => {
      setSelectedTransaction(transaction);
   };

    const handleDeleteTransactionConfirm = async () => {
       if (!selectedTransaction) return;
       setIsDeleting(true);
       try {
           await deleteTransaction(selectedTransaction.id, selectedTransaction.accountId);
           await fetchData();
           toast({
               title: "Transaction Deleted",
               description: `Transaction "${selectedTransaction.description}" removed.`,
           });
       } catch (err: any) {
           console.error("Failed to delete transaction:", err);
           toast({
               title: "Error Deleting Transaction",
               description: err.message || "Could not delete the transaction.",
               variant: "destructive",
           });
       } finally {
           setIsDeleting(false);
           setSelectedTransaction(null);
       }
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
                   <CardDescription>Breakdown of expenses across all accounts (based on recent transactions).</CardDescription>
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
          <CardTitle>Recent Transactions</CardTitle>
           <CardDescription>
                {/* Update description to reflect display currency */}
                Showing the latest {INITIAL_TRANSACTION_LIMIT} transactions across all accounts. Amounts displayed in {preferredCurrency}.
           </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && allTransactions.length === 0 ? ( // Show skeleton only on initial load
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
                  <TableHead>Tags</TableHead> {/* Added Tags Header */}
                  <TableHead className="text-right">Amount ({preferredCurrency})</TableHead>
                  <TableHead className="text-right">Actions</TableHead> {/* Actions Header */}
                </TableRow>
              </TableHeader>
              <TableBody>
                {allTransactions.map((transaction) => {
                    const account = getAccountForTransaction(transaction.accountId);
                    if (!account) return null; // Should not happen if data is consistent

                    // Use getCategoryStyle from the categories service
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
                                    {/* Render the icon component */}
                                    <CategoryIcon />
                                    <span className="capitalize">{transaction.category || 'Uncategorized'}</span>
                                </Badge>
                            </TableCell>
                            {/* Tags Cell */}
                            <TableCell>
                                <div className="flex flex-wrap gap-1">
                                    {transaction.tags?.map(tag => {
                                        const { color: tagColor } = getTagStyle(tag);
                                        return (
                                            <Badge key={tag} variant="outline" className={`text-xs px-1.5 py-0.5 ${tagColor}`}>
                                                {tag}
                                            </Badge>
                                        );
                                    })}
                                </div>
                            </TableCell>
                            <TableCell className={`text-right font-medium ${transaction.amount >= 0 ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                                {formattedAmount}
                            </TableCell>
                             {/* Actions Cell */}
                            <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                      <span className="sr-only">Open menu</span>
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => openEditDialog(transaction)}>
                                      <Edit className="mr-2 h-4 w-4" />
                                      <span>Edit</span>
                                    </DropdownMenuItem>
                                     {/* Use AlertDialog for Delete Confirmation */}
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                             <div
                                                className="relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-destructive/10 focus:text-destructive text-destructive data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                                                onClick={() => openDeleteDialog(transaction)}
                                            >
                                                 <Trash2 className="mr-2 h-4 w-4" />
                                                 <span>Delete</span>
                                            </div>
                                        </AlertDialogTrigger>
                                        {selectedTransaction?.id === transaction.id && (
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                  <AlertDialogDescription>
                                                    This action cannot be undone. This will permanently delete the transaction "{selectedTransaction.description}".
                                                  </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                  <AlertDialogCancel onClick={() => setSelectedTransaction(null)} disabled={isDeleting}>Cancel</AlertDialogCancel>
                                                  <AlertDialogAction onClick={handleDeleteTransactionConfirm} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                                    {isDeleting ? "Deleting..." : "Delete"}
                                                  </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        )}
                                    </AlertDialog>
                                  </DropdownMenuContent>
                                </DropdownMenu>
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
               {/* TODO: Add button to open 'Add Transaction' dialog */}
            </div>
          )}
        </CardContent>
        {/* Optional: Add button in footer to load more transactions */}
         {!isLoading && allTransactions.length > 0 && (
             <CardContent className="pt-4 border-t">
                  {/* Placeholder for Load More button */}
                  {/* <Button variant="outline" disabled>Load More (Coming Soon)</Button> */}
             </CardContent>
         )}
      </Card>

        {/* Edit Transaction Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
            setIsEditDialogOpen(open);
            if (!open) setSelectedTransaction(null);
        }}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Edit Transaction</DialogTitle>
                    <DialogDescription>
                        Modify the details of the transaction.
                    </DialogDescription>
                </DialogHeader>
                {/* Pass selected transaction, accounts, categories, and tags to the form */}
                {selectedTransaction && accounts.length > 0 && categories.length > 0 && tags.length > 0 && (
                    <AddTransactionForm
                        accounts={accounts}
                        categories={categories}
                        tags={tags} // Pass tags
                        onTransactionAdded={handleUpdateTransaction} // Use the update handler
                        isLoading={isLoading} // Pass loading state
                        // Pre-fill the form with selectedTransaction data
                        initialData={{
                            type: selectedTransaction.amount < 0 ? 'expense' : 'income',
                            accountId: selectedTransaction.accountId,
                            amount: Math.abs(selectedTransaction.amount),
                            // Parse the date string into a Date object
                            date: selectedTransaction.date ? new Date(selectedTransaction.date.includes('T') ? selectedTransaction.date : selectedTransaction.date + 'T00:00:00Z') : new Date(),
                            category: selectedTransaction.category,
                            description: selectedTransaction.description,
                            tags: selectedTransaction.tags || [] // Pass existing tags
                        }}
                    />
                )}
                {!selectedTransaction && (
                     <p className="text-muted-foreground text-center p-4">Loading transaction data...</p>
                 )}
                  {(accounts.length === 0 || categories.length === 0 || tags.length === 0) && (
                     <p className="text-destructive text-center p-4">Cannot edit transaction: Missing account, category, or tag data.</p>
                 )}
            </DialogContent>
        </Dialog>

       {/* TODO: Add the 'Add Transaction' Dialog component here */}
       {/* <AddTransactionDialog accounts={accounts} categories={categories} tags={tags} /> */}
    </div>
  );
}
