
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAccounts, type Account } from "@/services/account-sync";
import { getTransactions, updateTransaction, deleteTransaction, type Transaction, addTransaction } from "@/services/transactions";
import { getCategories, getCategoryStyle, Category as CategoryType } from '@/services/categories'; // Keep for category display
import { getTags, type Tag as TagType, getTagStyle } from '@/services/tags';
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, convertCurrency } from '@/lib/currency';
import { getUserPreferences } from '@/lib/preferences';
import { format as formatDateFns, parseISO, isWithinInterval, isSameDay } from 'date-fns';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Edit, Trash2, MoreHorizontal, PlusCircle, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight as TransferIcon, ChevronDown, ArrowLeft, CopyPlus, Tag as TagIconLucide } from 'lucide-react';
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

export default function TagDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tagId = typeof params.tagId === 'string' ? params.tagId : undefined;

  const [tag, setTag] = useState<TagType | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allCategories, setAllCategories] = useState<CategoryType[]>([]); 
  const [allTags, setAllTags] = useState<TagType[]>([]); 
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
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
  const [clonedTransactionData, setClonedTransactionData] = useState<Partial<AddTransactionFormData> | undefined>(undefined);

  const fetchData = useCallback(async () => {
    if (!tagId || typeof window === 'undefined') {
        setIsLoading(false);
        if(!tagId) setError("Tag ID is missing.");
        return;
    }
    setIsLoading(true);
    setError(null);
    try {
        const prefs = await getUserPreferences();
        setPreferredCurrency(prefs.preferredCurrency);

        const [fetchedAppAccounts, fetchedAppCategories, fetchedAppTags] = await Promise.all([
            getAccounts(), 
            getCategories(),
            getTags()
        ]);
        setAllAccounts(fetchedAppAccounts);
        setAllCategories(fetchedAppCategories);
        setAllTags(fetchedAppTags);

        const targetTag = fetchedAppTags.find(t => t.id === tagId);
        if (!targetTag) {
            setError("Tag not found.");
            setIsLoading(false);
            return;
        }
        setTag(targetTag);

        if (fetchedAppAccounts.length > 0) {
            const transactionPromises = fetchedAppAccounts.map(acc => getTransactions(acc.id));
            const transactionsByAccount = await Promise.all(transactionPromises);
            const combinedTransactions = transactionsByAccount.flat();
            const tagTransactions = combinedTransactions.filter(tx => tx.tags?.includes(targetTag.name));
            tagTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setTransactions(tagTransactions);
        } else {
            setTransactions([]);
        }

    } catch (err: any) {
        console.error(`Failed to fetch data for tag ${tagId}:`, err);
        setError("Could not load tag data. Please try again later.");
        toast({ title: "Error", description: err.message || "Failed to load tag data.", variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  }, [tagId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
         if (event.type === 'storage') {
            const isLikelyOurCustomEvent = event.key === null;
            const relevantKeysForThisPage = ['userAccounts', 'userPreferences', 'userCategories', 'userTags', 'transactions-'];
            const isRelevantExternalChange = typeof event.key === 'string' && relevantKeysForThisPage.some(k => event.key.includes(k));

            if (isLikelyOurCustomEvent || isRelevantExternalChange) {
                console.log(`Storage change for tag ${tagId} (key: ${event.key || 'custom'}), refetching data...`);
                fetchData();
            }
        }
    };
    if (typeof window !== 'undefined') window.addEventListener('storage', handleStorageChange);
    return () => {
        if (typeof window !== 'undefined') window.removeEventListener('storage', handleStorageChange);
    };
  }, [tagId, fetchData]);


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
      setIsEditDialogOpen(false);
      setSelectedTransaction(null);
      toast({ title: "Success", description: `Transaction "${transactionToUpdate.description}" updated.` });
      window.dispatchEvent(new Event('storage')); 
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
      toast({ title: "Transaction Deleted", description: `Transaction "${selectedTransaction.description}" removed.` });
      window.dispatchEvent(new Event('storage')); 
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
      const dataWithTag = (tag && !data.tags?.includes(tag.name)) 
        ? { ...data, tags: [...(data.tags || []), tag.name] } 
        : data;
      await addTransaction(dataWithTag);
      toast({ title: "Success", description: `${data.amount > 0 ? 'Income' : 'Expense'} added successfully.` });
      setIsAddTransactionDialogOpen(false);
      setClonedTransactionData(undefined);
      window.dispatchEvent(new Event('storage')); 
    } catch (error: any) {
      console.error("Failed to add transaction:", error);
      toast({ title: "Error", description: `Could not add transaction: ${error.message}`, variant: "destructive" });
    }
  };

   const handleTransferAdded = async (data: { fromAccountId: string; toAccountId: string; amount: number; date: Date; description?: string; tags?: string[]; transactionCurrency: string; }) => {
    try {
      const transferAmount = Math.abs(data.amount);
      const formattedDate = formatDateFns(data.date, 'yyyy-MM-dd');
      const currentAccounts = await getAccounts(); 
      const fromAccountName = currentAccounts.find(a=>a.id === data.fromAccountId)?.name || 'Unknown';
      const toAccountName = currentAccounts.find(a=>a.id === data.toAccountId)?.name || 'Unknown';
      const desc = data.description || `Transfer from ${fromAccountName} to ${toAccountName}`;
      const tagsWithCurrent = (tag && !data.tags?.includes(tag.name)) 
        ? [...(data.tags || []), tag.name] 
        : (data.tags || []);


      await addTransaction({
        accountId: data.fromAccountId,
        amount: -transferAmount,
        transactionCurrency: data.transactionCurrency,
        date: formattedDate,
        description: desc,
        category: 'Transfer',
        tags: tagsWithCurrent,
      });

      await addTransaction({
        accountId: data.toAccountId,
        amount: transferAmount,
        transactionCurrency: data.transactionCurrency,
        date: formattedDate,
        description: desc,
        category: 'Transfer',
        tags: tagsWithCurrent,
      });

      toast({ title: "Success", description: "Transfer recorded successfully." });
      setIsAddTransactionDialogOpen(false);
      setClonedTransactionData(undefined);
      window.dispatchEvent(new Event('storage')); 
    } catch (error: any) {
      console.error("Failed to add transfer:", error);
      toast({ title: "Error", description: `Could not record transfer: ${error.message}`, variant: "destructive" });
    }
  };

  const openAddTransactionDialog = (type: 'expense' | 'income' | 'transfer') => {
    if (allAccounts.length === 0 && type !== 'transfer') {
        toast({ title: "Account Error", description: "No accounts available to add transactions.", variant: "destructive" });
        return;
    }
     if (type === 'transfer' && allAccounts.length < 2) {
        toast({ title: "Not Enough Accounts", description: "You need at least two accounts to make a transfer.", variant: "destructive" });
        return;
    }
    setTransactionTypeToAdd(type);
    setClonedTransactionData(undefined); 
    setIsAddTransactionDialogOpen(true);
  };

  const openCloneAndEditDialog = (transaction: Transaction) => {
    const typeBasedOnAmount = transaction.amount < 0 ? 'expense' : 'income';
    let typeForForm: 'expense' | 'income' | 'transfer' = typeBasedOnAmount;

    const baseClonedData: Partial<AddTransactionFormData> & { date: Date } = {
        amount: Math.abs(transaction.amount),
        transactionCurrency: transaction.transactionCurrency,
        date: parseISO(transaction.date.includes('T') ? transaction.date : transaction.date + 'T00:00:00Z'),
        description: `Clone of: ${transaction.description}`,
        category: transaction.category === 'Transfer' ? undefined : transaction.category,
        tags: transaction.tags || [], 
    };

    if (transaction.category === 'Transfer') {
        typeForForm = typeBasedOnAmount;
        toast({
            title: "Cloning Transfer Leg",
            description: `Cloned as ${typeForForm}. To create a new transfer, change type to 'Transfer' and specify accounts.`,
            variant: "default",
            duration: 7000,
        });
        setClonedTransactionData({ ...baseClonedData, type: typeForForm, accountId: transaction.accountId });
    } else {
        setClonedTransactionData({ ...baseClonedData, type: typeForForm, accountId: transaction.accountId });
    }
    setTransactionTypeToAdd(typeForForm);
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

  if (isLoading && !tag) { 
    return (
      <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
        <Skeleton className="h-8 w-1/2 mb-6" />
        <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-grow"><Skeleton className="h-96 w-full" /></div>
            <div className="w-full md:w-72 lg:w-80 flex-shrink-0"><Skeleton className="h-80 w-full" /></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
        <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
            <Button variant="outline" onClick={() => router.push('/organization')} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Organization
            </Button>
            <div className="mb-4 p-4 bg-destructive/10 text-destructive border border-destructive rounded-md">{error}</div>
        </div>
    );
  }

  if (!tag) {
    return (
        <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
            <Button variant="outline" onClick={() => router.push('/organization')} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Organization
            </Button>
            <p>Tag not found.</p>
        </div>
    );
  }
  
  const { icon: TagIconStyled, color: tagColor } = getTagStyle(tag.name);

  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-6">
        <div>
            <Button variant="ghost" size="sm" onClick={() => router.push('/organization')} className="mb-2 text-muted-foreground hover:text-primary px-0 h-auto">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Organization
            </Button>
            <h1 className="text-3xl font-bold flex items-center">
                <TagIconLucide className="mr-2 h-6 w-6" /> <span className="ml-2">{tag.name} - Transactions</span>
            </h1>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="default" size="sm">
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Transaction
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openAddTransactionDialog('expense')}><ArrowDownCircle className="mr-2 h-4 w-4" /> Add Spend</DropdownMenuItem>
            <DropdownMenuItem onClick={() => openAddTransactionDialog('income')}><ArrowUpCircle className="mr-2 h-4 w-4" /> Add Income</DropdownMenuItem>
            <DropdownMenuItem onClick={() => openAddTransactionDialog('transfer')}><TransferIcon className="mr-2 h-4 w-4" /> Add Transfer</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        <div className="flex-grow">
          <Card>
            <CardHeader>
              <CardTitle>Transactions tagged with "{tag.name}" ({dateRangeLabel})</CardTitle>
              <CardDescription>All transactions with the tag: {tag.name}.</CardDescription>
            </CardHeader>
            <CardContent>
              {filteredTransactions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.map((transaction) => {
                      const account = allAccounts.find(acc => acc.id === transaction.accountId);
                      const categoryDetails = allCategories.find(c => c.name === transaction.category);
                      const { icon: CategoryIcon, color: categoryBadgeColor } = getCategoryStyle(categoryDetails);
                      return (
                        <TableRow key={transaction.id} className="hover:bg-muted/50">
                          <TableCell className="font-medium">{transaction.description}</TableCell>
                          <TableCell className={`text-right font-medium ${transaction.amount >= 0 ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                            <div>{formatCurrency(transaction.amount, transaction.transactionCurrency, transaction.transactionCurrency, false)}</div>
                            {transaction.transactionCurrency.toUpperCase() !== preferredCurrency.toUpperCase() && (
                              <div className="text-xs text-muted-foreground">
                                (≈ {formatCurrency(transaction.amount, transaction.transactionCurrency, preferredCurrency, true)})
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(transaction.date)}</TableCell>
                          <TableCell className="text-muted-foreground">{account?.name || 'Unknown Account'}</TableCell>
                          <TableCell>
                             {categoryDetails ? (
                                <Link href={`/categories/${categoryDetails.id}`} passHref>
                                    <Badge variant="outline" className={`flex items-center gap-1 ${categoryBadgeColor} border hover:bg-muted/80 cursor-pointer`}>
                                        <CategoryIcon />
                                        <span className="capitalize">{transaction.category || 'Uncategorized'}</span>
                                    </Badge>
                                </Link>
                             ) : (
                                <Badge variant="outline" className={`flex items-center gap-1 ${categoryBadgeColor} border`}>
                                    <CategoryIcon />
                                    <span className="capitalize">{transaction.category || 'Uncategorized'}</span>
                                </Badge>
                             )}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><span className="sr-only">Open menu</span><MoreHorizontal className="h-4 w-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditDialog(transaction)}><Edit className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openCloneAndEditDialog(transaction)}><CopyPlus className="mr-2 h-4 w-4" /> Clone & Edit</DropdownMenuItem>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <div className="relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-destructive/10 focus:text-destructive text-destructive data-[disabled]:pointer-events-none data-[disabled]:opacity-50" onClick={() => openDeleteDialog(transaction)}>
                                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                                    </div>
                                  </AlertDialogTrigger>
                                  {selectedTransaction?.id === transaction.id && !isEditDialogOpen && ( 
                                    <AlertDialogContent>
                                      <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This action will permanently delete "{selectedTransaction.description}".</AlertDialogDescription></AlertDialogHeader>
                                      <AlertDialogFooter><AlertDialogCancel onClick={() => setSelectedTransaction(null)} disabled={isDeleting}>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteTransactionConfirm} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{isDeleting ? "Deleting..." : "Delete"}</AlertDialogAction></AlertDialogFooter>
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
                <div className="text-center py-10"><p className="text-muted-foreground">No transactions found with this tag in the selected period.</p></div>
              )}
            </CardContent>
          </Card>
        </div>
        <div className="w-full md:w-72 lg:w-80 flex-shrink-0">
          <MonthlySummarySidebar transactions={filteredTransactions} accounts={allAccounts} preferredCurrency={preferredCurrency} transactionType="all" isLoading={isLoading} />
        </div>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={(open) => { setIsEditDialogOpen(open); if (!open) setSelectedTransaction(null); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>Edit Transaction</DialogTitle></DialogHeader>
          {selectedTransaction && allAccounts.length > 0 && allCategories.length > 0 && allTags.length > 0 && (
            <AddTransactionForm
              key={selectedTransaction.id} 
              accounts={allAccounts}
              categories={allCategories}
              tags={allTags}
              onTransactionAdded={handleUpdateTransaction}
              isLoading={isLoading}
              initialData={{
                ...selectedTransaction, 
                type: selectedTransaction.amount < 0 ? 'expense' : (selectedTransaction.category === 'Transfer' ? 'transfer' : 'income'),
                amount: Math.abs(selectedTransaction.amount), 
                date: selectedTransaction.date ? parseISO(selectedTransaction.date.includes('T') ? selectedTransaction.date : selectedTransaction.date + 'T00:00:00Z') : new Date(),
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isAddTransactionDialogOpen} onOpenChange={(open) => { setIsAddTransactionDialogOpen(open); if (!open) { setClonedTransactionData(undefined); setTransactionTypeToAdd(null); } }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>{clonedTransactionData ? 'Clone & Edit Transaction' : `Add New ${transactionTypeToAdd ? transactionTypeToAdd.charAt(0).toUpperCase() + transactionTypeToAdd.slice(1) : 'Transaction'}`}</DialogTitle></DialogHeader>
          {isLoading ? <Skeleton className="h-64 w-full"/> : 
          (allAccounts.length > 0 && allCategories.length > 0 && allTags.length > 0 && transactionTypeToAdd) && (
            <AddTransactionForm
              accounts={allAccounts}
              categories={allCategories}
              tags={allTags}
              onTransactionAdded={handleTransactionAdded}
              onTransferAdded={handleTransferAdded}
              isLoading={isLoading}
              initialType={transactionTypeToAdd}
              initialData={ clonedTransactionData || (tag ? { tags: [tag.name], date: new Date() } : {date: new Date()}) }
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

