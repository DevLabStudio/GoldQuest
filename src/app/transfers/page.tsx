
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAccounts, type Account } from "@/services/account-sync";
import { getTransactions, deleteTransaction, type Transaction, updateTransaction, addTransaction } from "@/services/transactions";
import { getCategories, Category } from '@/services/categories'; // Import categories for AddTransactionForm
import { getTags, Tag } from '@/services/tags'; // Import tags for AddTransactionForm
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/currency';
import { getUserPreferences } from '@/lib/preferences';
import { format } from 'date-fns';
import { ArrowRightLeft, MoreHorizontal, Edit, Trash2, PlusCircle, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight as TransferIcon, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import AddTransactionForm from '@/components/transactions/add-transaction-form';
// import type { AddTransactionFormData } from '@/components/transactions/add-transaction-form';

// Define the initial limit for transactions
const INITIAL_TRANSACTION_LIMIT = 50;

// Helper function to format date
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

export default function TransfersPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preferredCurrency, setPreferredCurrency] = useState('BRL');
  const { toast } = useToast();

  const [isAddTransactionDialogOpen, setIsAddTransactionDialogOpen] = useState(false);
  const [transactionTypeToAdd, setTransactionTypeToAdd] = useState<'expense' | 'income' | 'transfer' | null>(null);

  // State for Edit/Delete Modals
  const [selectedTransactionPair, setSelectedTransactionPair] = useState<Transaction[] | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);


  // Fetch data on mount and listen for storage changes
  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
       if (typeof window === 'undefined') {
         if (isMounted) {
           setIsLoading(false);
           setError("Transfer data can only be loaded on the client.");
         }
         return;
       }

      if (isMounted) setIsLoading(true);
      if (isMounted) setError(null);
      try {
        const prefs = getUserPreferences();
        if (isMounted) setPreferredCurrency(prefs.preferredCurrency);

        const [fetchedAccounts, fetchedCategories, fetchedTags] = await Promise.all([
          getAccounts(),
          getCategories(),
          getTags()
        ]);
        if (isMounted) {
          setAccounts(fetchedAccounts);
          setCategories(fetchedCategories);
          setTags(fetchedTags);
        }


        // Fetch transactions with limit
        if (fetchedAccounts.length > 0) {
            const transactionPromises = fetchedAccounts.map(acc => getTransactions(acc.id, { limit: INITIAL_TRANSACTION_LIMIT * 2 }));
            const transactionsByAccount = await Promise.all(transactionPromises);
            const combinedTransactions = transactionsByAccount.flat();
            combinedTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            if (isMounted) setAllTransactions(combinedTransactions);
        } else {
            if(isMounted) setAllTransactions([]);
        }


      } catch (err) {
        console.error("Failed to fetch transfer data:", err);
        if (isMounted) setError("Could not load transfer data. Please try again later.");
        if (isMounted) toast({ title: "Error", description: "Failed to load data.", variant: "destructive" });
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchData();

     const handleStorageChange = (event: StorageEvent) => {
         if (typeof window !== 'undefined' && (event.key === 'userAccounts' || event.key === 'userPreferences' || event.key === 'userCategories' || event.key?.startsWith('transactions-')) && isMounted ) {
             console.log("Storage changed, refetching transfer data...");
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

    const localFetchData = async () => {
        if (typeof window === 'undefined') return;
        setIsLoading(true); setError(null);
        try {
            const prefs = getUserPreferences(); setPreferredCurrency(prefs.preferredCurrency);
            const [fetchedAccounts, fetchedCategories, fetchedTags] = await Promise.all([getAccounts(), getCategories(), getTags()]);
            setAccounts(fetchedAccounts);
            setCategories(fetchedCategories);
            setTags(fetchedTags);
            if (fetchedAccounts.length > 0) {
                const tPromises = fetchedAccounts.map(acc => getTransactions(acc.id, { limit: INITIAL_TRANSACTION_LIMIT * 2 }));
                const txsByAcc = await Promise.all(tPromises);
                const combinedTxs = txsByAcc.flat();
                combinedTxs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                setAllTransactions(combinedTxs);
            } else { setAllTransactions([]); }
        } catch (e) { console.error(e); setError("Could not reload transfer data."); toast({title: "Error", description: "Failed to reload data.", variant: "destructive"});}
        finally { setIsLoading(false); }
    };

  const transferTransactionPairs = useMemo(() => {
    const transfers: { from: Transaction, to: Transaction }[] = [];
    const processedIds = new Set<string>();

    const potentialTransfers = allTransactions.filter(
        tx => tx.category?.toLowerCase() === 'transfer' || tx.description?.toLowerCase().includes('transfer')
    );

    potentialTransfers.forEach(txOut => {
      if (txOut.amount < 0 && !processedIds.has(txOut.id)) {
        const txIn = potentialTransfers.find(tx =>
          tx.amount === -txOut.amount &&
          tx.accountId !== txOut.accountId &&
          !processedIds.has(tx.id) &&
          tx.date === txOut.date &&
          tx.description === txOut.description
        );

        if (txIn) {
          transfers.push({ from: txOut, to: txIn });
          processedIds.add(txOut.id);
          processedIds.add(txIn.id);
        }
      }
    });

    return transfers.sort((a, b) => new Date(b.from.date).getTime() - new Date(a.from.date).getTime());
  }, [allTransactions]);

   const getAccountName = (accountId: string): string => {
        return accounts.find(acc => acc.id === accountId)?.name || 'Unknown Account';
   };

    const openEditDialog = (transferPair: { from: Transaction, to: Transaction }) => {
        toast({ title: "Info", description: "Editing transfers is not yet implemented." });
    };

     const openDeleteDialog = (transferPair: { from: Transaction, to: Transaction }) => {
        setSelectedTransactionPair([transferPair.from, transferPair.to]);
     };

    const handleDeleteTransferConfirm = async () => {
        if (!selectedTransactionPair || selectedTransactionPair.length !== 2) return;
        setIsDeleting(true);
        try {
            await Promise.all([
                deleteTransaction(selectedTransactionPair[0].id, selectedTransactionPair[0].accountId),
                deleteTransaction(selectedTransactionPair[1].id, selectedTransactionPair[1].accountId)
            ]);
             await localFetchData();
             toast({
                title: "Transfer Deleted",
                description: `Transfer record removed successfully.`,
            });
        } catch (err: any) {
            console.error("Failed to delete transfer:", err);
            toast({
                title: "Error Deleting Transfer",
                description: err.message || "Could not delete the transfer transactions.",
                variant: "destructive",
            });
        } finally {
            setIsDeleting(false);
            setSelectedTransactionPair(null);
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
        <h1 className="text-3xl font-bold">Transfers Between Accounts</h1>
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

      <Card>
        <CardHeader>
          <CardTitle>Recent Transfer History</CardTitle>
           <CardDescription>
                Showing recent transfers between your accounts (limited results). Amounts displayed in {preferredCurrency}.
           </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : transferTransactionPairs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>From Account</TableHead>
                  <TableHead>To Account</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount ({preferredCurrency})</TableHead>
                   <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transferTransactionPairs.map((pair) => {
                    const fromAccount = accounts.find(acc => acc.id === pair.from.accountId);
                    if (!fromAccount) return null;

                    const formattedAmount = formatCurrency(Math.abs(pair.from.amount), fromAccount.currency, undefined, true);

                    return (
                        <TableRow key={`${pair.from.id}-${pair.to.id}`} className="hover:bg-muted/50">
                            <TableCell className="whitespace-nowrap">{formatDate(pair.from.date)}</TableCell>
                            <TableCell className="text-muted-foreground">{getAccountName(pair.from.accountId)}</TableCell>
                            <TableCell className="text-muted-foreground">{getAccountName(pair.to.accountId)}</TableCell>
                            <TableCell>{pair.from.description || 'Transfer'}</TableCell>
                            <TableCell className="text-right font-medium">
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
                                    <DropdownMenuItem onClick={() => openEditDialog(pair)} disabled>
                                      <Edit className="mr-2 h-4 w-4" />
                                      <span>Edit (N/A)</span>
                                    </DropdownMenuItem>
                                     <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <div
                                                className="relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-destructive/10 focus:text-destructive text-destructive data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                                                onClick={() => openDeleteDialog(pair)}
                                            >
                                                 <Trash2 className="mr-2 h-4 w-4" />
                                                 <span>Delete</span>
                                            </div>
                                        </AlertDialogTrigger>
                                        {selectedTransactionPair && selectedTransactionPair[0].id === pair.from.id && (
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                  <AlertDialogDescription>
                                                    This action cannot be undone. This will permanently delete both transactions related to this transfer: "{pair.from.description}".
                                                  </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                  <AlertDialogCancel onClick={() => setSelectedTransactionPair(null)} disabled={isDeleting}>Cancel</AlertDialogCancel>
                                                  <AlertDialogAction onClick={handleDeleteTransferConfirm} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                                    {isDeleting ? "Deleting Transfer..." : "Delete Transfer"}
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
                No transfer transactions found yet.
              </p>
            </div>
          )}
        </CardContent>
         {!isLoading && transferTransactionPairs.length > 0 && (
             <CardContent className="pt-4 border-t">
             </CardContent>
         )}
      </Card>

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
