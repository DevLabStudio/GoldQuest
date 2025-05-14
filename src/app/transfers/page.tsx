'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAccounts, type Account } from "@/services/account-sync";
import { getTransactions, deleteTransaction, type Transaction, addTransaction, updateTransaction } from "@/services/transactions";
import { getCategories, Category } from '@/services/categories';
import { getTags, Tag } from '@/services/tags';
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, convertCurrency } from '@/lib/currency';
import { getUserPreferences } from '@/lib/preferences';
import { format as formatDateFns, parseISO, isWithinInterval, isSameDay } from 'date-fns';
import { MoreHorizontal, Edit, Trash2, PlusCircle, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight as TransferIcon, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import AddTransactionForm from '@/components/transactions/add-transaction-form';
import type { AddTransactionFormData } from '@/components/transactions/add-transaction-form';
import MonthlySummarySidebar from '@/components/transactions/monthly-summary-sidebar';
import { useDateRange } from '@/contexts/DateRangeContext';
import Link from 'next/link';

const INITIAL_TRANSACTION_LIMIT = 50;

const formatDate = (dateString: string): string => {
    try {
        const date = parseISO(dateString.includes('T') ? dateString : dateString + 'T00:00:00Z');
        if (isNaN(date.getTime())) throw new Error('Invalid date');
        return formatDateFns(date, 'MMM do, yyyy');
    } catch (error) {
        console.error("Error formatting date:", dateString, error);
        return 'Invalid Date';
    }
};

export default function TransfersPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [allTransactionsUnfiltered, setAllTransactionsUnfiltered] = useState<Transaction[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preferredCurrency, setPreferredCurrency] = useState('BRL');
  const { toast } = useToast();
  const { selectedDateRange } = useDateRange();

  const [isAddTransactionDialogOpen, setIsAddTransactionDialogOpen] = useState(false);
  const [transactionTypeToAdd, setTransactionTypeToAdd] = useState<'expense' | 'income' | 'transfer' | null>(null);

  const [selectedTransactionPair, setSelectedTransactionPair] = useState<Transaction[] | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingTransferPair, setEditingTransferPair] = useState<{from: Transaction, to: Transaction} | null>(null);


  const fetchData = useCallback(async () => {
    if (typeof window === 'undefined') {
        setIsLoading(false);
        setError("Transfer data can only be loaded on the client.");
        return;
    }

    setIsLoading(true);
    setError(null);
    try {
    const prefs = await getUserPreferences();
    setPreferredCurrency(prefs.preferredCurrency);

    const [fetchedAccounts, fetchedCategories, fetchedTags] = await Promise.all([
        getAccounts(),
        getCategories(),
        getTags()
    ]);
    setAccounts(fetchedAccounts);
    setAllCategories(fetchedCategories);
    setAllTags(fetchedTags);


    if (fetchedAccounts.length > 0) {
        const transactionPromises = fetchedAccounts.map(acc => getTransactions(acc.id));
        const transactionsByAccount = await Promise.all(transactionPromises);
        const combinedTransactions = transactionsByAccount.flat();
        combinedTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setAllTransactionsUnfiltered(combinedTransactions);
    } else {
        setAllTransactionsUnfiltered([]);
    }


    } catch (err: any) {
    console.error("Failed to fetch transfer data:", err);
    setError("Could not load transfer data. Please try again later.");
    toast({ title: "Error", description: err.message || "Failed to load data.", variant: "destructive" });
    } finally {
    setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();

     const handleStorageChange = (event: StorageEvent) => {
         if (typeof window !== 'undefined') {
            const isLikelyOurCustomEvent = event.key === null;
            const relevantKeysForThisPage = ['userAccounts', 'userPreferences', 'userCategories', 'userTags', 'transactions-'];
            const isRelevantExternalChange = event.key !== null && relevantKeysForThisPage.some(k => event.key!.includes(k));

            if (isLikelyOurCustomEvent || isRelevantExternalChange) {
                console.log("Storage changed, refetching transfer data...");
                fetchData();
            }
         }
     };
     if (typeof window !== 'undefined') {
        window.addEventListener('storage', handleStorageChange);
     }

     return () => {
         if (typeof window !== 'undefined') {
            window.removeEventListener('storage', handleStorageChange);
         }
     };
  }, [fetchData]);

  const transferTransactionPairs = useMemo(() => {
    if (isLoading) return [];
    const transfers: { from: Transaction, to: Transaction }[] = [];
    const processedIds = new Set<string>();

    const potentialTransfers = allTransactionsUnfiltered.filter(tx => {
      const txDate = parseISO(tx.date.includes('T') ? tx.date : tx.date + 'T00:00:00Z');
      const isInDateRange = selectedDateRange.from && selectedDateRange.to ?
                            isWithinInterval(txDate, { start: selectedDateRange.from, end: selectedDateRange.to }) :
                            true;
      return tx.category?.toLowerCase() === 'transfer' && isInDateRange;
    });


    potentialTransfers.forEach(txOut => {
      if (txOut.amount < 0 && !processedIds.has(txOut.id)) {
        const matchingIncoming = potentialTransfers.filter(txIn =>
          txIn.amount === -txOut.amount &&
          txIn.accountId !== txOut.accountId &&
          !processedIds.has(txIn.id) &&
          txIn.date === txOut.date &&
          (txIn.description === txOut.description ||
           (txIn.description?.startsWith("Transfer") && txOut.description?.startsWith("Transfer"))) &&
          txIn.transactionCurrency === txOut.transactionCurrency
        );

        if (matchingIncoming.length > 0) {
            matchingIncoming.sort((a,b) => a.id.localeCompare(b.id));
            const txIn = matchingIncoming[0];
            transfers.push({ from: txOut, to: txIn });
            processedIds.add(txOut.id);
            processedIds.add(txIn.id);
        }
      }
    });

    return transfers.sort((a, b) => new Date(b.from.date).getTime() - new Date(a.from.date).getTime());
  }, [allTransactionsUnfiltered, isLoading, selectedDateRange]);

   const getAccountName = (accountId: string): string => {
        return accounts.find(acc => acc.id === accountId)?.name || 'Unknown Account';
   };

    const openEditDialog = (transferPair: { from: Transaction, to: Transaction }) => {
        setEditingTransferPair(transferPair);
        setTransactionTypeToAdd('transfer');
        setIsAddTransactionDialogOpen(true);
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
            toast({
                title: "Transfer Deleted",
                description: `Transfer record removed successfully.`,
            });
            await fetchData(); // Re-fetch data for immediate UI update
            window.dispatchEvent(new Event('storage'));
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

  const handleTransactionAdded = async (data: Omit<Transaction, 'id'> | Transaction) => {
    setIsLoading(true);
    try {
      if (!('id' in data)) {
        await addTransaction(data as Omit<Transaction, 'id'>);
        toast({ title: "Success", description: `${data.amount > 0 ? 'Income' : 'Expense'} added successfully.` });
      } else {
        await updateTransaction(data as Transaction);
         toast({ title: "Success", description: `Transaction updated.` });
      }
      await fetchData(); // Re-fetch data for immediate UI update
      setIsAddTransactionDialogOpen(false);
      setEditingTransferPair(null);
      window.dispatchEvent(new Event('storage'));
    } catch (error: any) {
      console.error("Failed to add/update transaction:", error);
      toast({ title: "Error", description: `Could not add/update transaction: ${error.message}`, variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  };

  const handleTransferAdded = async (data: { fromAccountId: string; toAccountId: string; amount: number; date: Date; description?: string; tags?: string[]; transactionCurrency: string; }) => {
    setIsLoading(true);
    try {
       if (editingTransferPair) {
           console.log("Deleting old transfer pair before adding updated one:", editingTransferPair);
           await deleteTransaction(editingTransferPair.from.id, editingTransferPair.from.accountId);
           await deleteTransaction(editingTransferPair.to.id, editingTransferPair.to.accountId);
           console.log("Old transfer pair deleted.");
       }

      const transferAmount = Math.abs(data.amount);
      const formattedDate = formatDateFns(data.date, 'yyyy-MM-dd');
      const fromAccountName = accounts.find(a=>a.id === data.fromAccountId)?.name || 'Unknown';
      const toAccountName = accounts.find(a=>a.id === data.toAccountId)?.name || 'Unknown';
      const desc = data.description || `Transfer from ${fromAccountName} to ${toAccountName}`;

      await addTransaction({
        accountId: data.fromAccountId,
        amount: -transferAmount,
        transactionCurrency: data.transactionCurrency,
        date: formattedDate,
        description: desc,
        category: 'Transfer',
        tags: data.tags || [],
      });

      await addTransaction({
        accountId: data.toAccountId,
        amount: transferAmount,
        transactionCurrency: data.transactionCurrency,
        date: formattedDate,
        description: desc,
        category: 'Transfer',
        tags: data.tags || [],
      });

      toast({ title: "Success", description: `Transfer ${editingTransferPair ? 'updated' : 'recorded'} successfully.` });
      await fetchData(); // Re-fetch data for immediate UI update
      setIsAddTransactionDialogOpen(false);
      setEditingTransferPair(null);
      window.dispatchEvent(new Event('storage'));
    } catch (error: any) {
      console.error("Failed to add/update transfer:", error);
      toast({ title: "Error", description: `Could not record transfer: ${error.message}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const openAddTransactionDialog = (type: 'expense' | 'income' | 'transfer') => {
    if (accounts.length === 0 && type !== 'transfer') {
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
    setEditingTransferPair(null);
    setIsAddTransactionDialogOpen(true);
  };

  const initialFormDataForEdit = useMemo(() => {
    if (editingTransferPair && transactionTypeToAdd === 'transfer') {
        return {
            type: 'transfer' as 'transfer',
            fromAccountId: editingTransferPair.from.accountId,
            toAccountId: editingTransferPair.to.accountId,
            amount: Math.abs(editingTransferPair.from.amount),
            transactionCurrency: editingTransferPair.from.transactionCurrency,
            date: parseISO(editingTransferPair.from.date.includes('T') ? editingTransferPair.from.date : editingTransferPair.from.date + 'T00:00:00Z'),
            description: editingTransferPair.from.description,
            tags: editingTransferPair.from.tags || [],
        };
    }
    return {date: new Date()};
  }, [editingTransferPair, transactionTypeToAdd]);

  const dateRangeLabel = useMemo(() => {
    if (selectedDateRange.from && selectedDateRange.to) {
        if (isSameDay(selectedDateRange.from, selectedDateRange.to)) {
            return formatDateFns(selectedDateRange.from, 'MMM d, yyyy');
        }
        return `${formatDateFns(selectedDateRange.from, 'MMM d')} - ${formatDateFns(selectedDateRange.to, 'MMM d, yyyy')}`;
    }
    return 'All Time';
  }, [selectedDateRange]);


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

        <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-grow">
                <Card>
                    <CardHeader>
                         <div className="flex justify-between items-center">
                            <div>
                                <CardTitle>All Transfers</CardTitle>
                                <CardDescription>
                                    Transfers for {dateRangeLabel}.
                                </CardDescription>
                            </div>
                             <Button variant="default" size="sm" onClick={() => openAddTransactionDialog('transfer')}>
                                <TransferIcon className="mr-2 h-4 w-4" /> Create new transfer
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
                                return (
                                    <TableRow key={`${pair.from.id}-${pair.to.id}`} className="hover:bg-muted/50">
                                        <TableCell className="font-medium">{pair.from.description || 'Transfer'}</TableCell>
                                        <TableCell className="text-right font-medium">
                                            <div>{formatCurrency(Math.abs(pair.from.amount), pair.from.transactionCurrency, pair.from.transactionCurrency, false)}</div>
                                            {pair.from.transactionCurrency.toUpperCase() !== preferredCurrency.toUpperCase() && (
                                            <div className="text-xs text-muted-foreground">
                                                (≈ {formatCurrency(Math.abs(pair.from.amount), pair.from.transactionCurrency, preferredCurrency, true)})
                                            </div>
                                            )}
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
                            No transfer transactions found for {dateRangeLabel}.
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
                    isLoading={isLoading}
                />
            </div>
        </div>


      <Dialog open={isAddTransactionDialogOpen} onOpenChange={(open) => {
          setIsAddTransactionDialogOpen(open);
          if (!open) setEditingTransferPair(null);
      }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
                {editingTransferPair ? 'Edit Transfer' : `Add New ${transactionTypeToAdd ? transactionTypeToAdd.charAt(0).toUpperCase() + transactionTypeToAdd.slice(1) : 'Transaction'}`}
            </DialogTitle>
            <DialogDescription>
              {editingTransferPair ? 'Modify the details of your transfer.' : `Enter the details for your new ${transactionTypeToAdd || 'transaction'}.`}
            </DialogDescription>
          </DialogHeader>
          {isLoading ? <Skeleton className="h-64 w-full" /> :
            (accounts.length > 0 && allCategories.length > 0 && allTags.length > 0 && transactionTypeToAdd) && (
            <AddTransactionForm
              key={editingTransferPair ? `${editingTransferPair.from.id}-${editingTransferPair.to.id}` : 'new-transaction'}
              accounts={accounts}
              categories={allCategories}
              tags={allTags}
              onTransactionAdded={handleTransactionAdded}
              onTransferAdded={handleTransferAdded}
              isLoading={isLoading}
              initialType={transactionTypeToAdd}
              initialData={initialFormDataForEdit}
            />
          )}
           {(accounts.length === 0 || allCategories.length > 0 || allTags.length > 0) && !isLoading && (
               <div className="py-4 text-center text-muted-foreground">
                 Please ensure you have at least one account (or two for transfers), category, and tag set up before adding transactions.
                   You can manage these in the 'Accounts', 'Categories', and 'Tags' pages.
               </div>
            )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

