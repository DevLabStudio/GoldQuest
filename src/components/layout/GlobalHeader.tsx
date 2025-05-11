'use client';

import type { FC } from 'react';
import DateRangePicker from '@/components/dashboard/date-range-picker';
import { useDateRange } from '@/contexts/DateRangeContext';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PlusCircle, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight as TransferIcon, ChevronDown } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import AddTransactionForm from '@/components/transactions/add-transaction-form';
import type { Transaction } from '@/services/transactions';
import { getAccounts, type Account } from '@/services/account-sync';
import { getCategories, type Category } from '@/services/categories';
import { getTags, type Tag } from '@/services/tags';
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from 'react';
import { format as formatDateFns } from 'date-fns'; // Use aliased import
import { addTransaction } from '@/services/transactions';
import { Skeleton } from '@/components/ui/skeleton';


const GlobalHeader: FC = () => {
  const { selectedDateRange, setSelectedDateRange } = useDateRange();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tagsList, setTagsList] = useState<Tag[]>([]);
  const [isAddTransactionDialogOpen, setIsAddTransactionDialogOpen] = useState(false);
  const [transactionTypeToAdd, setTransactionTypeToAdd] = useState<'expense' | 'income' | 'transfer' | null>(null);
  const [isLoadingDataForForm, setIsLoadingDataForForm] = useState(false);

  useEffect(() => {
    const fetchAndPrepareFormData = async () => {
      if (isAddTransactionDialogOpen && transactionTypeToAdd) {
        setIsLoadingDataForForm(true);
        try {
          const fetchedAccounts = await getAccounts();
          
          // Perform checks based on freshly fetched accounts
          if (transactionTypeToAdd === 'transfer' && fetchedAccounts.length < 2) {
            toast({
              title: "Not Enough Accounts",
              description: "You need at least two accounts to make a transfer.",
              variant: "destructive",
            });
            setIsAddTransactionDialogOpen(false); // Abort opening
            setIsLoadingDataForForm(false);
            return;
          }
          if (transactionTypeToAdd !== 'transfer' && fetchedAccounts.length === 0) {
            toast({
              title: "No Accounts",
              description: "Please add an account first before adding transactions.",
              variant: "destructive",
            });
            setIsAddTransactionDialogOpen(false); // Abort opening
            setIsLoadingDataForForm(false);
            return;
          }
          
          setAccounts(fetchedAccounts); // Set accounts state for the form

          // If account checks pass, fetch categories and tags
          const [fetchedCategories, fetchedTagsList] = await Promise.all([
            getCategories(),
            getTags()
          ]);
          setCategories(fetchedCategories);
          setTagsList(fetchedTagsList);

        } catch (error) {
          console.error("Failed to fetch data for transaction form:", error);
          toast({ title: "Error", description: "Could not load data for transaction form.", variant: "destructive" });
          setIsAddTransactionDialogOpen(false); // Close dialog on error
        } finally {
          setIsLoadingDataForForm(false);
        }
      }
    };

    fetchAndPrepareFormData();
  }, [isAddTransactionDialogOpen, transactionTypeToAdd, toast]);


  const openAddTransactionDialog = (type: 'expense' | 'income' | 'transfer') => {
    setTransactionTypeToAdd(type); // Set the type, useEffect will handle fetching and checks
    setIsAddTransactionDialogOpen(true);
  };

  const handleTransactionAdded = async (data: Omit<Transaction, 'id'>) => {
    try {
      await addTransaction(data);
      toast({ title: "Success", description: `${data.amount > 0 ? 'Income' : 'Expense'} added successfully.` });
      setIsAddTransactionDialogOpen(false);
      window.dispatchEvent(new Event('storage')); 
    } catch (error: any) {
      console.error("Failed to add transaction:", error);
      toast({ title: "Error", description: `Could not add transaction: ${error.message}`, variant: "destructive" });
    }
  };

  const handleTransferAdded = async (data: { fromAccountId: string; toAccountId: string; amount: number; date: Date; description?: string; tags?: string[]; transactionCurrency: string }) => {
    try {
      const transferAmount = Math.abs(data.amount);
      const formattedDate = formatDateFns(data.date, 'yyyy-MM-dd');
      
      // Fetch fresh account names for description, in case local state 'accounts' is not fully up-to-date here
      const currentAccounts = await getAccounts();
      const fromAccountName = currentAccounts.find(a=>a.id === data.fromAccountId)?.name || 'Unknown Account';
      const toAccountName = currentAccounts.find(a=>a.id === data.toAccountId)?.name || 'Unknown Account';
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
      setIsAddTransactionDialogOpen(false);
      window.dispatchEvent(new Event('storage'));
    } catch (error: any) {
      console.error("Failed to add transfer:", error);
      toast({ title: "Error", description: `Could not record transfer: ${error.message}`, variant: "destructive" });
    }
  };


  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-end gap-4 border-b bg-background/95 px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 sm:py-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="ml-auto flex items-center gap-2">
        <DateRangePicker
          initialRange={selectedDateRange}
          onRangeChange={setSelectedDateRange}
          className="w-full sm:w-auto md:min-w-[280px]"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="default">
              <PlusCircle className="mr-2 h-4 w-4" />
              Add
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

      <Dialog open={isAddTransactionDialogOpen} onOpenChange={setIsAddTransactionDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Add New {transactionTypeToAdd ? transactionTypeToAdd.charAt(0).toUpperCase() + transactionTypeToAdd.slice(1) : 'Transaction'}</DialogTitle>
            <DialogDescription>
              Enter the details for your new {transactionTypeToAdd || 'transaction'}.
            </DialogDescription>
          </DialogHeader>
          {isLoadingDataForForm ? (
            <div className="py-4">
              <Skeleton className="h-10 w-full mb-4" />
              <Skeleton className="h-20 w-full mb-4" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (accounts.length > 0 && categories.length > 0 && tagsList.length > 0 && transactionTypeToAdd) ? (
            // This condition implicitly handles the checks done in useEffect because
            // if those checks failed, isAddTransactionDialogOpen would be false.
            <AddTransactionForm
              accounts={accounts}
              categories={categories}
              tags={tagsList}
              onTransactionAdded={handleTransactionAdded}
              onTransferAdded={handleTransferAdded}
              isLoading={false} 
              initialType={transactionTypeToAdd}
            />
          ) : (
            // This message is shown if loading is false BUT the dialog is still trying to open
            // (e.g., if checks in useEffect failed and set isAddTransactionDialogOpen to false,
            // this part might not even be reached if the dialog truly closes.
            // However, if there's a slight delay or if essential data like categories/tags are missing.)
            <div className="py-4 text-center text-muted-foreground">
                {!isLoadingDataForForm && 
                 ( (accounts.length === 0 && transactionTypeToAdd !== 'transfer') || 
                   (accounts.length < 2 && transactionTypeToAdd === 'transfer') || 
                   categories.length === 0 || 
                   tagsList.length === 0) &&
                "Please ensure you have at least one account (or two for transfers), category, and tag set up."}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </header>
  );
};

export default GlobalHeader;