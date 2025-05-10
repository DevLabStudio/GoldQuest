'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAccounts, type Account } from "@/services/account-sync";
import { getTransactions, deleteTransaction, type Transaction, addTransaction } from "@/services/transactions";
import { getCategories, Category } from '@/services/categories'; 
import { getTags, Tag } from '@/services/tags'; 
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/currency';
import { getUserPreferences } from '@/lib/preferences';
import { format, parseISO } from 'date-fns';
import { MoreHorizontal, Edit, Trash2, PlusCircle, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight as TransferIconOriginal, ChevronDown } from 'lucide-react'; // Renamed TransferIcon
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import AddTransactionForm from '@/components/transactions/add-transaction-form';
import MonthlySummarySidebar from '@/components/transactions/monthly-summary-sidebar';

const INITIAL_TRANSACTION_LIMIT = 50;

const formatDate = (dateString: string): string => {
    try {
        const date = parseISO(dateString.includes('T') ? dateString : dateString + 'T00:00:00Z');
        if (isNaN(date.getTime())) throw new Error('Invalid date');
        return format(date, 'MMM do, yyyy');
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

  const [selectedTransactionPair, setSelectedTransactionPair] = useState<Transaction[] | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingTransferPair, setEditingTransferPair] = useState<{from: Transaction, to: Transaction} | null>(null);


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
        tx => tx.category?.toLowerCase() === 'transfer' // Stricter check for 'transfer' category
    );

    potentialTransfers.forEach(txOut => {
      if (txOut.amount < 0 && !processedIds.has(txOut.id)) { // txOut is the outgoing leg
        const txIn = potentialTransfers.find(tx =>
          tx.amount === -txOut.amount && // txIn is the incoming leg, amount is positive opposite
          tx.accountId !== txOut.accountId && // Different accounts
          !processedIds.has(tx.id) &&
          tx.date === txOut.date && // Same date
          // Descriptions might be slightly different due to "Transfer to X" vs "Transfer from Y"
          // So, make this check more lenient or base it on a shared identifier if available
          (tx.description === txOut.description || 
           tx.description?.includes(getAccountName(txOut.accountId)) && txOut.description?.includes(getAccountName(tx.accountId)) ||
           (tx.description?.startsWith("Transfer") && txOut.description?.startsWith("Transfer")))
        );

        if (txIn) {
          transfers.push({ from: txOut, to: txIn });
          processedIds.add(txOut.id);
          processedIds.add(txIn.id);
        }
      }
    });

    return transfers.sort((a, b) => new Date(b.from.date).getTime() - new Date(a.from.date).getTime());
  }, [allTransactions, accounts]); // Added accounts to dependency array for getAccountName

   const getAccountName = (accountId: string): string => {
        return accounts.find(acc => acc.id === accountId)?.name || 'Unknown Account';
   };

    const openEditDialog = (transferPair: { from: Transaction, to: Transaction }) => {
        setEditingTransferPair(transferPair);
        setTransactionTypeToAdd('transfer');
        setIsAddTransactionDialogOpen(true);
        // Note: The AddTransactionForm will need logic to handle the 'editingTransferPair'
        // This means it would pre-fill 'fromAccount', 'toAccount', 'amount', 'date', 'description', 'tags'
        // And the submit handler for transfers would need to:
        // 1. Delete the old pair (editingTransferPair.from.id, editingTransferPair.to.id)
        // 2. Add the new pair based on form values
        toast({title: "Edit Transfer", description: "Modify transfer details. This will delete the old transfer and create a new one.", variant: "default", duration: 7000});
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

  const handleTransactionAdded = async (data: Omit<Transaction, 'id'> | Transaction) => { // Allow Transaction for updates
    try {
      if ('id' in data && data.id && editingTransferPair) { // Check if it's an update context for a transfer
        // This means we are "updating" a transfer, which involves deleting old and adding new
        // The new transfer data comes from the form, which should be passed to handleTransferAdded
        console.warn("handleTransactionAdded called in edit transfer context. This should ideally go to a specific transfer update handler or onTransferAdded.");
        // For now, we assume that if we are here, it's not an actual transfer update scenario
        // or that the form correctly calls onTransferAdded.
        // If we *must* handle it here, we'd need to ensure `data` has from/to accountId etc.
         toast({title: "Update Logic", description: "Transfer updates should be handled by onTransferAdded.", variant: "destructive"})
      } else if (!('id' in data)) { // It's a new non-transfer transaction
        await addTransaction(data as Omit<Transaction, 'id'>);
        toast({ title: "Success", description: `${data.amount > 0 ? 'Income' : 'Expense'} added successfully.` });
      }
      await localFetchData();
      setIsAddTransactionDialogOpen(false);
      setEditingTransferPair(null); // Clear editing state
    } catch (error: any) {
      console.error("Failed to add/update transaction:", error);
      toast({ title: "Error", description: `Could not add/update transaction: ${error.message}`, variant: "destructive" });
    }
  };

  const handleTransferAdded = async (data: { fromAccountId: string; toAccountId: string; amount: number; date: Date; description?: string; tags?: string[] }) => {
    setIsLoading(true);
    try {
       // If we are editing a transfer, delete the old one first
       if (editingTransferPair) {
           console.log("Deleting old transfer pair before adding updated one:", editingTransferPair);
           await deleteTransaction(editingTransferPair.from.id, editingTransferPair.from.accountId);
           await deleteTransaction(editingTransferPair.to.id, editingTransferPair.to.accountId);
           console.log("Old transfer pair deleted.");
       }

      const transferAmount = Math.abs(data.amount);
      const formattedDate = format(data.date, 'yyyy-MM-dd');
      const fromAccountName = accounts.find(a=>a.id === data.fromAccountId)?.name || 'Unknown';
      const toAccountName = accounts.find(a=>a.id === data.toAccountId)?.name || 'Unknown';
      const desc = data.description || `Transfer from ${fromAccountName} to ${toAccountName}`;

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

      toast({ title: "Success", description: `Transfer ${editingTransferPair ? 'updated' : 'recorded'} successfully.` });
      await localFetchData();
      setIsAddTransactionDialogOpen(false);
      setEditingTransferPair(null); // Clear editing state
    } catch (error: any) {
      console.error("Failed to add/update transfer:", error);
      toast({ title: "Error", description: `Could not record transfer: ${error.message}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const openAddTransactionDialog = (type: 'expense' | 'income' | 'transfer') => {
    if (accounts.length === 0 && type !== 'transfer') { // Allow opening for transfer even with 0 accounts to show error
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
        return; // Still show dialog but form will likely be problematic or show this error again
    }
    setTransactionTypeToAdd(type);
    setEditingTransferPair(null); // Ensure we are not in edit mode when adding new
    setIsAddTransactionDialogOpen(true);
  };

  const initialFormDataForEdit = useMemo(() => {
    if (editingTransferPair && transactionTypeToAdd === 'transfer') {
        return {
            type: 'transfer' as 'transfer',
            fromAccountId: editingTransferPair.from.accountId,
            toAccountId: editingTransferPair.to.accountId,
            amount: Math.abs(editingTransferPair.from.amount),
            date: parseISO(editingTransferPair.from.date.includes('T') ? editingTransferPair.from.date : editingTransferPair.from.date + 'T00:00:00Z'),
            description: editingTransferPair.from.description,
            tags: editingTransferPair.from.tags || [],
        };
    }
    return undefined;
  }, [editingTransferPair, transactionTypeToAdd]);


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
                <TransferIconOriginal className="mr-2 h-4 w-4" />
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

        <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-grow">
                <Card>
                    <CardHeader>
                         <div className="flex justify-between items-center">
                            <div>
                                <CardTitle>All Transfers</CardTitle>
                                <CardDescription>
                                    Transfers between {format(new Date(2024,0,1), 'MMM do, yyyy')} and {format(new Date(2024,11,31), 'MMM do, yyyy')} {/* Placeholder dates */}
                                </CardDescription>
                            </div>
                             <Button variant="default" size="sm" onClick={() => openAddTransactionDialog('transfer')}>
                                <TransferIconOriginal className="mr-2 h-4 w-4" /> Create new transfer
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                    {isLoading && transferTransactionPairs.length === 0 ? (
                        <div className="space-y-2">
                        {[...Array(3)].map((_, i) => (
                            <Skeleton key={i} className="h-12 w-full" />
                        ))}
                        </div>
                    ) : transferTransactionPairs.length > 0 ? (
                        <Table>
                        <TableHeader>
                            <TableRow>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>From Account</TableHead>
                            <TableHead>To Account</TableHead>
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
                                        <TableCell className="font-medium">{pair.from.description || 'Transfer'}</TableCell>
                                        <TableCell className="text-right font-medium">
                                            {formattedAmount}
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(pair.from.date)}</TableCell>
                                        <TableCell className="text-muted-foreground">{getAccountName(pair.from.accountId)}</TableCell>
                                        <TableCell className="text-muted-foreground">{getAccountName(pair.to.accountId)}</TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                <span className="sr-only">Open menu</span>
                                                <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => openEditDialog(pair)}>
                                                <Edit className="mr-2 h-4 w-4" />
                                                <span>Edit</span>
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
                         <Button variant="link" className="mt-2 px-0 h-auto text-primary" onClick={() => openAddTransactionDialog('transfer')}>
                            Add your first transfer
                        </Button>
                        </div>
                    )}
                    </CardContent>
                </Card>
            </div>
            <div className="w-full md:w-72 lg:w-80 flex-shrink-0">
                <MonthlySummarySidebar
                    transactions={transferTransactionPairs.flatMap(p => [p.from, p.to])} 
                    accounts={accounts}
                    preferredCurrency={preferredCurrency}
                    transactionType="transfer"
                />
            </div>
        </div>


      <Dialog open={isAddTransactionDialogOpen} onOpenChange={(open) => {
          setIsAddTransactionDialogOpen(open);
          if (!open) setEditingTransferPair(null); // Clear editing state when dialog closes
      }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
                {editingTransferPair ? 'Edit Transfer' : `Add New ${transactionTypeToAdd ? transactionTypeToAdd.charAt(0).toUpperCase() + transactionTypeToAdd.slice(1) : 'Transaction'}`}
            </DialogTitle>
            <DialogDescription>
              {editingTransferPair ? 'Modify the details of your transfer.' : `Enter the details for your new ${transactionTypeToAdd || 'transaction'}.`}
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
              initialData={initialFormDataForEdit}
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
