
'use client';

import type { FC } from 'react';
import DateRangePicker from '@/components/dashboard/date-range-picker';
import { useDateRange } from '@/contexts/DateRangeContext';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PlusCircle, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight as TransferIcon, ChevronDown, PanelLeft } from 'lucide-react'; // Added PanelLeft for consistency if needed, but SidebarTrigger has its own
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import AddTransactionForm from '@/components/transactions/add-transaction-form';
import type { Transaction } from '@/services/transactions';
import { getAccounts, type Account } from '@/services/account-sync';
import { getCategories, type Category } from '@/services/categories';
import { getTags, type Tag } from '@/services/tags';
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from 'react';
import { format as formatDateFns } from 'date-fns';
import { addTransaction } from '@/services/transactions';
import { Skeleton } from '@/components/ui/skeleton';
import { SidebarTrigger } from '@/components/ui/sidebar'; // Import SidebarTrigger


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
          
          if (transactionTypeToAdd === 'transfer' && fetchedAccounts.length < 2) {
            toast({
              title: "Not Enough Accounts",
              description: "You need at least two accounts to make a transfer.",
              variant: "destructive",
            });
            setIsAddTransactionDialogOpen(false);
            setIsLoadingDataForForm(false);
            return;
          }
          if (transactionTypeToAdd !== 'transfer' && fetchedAccounts.length === 0) {
            toast({
              title: "No Accounts",
              description: "Please add an account first before adding transactions.",
              variant: "destructive",
            });
            setIsAddTransactionDialogOpen(false);
            setIsLoadingDataForForm(false);
            return;
          }
          
          setAccounts(fetchedAccounts);

          const [fetchedCategories, fetchedTagsList] = await Promise.all([
            getCategories(),
            getTags()
          ]);
          setCategories(fetchedCategories);
          setTagsList(fetchedTagsList);

        } catch (error) {
          console.error("Failed to fetch data for transaction form:", error);
          toast({ title: "Error", description: "Could not load data for transaction form.", variant: "destructive" });
          setIsAddTransactionDialogOpen(false);
        } finally {
          setIsLoadingDataForForm(false);
        }
      }
    };

    fetchAndPrepareFormData();
  }, [isAddTransactionDialogOpen, transactionTypeToAdd, toast]);


  const openAddTransactionDialog = (type: 'expense' | 'income' | 'transfer') => {
    setTransactionTypeToAdd(type); 
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

  const handleTransferAdded = async (data: { fromAccountId: string; toAccountId: string; amount: number; transactionCurrency: string; toAccountAmount: number; toAccountCurrency: string; date: Date; description?: string; tags?: string[];}) => {
    try {
      const formattedDate = formatDateFns(data.date, 'yyyy-MM-dd');
      
      const currentAccounts = await getAccounts();
      const fromAccountName = currentAccounts.find(a=>a.id === data.fromAccountId)?.name || 'Unknown Account';
      const toAccountName = currentAccounts.find(a=>a.id === data.toAccountId)?.name || 'Unknown Account';
      const desc = data.description || `Transfer from ${fromAccountName} to ${toAccountName}`;

      await addTransaction({
        accountId: data.fromAccountId,
        amount: -Math.abs(data.amount), // Amount from source account's perspective
        transactionCurrency: data.transactionCurrency,
        date: formattedDate,
        description: desc,
        category: 'Transfer',
        tags: data.tags || [],
      });

      await addTransaction({
        accountId: data.toAccountId,
        amount: Math.abs(data.toAccountAmount), // Amount for destination account
        transactionCurrency: data.toAccountCurrency,
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
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b bg-background/95 px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 sm:py-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Mobile Menu Trigger */}
      <SidebarTrigger className="md:hidden" />
      
      {/* Existing content pushed to the right */}
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
        <DialogContent className="sm:max-w-2xl">
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
            <AddTransactionForm
              accounts={accounts}
              categories={categories}
              tags={tagsList}
              onTransactionAdded={handleTransactionAdded}
              onTransferAdded={handleTransferAdded}
              isLoading={false} 
              initialType={transactionTypeToAdd}
              initialData={{date: new Date()}} // Ensure initialData is always an object
            />
          ) : (
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
