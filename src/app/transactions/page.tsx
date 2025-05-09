
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAccounts, type Account } from "@/services/account-sync";
import { getTransactions, updateTransaction, deleteTransaction, type Transaction, addTransaction } from "@/services/transactions";
import { getCategories, getCategoryStyle, Category } from '@/services/categories';
import { getTags, type Tag, getTagStyle } from '@/services/tags';
import { Badge } from "@/components/ui/badge";
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, convertCurrency } from '@/lib/currency';
import { getUserPreferences } from '@/lib/preferences';
import SpendingChart from '@/components/dashboard/spending-chart';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Edit, Trash2, MoreHorizontal, PlusCircle, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight as TransferIcon, ChevronDown } from 'lucide-react';
import AddTransactionForm from '@/components/transactions/add-transaction-form';
import { useToast } from '@/hooks/use-toast';
import type { AddTransactionFormData } from '@/components/transactions/add-transaction-form';

// Define the initial limit for transactions
const INITIAL_TRANSACTION_LIMIT = 50;

// Helper function to format date (consistent with previous implementation)
const formatDate = (dateString: string): string => {
    try {
        const date = new Date(dateString.includes('T') ? dateString : dateString + 'T00:00:00Z');
        if (isNaN(date.getTime())) throw new Error('Invalid date');
        return format(date, 'PP');
    } catch (error) {
        console.error("Error formatting date:", dateString, error);
        return 'Invalid Date';
    }
};


export default function TransactionsOverviewPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preferredCurrency, setPreferredCurrency] = useState('BRL');
  const { toast } = useToast();

  const [isAddTransactionDialogOpen, setIsAddTransactionDialogOpen] = useState(false);
  const [transactionTypeToAdd, setTransactionTypeToAdd] = useState<'expense' | 'income' | 'transfer' | null>(null);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
        if (typeof window === 'undefined') {
            if(isMounted) setIsLoading(false);
            if(isMounted) setError("Transaction data can only be loaded on the client.");
            return;
        }

        if(isMounted) setIsLoading(true);
        if(isMounted) setError(null);
        try {
            const prefs = getUserPreferences();
            if(isMounted) setPreferredCurrency(prefs.preferredCurrency);

            const [fetchedAccounts, fetchedCategories, fetchedTags] = await Promise.all([
                getAccounts(),
                getCategories(),
                getTags()
            ]);

            if(isMounted) setAccounts(fetchedAccounts);
            if(isMounted) setCategories(fetchedCategories);
            if(isMounted) setTags(fetchedTags);

            if (fetchedAccounts.length > 0) {
                const transactionPromises = fetchedAccounts.map(acc => getTransactions(acc.id, { limit: INITIAL_TRANSACTION_LIMIT }));
                const transactionsByAccount = await Promise.all(transactionPromises);
                const combinedTransactions = transactionsByAccount.flat();
                combinedTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                if(isMounted) setAllTransactions(combinedTransactions);
            } else {
                if(isMounted) setAllTransactions([]);
            }

        } catch (err) {
            console.error("Failed to fetch transaction data:", err);
            if(isMounted) setError("Could not load transaction data. Please try again later.");
            if(isMounted) toast({
                title: "Error",
                description: "Failed to load required data.",
                variant: "destructive",
            });
        } finally {
            if(isMounted) setIsLoading(false);
        }
    };

    fetchData();

    const handleStorageChange = (event: StorageEvent) => {
        if (typeof window !== 'undefined' && ['userAccounts', 'userPreferences', 'userCategories', 'userTags', 'transactions-'].some(key => event.key?.includes(key)) && isMounted) {
            console.log("Storage changed, refetching transaction overview data...");
            fetchData();
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
  }, [toast]);

  const spendingData = useMemo(() => {
      if (isLoading || !accounts.length || !allTransactions.length) return [];

      const categoryTotals: { [key: string]: number } = {};

      allTransactions.forEach(tx => {
          if (tx.amount < 0) {
              const account = accounts.find(acc => acc.id === tx.accountId);
              if (account) {
                 const convertedAmount = convertCurrency(Math.abs(tx.amount), account.currency, preferredCurrency);
                 const category = tx.category || 'Uncategorized';
                 categoryTotals[category] = (categoryTotals[category] || 0) + convertedAmount;
              }
          }
      });

      return Object.entries(categoryTotals)
          .map(([category, amount]) => ({ category: category.charAt(0).toUpperCase() + category.slice(1), amount }))
          .sort((a, b) => b.amount - a.amount);

  }, [allTransactions, accounts, preferredCurrency, isLoading]);


   const getAccountForTransaction = (accountId: string): Account | undefined => {
        return accounts.find(acc => acc.id === accountId);
   };

    const localFetchData = async () => {
        if (typeof window === 'undefined') return;
        setIsLoading(true); setError(null);
        try {
            const prefs = getUserPreferences(); setPreferredCurrency(prefs.preferredCurrency);
            const [fetchedAccounts, fetchedCategories, fetchedTags] = await Promise.all([ getAccounts(), getCategories(), getTags() ]);
            setAccounts(fetchedAccounts); setCategories(fetchedCategories); setTags(fetchedTags);
            if (fetchedAccounts.length > 0) {
                const tPromises = fetchedAccounts.map(acc => getTransactions(acc.id, { limit: INITIAL_TRANSACTION_LIMIT }));
                const txsByAcc = await Promise.all(tPromises);
                const combinedTxs = txsByAcc.flat();
                combinedTxs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                setAllTransactions(combinedTxs);
            } else { setAllTransactions([]); }
        } catch (e) { console.error(e); setError("Could not reload transaction data."); toast({title: "Error", description: "Failed to reload data.", variant: "destructive"});}
        finally { setIsLoading(false); }
    };


    const openEditDialog = (transaction: Transaction) => {
        setSelectedTransaction(transaction);
        setIsEditDialogOpen(true);
    };

    const handleUpdateTransaction = async (formData: AddTransactionFormData) => {
        if (!selectedTransaction) return;

        if (formData.type === 'transfer') {
            console.error("Update handler received transfer data. This should not happen.");
            toast({ title: "Update Error", description: "Cannot update transaction type to transfer.", variant: "destructive" });
            return;
        }

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
            await localFetchData();
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
           await localFetchData();
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

  const handleTransactionAdded = async (data: Omit<Transaction, 'id'>) => {
    try {
      await addTransaction(data);
      toast({ title: "Success", description: `${data.amount > 0 ? 'Income' : 'Expense'} added successfully.` });
      await localFetchData();
      setIsAddTransactionDialogOpen(false);
    } catch (error: any) {
      console.error("Failed to add transaction:", error);
      toast({ title: "Error", description: `Could not add transaction: ${error.message}`, variant: "destructive" });
    }
  };

  const handleTransferAdded = async (data: { fromAccountId: string; toAccountId: string; amount: number; date: Date; description?: string; tags?: string[] }) => {
    try {
      const transferAmount = Math.abs(data.amount);
      const formattedDate = format(data.date, 'yyyy-MM-dd');
      const desc = data.description || `Transfer from ${accounts.find(a=>a.id === data.fromAccountId)?.name} to ${accounts.find(a=>a.id === data.toAccountId)?.name}`;

      await addTransaction({
        accountId: data.fromAccountId,
        amount: -transferAmount,
        date: formattedDate,
        description: desc,
        category: 'Transfer',
        tags: data.tags || [],
      });

      await addTransaction({
        accountId: data.toAccountId,
        amount: transferAmount,
        date: formattedDate,
        description: desc,
        category: 'Transfer',
        tags: data.tags || [],
      });

      toast({ title: "Success", description: "Transfer recorded successfully." });
      await localFetchData();
      setIsAddTransactionDialogOpen(false);
    } catch (error: any) {
      console.error("Failed to add transfer:", error);
      toast({ title: "Error", description: `Could not record transfer: ${error.message}`, variant: "destructive" });
    }
  };

  const openAddTransactionDialog = (type: 'expense' | 'income' | 'transfer') => {
    if (accounts.length === 0) {
        toast({
            title: "No Accounts",
            description: "Please add an account first before adding transactions.",
            variant: "destructive",
        });
        return;
    }
    if (type === 'transfer' && accounts.length < 2) {
        toast({
            title: "Not Enough Accounts for Transfer",
            description: "You need at least two accounts to make a transfer.",
            variant: "destructive",
        });
        return;
    }
    setTransactionTypeToAdd(type);
    setIsAddTransactionDialogOpen(true);
  };

  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Transactions Overview</h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="default" size="sm">
              <PlusCircle className="mr-2 h-4 w-4" />
              Add New Transaction
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openAddTransactionDialog('expense')}>
              <ArrowDownCircle className="mr-2 h-4 w-4" />
              Add Spend
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openAddTransactionDialog('income')}>
              <ArrowUpCircle className="mr-2 h-4 w-4" />
              Add Income
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openAddTransactionDialog('transfer')}>
              <TransferIcon className="mr-2 h-4 w-4" />
              Add Transfer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

       {error && (
          <div className="mb-4 p-4 bg-destructive/10 text-destructive border border-destructive rounded-md">
              {error}
          </div>
       )}

       <div className="mb-8">
           <Card>
               <CardHeader>
                   <CardTitle>Spending by Category ({preferredCurrency})</CardTitle>
                   <CardDescription>Breakdown of expenses across all accounts (based on recent transactions).</CardDescription>
               </CardHeader>
               <CardContent className="h-80">
                 {isLoading ? (
                     <Skeleton className="h-full w-full" />
                 ) : spendingData.length > 0 ? (
                    <SpendingChart data={spendingData} currency={preferredCurrency} />
                 ) : (
                     <div className="flex h-full items-center justify-center text-muted-foreground">
                         No spending data available to display chart.
                     </div>
                 )}
               </CardContent>
           </Card>
       </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
           <CardDescription>
                Showing the latest {INITIAL_TRANSACTION_LIMIT} transactions across all accounts. Amounts displayed in {preferredCurrency}.
           </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && allTransactions.length === 0 ? (
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
                  <TableHead>Tags</TableHead>
                  <TableHead className="text-right">Amount ({preferredCurrency})</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allTransactions.map((transaction) => {
                    const account = getAccountForTransaction(transaction.accountId);
                    if (!account) return null;

                    const { icon: CategoryIcon, color } = getCategoryStyle(transaction.category);
                    const formattedAmount = formatCurrency(transaction.amount, account.currency, undefined, true);
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
            </div>
          )}
        </CardContent>
         {!isLoading && allTransactions.length > 0 && (
             <CardContent className="pt-4 border-t">
             </CardContent>
         )}
      </Card>

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
                {selectedTransaction && accounts.length > 0 && categories.length > 0 && tags.length > 0 && (
                    <AddTransactionForm
                        accounts={accounts}
                        categories={categories}
                        tags={tags}
                        onTransactionAdded={handleUpdateTransaction}
                        isLoading={isLoading}
                        initialData={{
                            type: selectedTransaction.amount < 0 ? 'expense' : 'income',
                            accountId: selectedTransaction.accountId,
                            amount: Math.abs(selectedTransaction.amount),
                            date: selectedTransaction.date ? new Date(selectedTransaction.date.includes('T') ? selectedTransaction.date : selectedTransaction.date + 'T00:00:00Z') : new Date(),
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

       {/* Add Transaction Dialog */}
       <Dialog open={isAddTransactionDialogOpen} onOpenChange={setIsAddTransactionDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Add New {transactionTypeToAdd ? transactionTypeToAdd.charAt(0).toUpperCase() + transactionTypeToAdd.slice(1) : 'Transaction'}</DialogTitle>
            <DialogDescription>
              Enter the details for your new {transactionTypeToAdd || 'transaction'}.
            </DialogDescription>
          </DialogHeader>
          {accounts.length > 0 && categories.length > 0 && tags.length > 0 && transactionTypeToAdd && (
            <AddTransactionForm
              accounts={accounts}
              categories={categories}
              tags={tags}
              onTransactionAdded={handleTransactionAdded}
              onTransferAdded={handleTransferAdded}
              isLoading={isLoading}
              initialType={transactionTypeToAdd}
            />
          )}
           {(accounts.length === 0 || categories.length === 0 || tags.length === 0) && !isLoading && (
               <div className="py-4 text-center text-muted-foreground">
                 Please ensure you have at least one account, category, and tag set up before adding transactions.
                   You can manage these in the 'Accounts', 'Categories', and 'Tags' pages.
               </div>
            )}
             {isLoading && <Skeleton className="h-40 w-full" /> }
        </DialogContent>
      </Dialog>
    </div>
  );
}
