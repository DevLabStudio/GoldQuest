
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAccounts, type Account } from "@/services/account-sync";
import { getTransactions, updateTransaction, deleteTransaction, type Transaction } from "@/services/transactions.tsx"; // Import transaction services
import { getCategories, getCategoryStyle, Category } from '@/services/categories.tsx'; // Import category services
import { getTags, type Tag, getTagStyle } from '@/services/tags.tsx'; // Import tag service with .tsx
import { Badge } from "@/components/ui/badge";
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/currency';
import { getUserPreferences } from '@/lib/preferences';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Edit, Trash2, MoreHorizontal } from 'lucide-react';
import AddTransactionForm from '@/components/transactions/add-transaction-form'; // For editing
import { useToast } from '@/hooks/use-toast';


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
  const [categories, setCategories] = useState<Category[]>([]); // State for categories
  const [tags, setTags] = useState<Tag[]>([]); // State for tags
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preferredCurrency, setPreferredCurrency] = useState('BRL');
  const { toast } = useToast();

  // State for Edit/Delete Modals
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);


   const fetchData = async () => {
       if (typeof window === 'undefined') {
           setIsLoading(false);
           setError("Revenue data can only be loaded on the client.");
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

        // 5. Fetch Transactions for *all* accounts
        const transactionPromises = fetchedAccounts.map(acc => getTransactions(acc.id));
        const transactionsByAccount = await Promise.all(transactionPromises);
        const combinedTransactions = transactionsByAccount.flat();

        // Sort transactions by date (newest first)
        combinedTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        setAllTransactions(combinedTransactions);

      } catch (err) {
        console.error("Failed to fetch revenue data:", err);
        setError("Could not load revenue data. Please try again later.");
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
         if (typeof window !== 'undefined' && ['userAccounts', 'userPreferences', 'userCategories', 'userTags'].includes(event.key || '')) {
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

    // --- Edit and Delete Handlers ---
    const openEditDialog = (transaction: Transaction) => {
        setSelectedTransaction(transaction);
        setIsEditDialogOpen(true);
    };

    const handleUpdateTransaction = async (updatedData: Omit<Transaction, 'id'> | Transaction) => {
        if (!selectedTransaction) return; // Should have a selected transaction

        const transactionToUpdate: Transaction = {
            ...selectedTransaction,
            ...updatedData,
            date: updatedData.date instanceof Date ? format(updatedData.date, 'yyyy-MM-dd') : updatedData.date,
            tags: updatedData.tags || [], // Ensure tags is an array
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
          {isLoading && incomeTransactions.length === 0 ? ( // Show skeleton only on initial load
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
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
                  <TableHead>Tags</TableHead> {/* Added Tags Header */}
                  <TableHead className="text-right">Amount ({preferredCurrency})</TableHead>
                   <TableHead className="text-right">Actions</TableHead> {/* Actions Header */}
                </TableRow>
              </TableHeader>
              <TableBody>
                {incomeTransactions.map((transaction) => {
                    const account = getAccountForTransaction(transaction.accountId);
                    if (!account) return null;

                    const { icon: CategoryIcon, color } = getCategoryStyle(transaction.category);
                    const formattedAmount = formatCurrency(transaction.amount, account.currency, undefined, true); // Convert to preferred

                    return (
                        <TableRow key={transaction.id} className="hover:bg-muted/50">
                            <TableCell className="whitespace-nowrap">{formatDate(transaction.date)}</TableCell>
                            <TableCell className="text-muted-foreground">{account.name}</TableCell>
                            <TableCell>{transaction.description}</TableCell>
                            <TableCell>
                                {/* Apply the color class here */}
                                <Badge variant="outline" className={`flex items-center gap-1 ${color} border`}>
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
                            <TableCell className={`text-right font-medium text-green-500 dark:text-green-400`}>
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
                  {/* Example: <AddTransactionButton accounts={accounts} categories={categories} tags={tags} onTransactionAdded={handleAddTransaction} isLoading={isLoading}/> */}
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
                {/* Pass selected transaction, accounts, categories, and tags */}
                {selectedTransaction && accounts.length > 0 && categories.length > 0 && tags.length > 0 && (
                    <AddTransactionForm
                        accounts={accounts}
                        categories={categories}
                        tags={tags} // Pass tags
                        onTransactionAdded={handleUpdateTransaction}
                        isLoading={isLoading}
                        initialData={{
                            type: selectedTransaction.amount < 0 ? 'expense' : 'income',
                            accountId: selectedTransaction.accountId,
                            amount: Math.abs(selectedTransaction.amount),
                            date: selectedTransaction.date,
                            category: selectedTransaction.category,
                            description: selectedTransaction.description,
                            tags: selectedTransaction.tags || []
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

      {/* Future: Could add income charts or summaries here */}
    </div>
  );
}
