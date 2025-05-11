
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAccounts, type Account, updateAccount as updateAccountInDb } from "@/services/account-sync";
import { getTransactions, updateTransaction, deleteTransaction, type Transaction, addTransaction } from "@/services/transactions";
import { getCategories, getCategoryStyle, Category } from '@/services/categories';
import { getTags, type Tag, getTagStyle } from '@/services/tags';
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from '@/lib/currency';
import { getUserPreferences } from '@/lib/preferences';
import { format as formatDateFns, parseISO, isWithinInterval, isSameDay } from 'date-fns';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Edit, Trash2, MoreHorizontal, PlusCircle, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight as TransferIcon, ChevronDown, ArrowLeft } from 'lucide-react';
import AddTransactionForm from '@/components/transactions/add-transaction-form';
import { useToast } from '@/hooks/use-toast';
import type { AddTransactionFormData } from '@/components/transactions/add-transaction-form';
import MonthlySummarySidebar from '@/components/transactions/monthly-summary-sidebar';
import { useDateRange } from '@/contexts/DateRangeContext';
import Link from 'next/link';

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

export default function AccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const accountId = typeof params.accountId === 'string' ? params.accountId : undefined;

  const [account, setAccount] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [allAccounts, setAllAccounts] = useState<Account[]>([]); // For AddTransactionForm
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preferredCurrency, setPreferredCurrency] = useState('BRL');
  const { toast } = useToast();
  const { selectedDateRange } = useDateRange();

  const [isAddTransactionDialogOpen, setIsAddTransactionDialogOpen] = useState(false);
  const [transactionTypeToAdd, setTransactionTypeToAdd] = useState<'expense' | 'income' | 'transfer' | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchData = async () => {
    if (!accountId || typeof window === 'undefined') {
        setIsLoading(false);
        if(!accountId) setError("Account ID is missing.");
        return;
    }
    setIsLoading(true);
    setError(null);
    try {
        const prefs = await getUserPreferences();
        setPreferredCurrency(prefs.preferredCurrency);

        const [fetchedAccounts, fetchedCategories, fetchedTags] = await Promise.all([
            getAccounts(), // Fetches all accounts for the form
            getCategories(),
            getTags()
        ]);
        setAllAccounts(fetchedAccounts);
        setAllCategories(fetchedCategories);
        setAllTags(fetchedTags);

        const targetAccount = fetchedAccounts.find(acc => acc.id === accountId);
        if (!targetAccount) {
            setError("Account not found.");
            setIsLoading(false);
            return;
        }
        setAccount(targetAccount);

        const fetchedTransactions = await getTransactions(accountId);
        fetchedTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setTransactions(fetchedTransactions);

    } catch (err) {
        console.error(`Failed to fetch data for account ${accountId}:`, err);
        setError("Could not load account data. Please try again later.");
        toast({ title: "Error", description: "Failed to load account data.", variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [accountId, toast]);

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
        if (typeof window !== 'undefined' && ['userAccounts', 'userPreferences', 'userCategories', 'userTags', `transactions-${accountId}`].some(key => event.key?.includes(key))) {
            console.log(`Storage changed for account ${accountId}, refetching data...`);
            fetchData();
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
  }, [accountId, fetchData]);


  const filteredTransactions = useMemo(() => {
    if (isLoading) return [];
    return transactions.filter(tx => {
      const txDate = parseISO(tx.date.includes('T') ? tx.date : tx.date + 'T00:00:00Z');
      if (!selectedDateRange.from || !selectedDateRange.to) return true;
      return isWithinInterval(txDate, { start: selectedDateRange.from, end: selectedDateRange.to });
    });
  }, [transactions, isLoading, selectedDateRange]);


  const openEditDialog = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setIsEditDialogOpen(true);
  };

  const handleUpdateTransaction = async (formData: AddTransactionFormData) => {
    if (!selectedTransaction) return;
    // Simplified: Assume form data is for the current account context
    const transactionAmount = formData.type === 'expense' ? -Math.abs(formData.amount) : Math.abs(formData.amount);
    const transactionToUpdate: Transaction = {
      ...selectedTransaction,
      amount: transactionAmount,
      transactionCurrency: formData.transactionCurrency,
      date: formatDateFns(formData.date, 'yyyy-MM-dd'),
      description: formData.description || selectedTransaction.description,
      category: formData.category || selectedTransaction.category,
      tags: formData.tags || [],
    };
    setIsLoading(true);
    try {
      await updateTransaction(transactionToUpdate);
      await fetchData(); // Refetch data for this account
      setIsEditDialogOpen(false);
      setSelectedTransaction(null);
      toast({ title: "Success", description: `Transaction "${transactionToUpdate.description}" updated.` });
    } catch (err: any) {
      console.error("Failed to update transaction:", err);
      toast({ title: "Error", description: err.message || "Could not update transaction.", variant: "destructive" });
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
      toast({ title: "Transaction Deleted", description: `Transaction "${selectedTransaction.description}" removed.` });
    } catch (err: any) {
      console.error("Failed to delete transaction:", err);
      toast({ title: "Error", description: err.message || "Could not delete transaction.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
      setSelectedTransaction(null);
    }
  };

  const handleTransactionAdded = async (data: Omit<Transaction, 'id'>) => {
    try {
      await addTransaction({ ...data, accountId: accountId! });
      toast({ title: "Success", description: `${data.amount > 0 ? 'Income' : 'Expense'} added successfully.` });
      await fetchData();
      setIsAddTransactionDialogOpen(false);
    } catch (error: any) {
      console.error("Failed to add transaction:", error);
      toast({ title: "Error", description: `Could not add transaction: ${error.message}`, variant: "destructive" });
    }
  };

   const handleTransferAdded = async (data: { fromAccountId: string; toAccountId: string; amount: number; date: Date; description?: string; tags?: string[]; transactionCurrency: string; }) => {
    try {
      const transferAmount = Math.abs(data.amount);
      const formattedDate = formatDateFns(data.date, 'yyyy-MM-dd');
      const currentAccounts = await getAccounts(); // Fetch fresh for names
      const fromAccountName = currentAccounts.find(a=>a.id === data.fromAccountId)?.name || 'Unknown';
      const toAccountName = currentAccounts.find(a=>a.id === data.toAccountId)?.name || 'Unknown';
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

      toast({ title: "Success", description: "Transfer recorded successfully." });
      await fetchData();
      setIsAddTransactionDialogOpen(false);
    } catch (error: any) {
      console.error("Failed to add transfer:", error);
      toast({ title: "Error", description: `Could not record transfer: ${error.message}`, variant: "destructive" });
    }
  };


  const openAddTransactionDialog = (type: 'expense' | 'income' | 'transfer') => {
    if (!account && type !== 'transfer') {
        toast({ title: "Account Error", description: "Account details not loaded.", variant: "destructive" });
        return;
    }
    if (type === 'transfer' && allAccounts.length < 2) {
        toast({ title: "Not Enough Accounts", description: "You need at least two accounts to make a transfer.", variant: "destructive" });
        return;
    }
    setTransactionTypeToAdd(type);
    setIsAddTransactionDialogOpen(true);
  };

  const dateRangeLabel = useMemo(() => {
    if (selectedDateRange.from && selectedDateRange.to) {
        if (isSameDay(selectedDateRange.from, selectedDateRange.to)) {
            return formatDateFns(selectedDateRange.from, 'MMM d, yyyy');
        }
        return `${formatDateFns(selectedDateRange.from, 'MMM d')} - ${formatDateFns(selectedDateRange.to, 'MMM d, yyyy')}`;
    }
    return 'All Time';
  }, [selectedDateRange]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
        <Skeleton className="h-8 w-1/2 mb-6" />
        <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-grow">
                <Skeleton className="h-96 w-full" />
            </div>
            <div className="w-full md:w-72 lg:w-80 flex-shrink-0">
                <Skeleton className="h-80 w-full" />
            </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
        <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
            <Button variant="outline" onClick={() => router.back()} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Accounts
            </Button>
            <div className="mb-4 p-4 bg-destructive/10 text-destructive border border-destructive rounded-md">
                {error}
            </div>
        </div>
    );
  }

  if (!account) {
    return (
        <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
            <Button variant="outline" onClick={() => router.back()} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Accounts
            </Button>
            <p>Account not found.</p>
        </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-6">
        <div>
            <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-2 text-muted-foreground hover:text-primary px-0 h-auto">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Accounts
            </Button>
            <h1 className="text-3xl font-bold">{account.name} - Transactions</h1>
            <p className="text-muted-foreground">Balance: {formatCurrency(account.balance, account.currency, preferredCurrency, false)}
                {account.currency !== preferredCurrency && ` (≈ ${formatCurrency(account.balance, account.currency, preferredCurrency, true)})`}
            </p>
        </div>
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
              <ArrowDownCircle className="mr-2 h-4 w-4" /> Add Spend
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openAddTransactionDialog('income')}>
              <ArrowUpCircle className="mr-2 h-4 w-4" /> Add Income
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openAddTransactionDialog('transfer')}>
              <TransferIcon className="mr-2 h-4 w-4" /> Add Transfer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        <div className="flex-grow">
          <Card>
            <CardHeader>
              <CardTitle>Transactions for {dateRangeLabel}</CardTitle>
              <CardDescription>
                All transactions for the account: {account.name}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredTransactions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Tags</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.map((transaction) => {
                      const { icon: CategoryIcon, color } = getCategoryStyle(transaction.category);
                      const formattedAmount = formatCurrency(transaction.amount, transaction.transactionCurrency, preferredCurrency, true);
                      return (
                        <TableRow key={transaction.id} className="hover:bg-muted/50">
                          <TableCell className="font-medium">{transaction.description}</TableCell>
                          <TableCell className={`text-right font-medium ${transaction.amount >= 0 ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                            {formattedAmount}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(transaction.date)}</TableCell>
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
                                  <Edit className="mr-2 h-4 w-4" /> Edit
                                </DropdownMenuItem>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <div
                                      className="relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-destructive/10 focus:text-destructive text-destructive data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                                      onClick={() => openDeleteDialog(transaction)}
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                                    </div>
                                  </AlertDialogTrigger>
                                  {selectedTransaction?.id === transaction.id && (
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          This action will permanently delete "{selectedTransaction.description}".
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
                  <p className="text-muted-foreground">No transactions found for this account in the selected period.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        <div className="w-full md:w-72 lg:w-80 flex-shrink-0">
          <MonthlySummarySidebar
            transactions={filteredTransactions}
            accounts={[account]} // Pass current account in an array
            preferredCurrency={preferredCurrency}
            transactionType="all" // Or derive based on account type if needed
            isLoading={isLoading}
          />
        </div>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open);
        if (!open) setSelectedTransaction(null);
      }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
          </DialogHeader>
          {selectedTransaction && allAccounts.length > 0 && allCategories.length > 0 && allTags.length > 0 && (
            <AddTransactionForm
              accounts={allAccounts}
              categories={allCategories}
              tags={allTags}
              onTransactionAdded={handleUpdateTransaction}
              isLoading={isLoading}
              initialData={{
                type: selectedTransaction.amount < 0 ? 'expense' : (selectedTransaction.category === 'Transfer' ? 'transfer' : 'income'),
                accountId: selectedTransaction.accountId, // Pre-fill if needed, though context implies it's for this account
                amount: Math.abs(selectedTransaction.amount),
                transactionCurrency: selectedTransaction.transactionCurrency,
                date: selectedTransaction.date ? parseISO(selectedTransaction.date.includes('T') ? selectedTransaction.date : selectedTransaction.date + 'T00:00:00Z') : new Date(),
                category: selectedTransaction.category,
                description: selectedTransaction.description,
                tags: selectedTransaction.tags || []
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isAddTransactionDialogOpen} onOpenChange={setIsAddTransactionDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New {transactionTypeToAdd ? transactionTypeToAdd.charAt(0).toUpperCase() + transactionTypeToAdd.slice(1) : 'Transaction'} for {account.name}</DialogTitle>
          </DialogHeader>
          {allAccounts.length > 0 && allCategories.length > 0 && allTags.length > 0 && transactionTypeToAdd && (
            <AddTransactionForm
              accounts={allAccounts}
              categories={allCategories}
              tags={allTags}
              onTransactionAdded={handleTransactionAdded}
              onTransferAdded={handleTransferAdded}
              isLoading={isLoading}
              initialType={transactionTypeToAdd}
              initialData={transactionTypeToAdd !== 'transfer' ? { accountId: account.id, transactionCurrency: account.currency } : { fromAccountId: account.id, transactionCurrency: account.currency } }
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
