
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { PlusCircle, ArrowUpCircle, ArrowDownCircle, Users, Eye, Landmark, PercentCircle, PiggyBank, Trash2, Edit, MoreHorizontal, Settings2, CreditCard as CreditCardIconLucide } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

import AddSubscriptionForm, { type AddSubscriptionFormData } from '@/components/subscriptions/add-subscription-form';
import type { Subscription, SubscriptionFrequency } from '@/services/subscriptions';
import { getSubscriptions, addSubscription as saveSubscription, deleteSubscription, updateSubscription } from '@/services/subscriptions';
import { getCategories, type Category, getCategoryStyle } from '@/services/categories';
import { getAccounts, type Account } from '@/services/account-sync';
import { getGroups, type Group } from '@/services/groups';
import { addTransaction } from '@/services/transactions'; // Added import

import AddLoanForm, { type AddLoanFormData } from '@/components/loans/add-loan-form';
import type { Loan, NewLoanData, LoanType } from '@/services/loans';
import { getLoans, addLoan as saveLoan, deleteLoan as removeLoan, updateLoan as changeLoan, loanTypeLabels } from '@/services/loans';

import AddCreditCardForm, { type AddCreditCardFormData } from '@/components/credit-cards/add-credit-card-form';
import type { CreditCard, NewCreditCardData } from '@/services/credit-cards';
import { getCreditCards, addCreditCard as saveCreditCard, deleteCreditCard as removeCreditCard, updateCreditCard as changeCreditCard } from '@/services/credit-cards';

import AddBudgetForm, { type AddBudgetFormData } from '@/components/budgets/add-budget-form';
import type { Budget, NewBudgetData } from '@/services/budgets';
import { getBudgets, addBudget as saveBudget, deleteBudget as removeBudgetDb, updateBudget as changeBudget } from '@/services/budgets';
import { Progress } from '@/components/ui/progress';


import { useToast } from '@/hooks/use-toast';
import { formatCurrency, convertCurrency, getCurrencySymbol } from '@/lib/currency';
import { getUserPreferences } from '@/lib/preferences';
import { format, parseISO, isSameMonth, isSameYear } from 'date-fns'; // Added format from date-fns
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

export default function FinancialControlPage() {
  // Subscriptions State
  const [isAddSubscriptionDialogOpen, setIsAddSubscriptionDialogOpen] = useState(false);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const [isLoadingSubscriptions, setIsLoadingSubscriptions] = useState(true);

  // Loans State
  const [isAddLoanDialogOpen, setIsAddLoanDialogOpen] = useState(false);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [isLoadingLoans, setIsLoadingLoans] = useState(true);
  const [loanToDelete, setLoanToDelete] = useState<Loan | null>(null);
  const [isDeletingLoan, setIsDeletingLoan] = useState(false);

  // Credit Cards State
  const [isAddCreditCardDialogOpen, setIsAddCreditCardDialogOpen] = useState(false);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [editingCreditCard, setEditingCreditCard] = useState<CreditCard | null>(null);
  const [isLoadingCreditCards, setIsLoadingCreditCards] = useState(true);
  const [creditCardToDelete, setCreditCardToDelete] = useState<CreditCard | null>(null);
  const [isDeletingCreditCard, setIsDeletingCreditCard] = useState(false);

  // Budgets State
  const [isAddBudgetDialogOpen, setIsAddBudgetDialogOpen] = useState(false);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [isLoadingBudgets, setIsLoadingBudgets] = useState(true);
  const [budgetToDelete, setBudgetToDelete] = useState<Budget | null>(null);
  const [isDeletingBudget, setIsDeletingBudget] = useState(false);

  // Common State for data needed by multiple forms
  const [isLoadingCommonData, setIsLoadingCommonData] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [preferredCurrency, setPreferredCurrency] = useState('BRL');
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    if (typeof window === 'undefined') {
        setIsLoadingCommonData(false);
        setIsLoadingSubscriptions(false);
        setIsLoadingLoans(false);
        setIsLoadingCreditCards(false);
        setIsLoadingBudgets(false);
        return;
    }
    setIsLoadingCommonData(true);
    setIsLoadingSubscriptions(true);
    setIsLoadingLoans(true);
    setIsLoadingCreditCards(true);
    setIsLoadingBudgets(true);
    try {
      const prefs = await getUserPreferences();
      setPreferredCurrency(prefs.preferredCurrency);
      const [subs, cats, accs, grps, fetchedLoans, fetchedCreditCards, fetchedBudgets] = await Promise.all([
        getSubscriptions(),
        getCategories(),
        getAccounts(),
        getGroups(),
        getLoans(),
        getCreditCards(),
        getBudgets(),
      ]);
      setSubscriptions(subs.sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()));
      setCategories(cats);
      setAccounts(accs);
      setGroups(grps.sort((a, b) => a.name.localeCompare(b.name)));
      setLoans(fetchedLoans.sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()));
      setCreditCards(fetchedCreditCards.sort((a,b) => a.name.localeCompare(b.name)));
      setBudgets(fetchedBudgets.sort((a,b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error("Failed to fetch financial control data:", error);
      toast({ title: "Error", description: "Could not load data.", variant: "destructive" });
    } finally {
      setIsLoadingCommonData(false);
      setIsLoadingSubscriptions(false);
      setIsLoadingLoans(false);
      setIsLoadingCreditCards(false);
      setIsLoadingBudgets(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
    const handleStorageChange = (event: StorageEvent) => {
        if (typeof window !== 'undefined' && event.type === 'storage') {
            const isLikelyOurCustomEvent = event.key === null;
            const relevantKeysForThisPage = ['userSubscriptions', 'userLoans', 'userCreditCards', 'userBudgets', 'userCategories', 'userAccounts', 'userGroups', 'userPreferences', 'transactions-'];
            const isRelevantExternalChange = typeof event.key === 'string' && relevantKeysForThisPage.some(k => event.key!.includes(k));

            if (isLikelyOurCustomEvent || isRelevantExternalChange) {
                console.log(`Storage change for Financial Control (key: ${event.key || 'custom'}), refetching data...`);
                fetchData();
            }
        }
    };
    if (typeof window !== 'undefined') window.addEventListener('storage', handleStorageChange);
    return () => {
        if (typeof window !== 'undefined') window.removeEventListener('storage', handleStorageChange);
    };
  }, [fetchData]);

  // --- Subscription Handlers ---
  const handleSubscriptionAdded = async (data: AddSubscriptionFormData) => {
    try {
      const payload = {
        ...data,
        nextPaymentDate: data.nextPaymentDate.toISOString(),
        startDate: data.startDate.toISOString(),
      };

      if (editingSubscription) {
        await updateSubscription({
            ...editingSubscription,
            ...payload,
            groupId: data.groupId === "__NONE_GROUP__" || data.groupId === "" ? null : data.groupId,
            accountId: data.accountId === "__NONE_ACCOUNT__" || data.accountId === "" ? undefined : data.accountId,
            lastPaidMonth: editingSubscription.lastPaidMonth
        });
        toast({ title: "Success", description: "Subscription updated successfully." });
      } else {
        await saveSubscription({
            ...payload,
            groupId: data.groupId === "__NONE_GROUP__" || data.groupId === "" ? null : data.groupId,
            accountId: data.accountId === "__NONE_ACCOUNT__" || data.accountId === "" ? undefined : data.accountId,
            lastPaidMonth: null
        });
        toast({ title: "Success", description: "Subscription added successfully." });
      }
      setIsAddSubscriptionDialogOpen(false);
      setEditingSubscription(null);
      window.dispatchEvent(new Event('storage'));
    } catch (error: any) {
      console.error("Failed to save subscription:", error);
      toast({ title: "Error", description: `Could not save subscription: ${error.message}`, variant: "destructive" });
    }
  };

  const handleDeleteSubscription = async (subscriptionId: string) => {
    try {
      await deleteSubscription(subscriptionId);
      toast({ title: "Success", description: "Subscription deleted." });
      window.dispatchEvent(new Event('storage'));
    } catch (error: any) {
      console.error("Failed to delete subscription:", error);
      toast({ title: "Error", description: `Could not delete subscription: ${error.message}`, variant: "destructive" });
    }
  };

  const openEditSubscriptionDialog = (subscription: Subscription) => {
    setEditingSubscription(subscription);
    setIsAddSubscriptionDialogOpen(true);
  };

  const handleTogglePaidStatus = async (subscriptionId: string, currentlyPaid: boolean) => {
    const subscriptionToUpdate = subscriptions.find(sub => sub.id === subscriptionId);
    if (!subscriptionToUpdate) return;

    const newLastPaidMonth = currentlyPaid ? null : format(new Date(), 'yyyy-MM');

    try {
      await updateSubscription({ ...subscriptionToUpdate, lastPaidMonth: newLastPaidMonth });
      toast({ title: "Status Updated", description: `Subscription marked as ${newLastPaidMonth ? 'paid' : 'unpaid'} for this month.` });
      
      if (newLastPaidMonth) { // If marked as paid
        if (subscriptionToUpdate.accountId) {
          const transactionData = {
            accountId: subscriptionToUpdate.accountId,
            amount: -Math.abs(subscriptionToUpdate.amount),
            transactionCurrency: subscriptionToUpdate.currency,
            date: format(new Date(), 'yyyy-MM-dd'),
            description: `Pagamento Assinatura: ${subscriptionToUpdate.name}`,
            category: subscriptionToUpdate.category,
            tags: subscriptionToUpdate.tags || [],
          };
          await addTransaction(transactionData);
          toast({ title: "Despesa Registrada", description: "Despesa da assinatura registrada automaticamente." });
        } else {
          toast({
            title: "Ação Necessária",
            description: "Assinatura marcada como paga. Associe uma conta para registrar a despesa automaticamente ou adicione manualmente.",
            variant: "default",
            duration: 7000,
          });
        }
      }
      window.dispatchEvent(new Event('storage')); // Refresh main data
    } catch (error: any) {
      console.error("Failed to update paid status or create transaction:", error);
      toast({ title: "Error", description: "Could not update paid status or create expense.", variant: "destructive" });
    }
  };


  // --- Loan Handlers ---
  const handleLoanAdded = async (data: NewLoanData) => {
    try {
        if (editingLoan) {
            await changeLoan({ ...editingLoan, ...data, loanType: data.loanType || 'other' });
            toast({ title: "Success", description: "Loan updated successfully." });
        } else {
            await saveLoan({ ...data, loanType: data.loanType || 'other' });
            toast({ title: "Success", description: "Loan added successfully." });
        }
        setIsAddLoanDialogOpen(false);
        setEditingLoan(null);
        window.dispatchEvent(new Event('storage'));
    } catch (error: any) {
        console.error("Failed to save loan:", error);
        toast({ title: "Error", description: `Could not save loan: ${error.message}`, variant: "destructive" });
    }
  };

  const openEditLoanDialog = (loan: Loan) => {
    setEditingLoan(loan);
    setIsAddLoanDialogOpen(true);
  };

  const handleDeleteLoan = async (loanId: string) => {
    const loan = loans.find(l => l.id === loanId);
    if (loan) setLoanToDelete(loan);
  };

  const confirmDeleteLoan = async () => {
    if (!loanToDelete) return;
    setIsDeletingLoan(true);
    try {
      await removeLoan(loanToDelete.id);
      toast({ title: "Success", description: "Loan deleted." });
      setLoanToDelete(null);
      window.dispatchEvent(new Event('storage'));
    } catch (error: any) {
      console.error("Failed to delete loan:", error);
      toast({ title: "Error", description: `Could not delete loan: ${error.message}`, variant: "destructive" });
    } finally {
      setIsDeletingLoan(false);
    }
  };

  // --- Credit Card Handlers ---
  const handleCreditCardAdded = async (data: NewCreditCardData) => {
    try {
      if (editingCreditCard) {
        await changeCreditCard({ ...editingCreditCard, ...data });
        toast({ title: "Success", description: "Credit Card updated successfully." });
      } else {
        await saveCreditCard(data);
        toast({ title: "Success", description: "Credit Card added successfully." });
      }
      setIsAddCreditCardDialogOpen(false);
      setEditingCreditCard(null);
      window.dispatchEvent(new Event('storage'));
    } catch (error: any) {
      console.error("Failed to save credit card:", error);
      toast({ title: "Error", description: `Could not save credit card: ${error.message}`, variant: "destructive" });
    }
  };

  const openEditCreditCardDialog = (card: CreditCard) => {
    setEditingCreditCard(card);
    setIsAddCreditCardDialogOpen(true);
  };

  const handleDeleteCreditCard = (cardId: string) => {
    const card = creditCards.find(c => c.id === cardId);
    if (card) setCreditCardToDelete(card);
  };

  const confirmDeleteCreditCard = async () => {
    if (!creditCardToDelete) return;
    setIsDeletingCreditCard(true);
    try {
      await removeCreditCard(creditCardToDelete.id);
      toast({ title: "Success", description: "Credit Card deleted." });
      setCreditCardToDelete(null);
      window.dispatchEvent(new Event('storage'));
    } catch (error: any) {
      console.error("Failed to delete credit card:", error);
      toast({ title: "Error", description: `Could not delete credit card: ${error.message}`, variant: "destructive" });
    } finally {
      setIsDeletingCreditCard(false);
    }
  };

  // --- Budget Handlers ---
  const handleBudgetAdded = async (data: NewBudgetData) => {
    try {
        if (editingBudget) {
            await changeBudget({ ...editingBudget, ...data });
            toast({ title: "Success", description: "Budget updated successfully." });
        } else {
            await saveBudget(data);
            toast({ title: "Success", description: "Budget added successfully." });
        }
        setIsAddBudgetDialogOpen(false);
        setEditingBudget(null);
        window.dispatchEvent(new Event('storage'));
    } catch (error: any) {
        console.error("Failed to save budget:", error);
        toast({ title: "Error", description: `Could not save budget: ${error.message}`, variant: "destructive" });
    }
  };

  const openEditBudgetDialog = (budget: Budget) => {
    setEditingBudget(budget);
    setIsAddBudgetDialogOpen(true);
  };

  const handleDeleteBudget = (budgetId: string) => {
    const budget = budgets.find(b => b.id === budgetId);
    if (budget) setBudgetToDelete(budget);
  };

  const confirmDeleteBudget = async () => {
    if (!budgetToDelete) return;
    setIsDeletingBudget(true);
    try {
      await removeBudgetDb(budgetToDelete.id);
      toast({ title: "Success", description: "Budget deleted." });
      setBudgetToDelete(null);
      window.dispatchEvent(new Event('storage'));
    } catch (error: any) {
      console.error("Failed to delete budget:", error);
      toast({ title: "Error", description: `Could not delete budget: ${error.message}`, variant: "destructive" });
    } finally {
      setIsDeletingBudget(false);
    }
  };


  // --- Rendering Logic for Subscriptions ---
  const groupSubscriptionsByType = (type: 'income' | 'expense') => {
    const filteredSubs = subscriptions.filter(sub => sub.type === type);
    const grouped: Record<string, Subscription[]> = {};

    filteredSubs.forEach(sub => {
      const groupId = sub.groupId || 'no-group';
      if (!grouped[groupId]) grouped[groupId] = [];
      grouped[groupId].push(sub);
    });
    return grouped;
  };

  const incomeSubscriptionsByGroup = useMemo(() => groupSubscriptionsByType('income'), [subscriptions]);
  const expenseSubscriptionsByGroup = useMemo(() => groupSubscriptionsByType('expense'), [subscriptions]);

  const calculateMonthlyEquivalent = (amount: number, currency: string, frequency: SubscriptionFrequency): number => {
    const amountInPreferredCurrency = convertCurrency(amount, currency, preferredCurrency);
    switch (frequency) {
      case 'daily': return amountInPreferredCurrency * 30;
      case 'weekly': return amountInPreferredCurrency * 4;
      case 'bi-weekly': return amountInPreferredCurrency * 2;
      case 'monthly': return amountInPreferredCurrency;
      case 'quarterly': return amountInPreferredCurrency / 3;
      case 'semi-annually': return amountInPreferredCurrency / 6;
      case 'annually': return amountInPreferredCurrency / 12;
      default: return 0;
    }
  };

  const renderSubscriptionCard = (subscription: Subscription) => {
    const currentMonthStr = format(new Date(), 'yyyy-MM');
    const isPaidThisMonth = subscription.lastPaidMonth === currentMonthStr;

    return (
    <Card key={subscription.id} className="mb-4 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-md">{subscription.name}</CardTitle>
          <span className={`font-semibold text-sm ${subscription.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {formatCurrency(subscription.amount, subscription.currency, preferredCurrency, true)}
            {subscription.currency.toUpperCase() !== preferredCurrency.toUpperCase() &&
             <span className="text-xs text-muted-foreground ml-1">({formatCurrency(subscription.amount, subscription.currency, subscription.currency, false)})</span>}
          </span>
        </div>
        <CardDescription className="text-xs">
          {subscription.category} - {subscription.frequency.charAt(0).toUpperCase() + subscription.frequency.slice(1)}
          {subscription.description && ` - ${subscription.description}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-xs space-y-1 pt-2 pb-4">
        <p><span className="font-medium">Next Payment:</span> {format(parseISO(subscription.nextPaymentDate), 'MMM dd, yyyy')}</p>
        {subscription.accountId && <p><span className="font-medium">Account:</span> {accounts.find(acc => acc.id === subscription.accountId)?.name || 'N/A'}</p>}
         <div className="flex items-center space-x-2 pt-1">
          <Checkbox
            id={`paid-${subscription.id}`}
            checked={isPaidThisMonth}
            onCheckedChange={(checked) => handleTogglePaidStatus(subscription.id, !!checked)}
            aria-label={`Mark ${subscription.name} as paid for ${format(new Date(), 'MMMM yyyy')}`}
          />
          <Label htmlFor={`paid-${subscription.id}`} className="text-xs font-medium">
            Paid for {format(new Date(), 'MMMM yyyy')}?
          </Label>
        </div>
         <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => openEditSubscriptionDialog(subscription)}>Edit</Button>
            <Button variant="destructive" size="sm" onClick={() => handleDeleteSubscription(subscription.id)}>Delete</Button>
        </div>
      </CardContent>
    </Card>
  )};

  const renderGroupedSubscriptions = (groupedData: Record<string, Subscription[]>, type: 'income' | 'expense') => {
    const groupOrder = ['no-group', ...groups.map(g => g.id)];

    return groupOrder.map(groupId => {
      const subsInGroup = groupedData[groupId];
      if (!subsInGroup || subsInGroup.length === 0) return null;

      const group = groups.find(g => g.id === groupId);
      const groupName = group ? group.name : "Not Grouped";

      const totalMonthlyForGroup = subsInGroup.reduce((sum, sub) => {
        return sum + calculateMonthlyEquivalent(sub.amount, sub.currency, sub.frequency);
      }, 0);

      return (
        <div key={`${type}-${groupId}`} className="mb-6">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center">
              {group && <Users className="h-4 w-4 mr-2 text-muted-foreground" />}
              <h3 className="text-lg font-semibold">{groupName}</h3>
              {group && (
                <Link href={`/groups/${group.id}`} passHref legacyBehavior>
                   <Button variant="ghost" size="sm" className="h-7 px-2 ml-2 flex items-center gap-1 text-primary hover:text-primary/80">
                     <Eye className="h-3.5 w-3.5" />
                     <span className="text-xs">Details</span>
                   </Button>
                </Link>
              )}
            </div>
            <span className={`text-sm font-semibold ${type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              Monthly: {formatCurrency(totalMonthlyForGroup, preferredCurrency, preferredCurrency, false)}
            </span>
          </div>
          <Separator className="mb-4" />
          {subsInGroup.map(renderSubscriptionCard)}
        </div>
      );
    }).filter(Boolean);
  };

  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8 space-y-8">
      <h1 className="text-3xl font-bold">Financial Control</h1>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Subscriptions</CardTitle>
            <Dialog open={isAddSubscriptionDialogOpen} onOpenChange={(isOpen) => {
                setIsAddSubscriptionDialogOpen(isOpen);
                if (!isOpen) setEditingSubscription(null);
            }}>
              <DialogTrigger asChild>
                <Button>
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Subscription
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editingSubscription ? 'Edit' : 'Add New'} Subscription</DialogTitle>
                  <DialogDescription>
                    {editingSubscription ? 'Update the details of your subscription.' : 'Enter the details of your new recurring income or expense.'}
                  </DialogDescription>
                </DialogHeader>
                {isLoadingCommonData ? (
                     <Skeleton className="h-60 w-full" />
                ) : (
                    <AddSubscriptionForm
                    key={editingSubscription ? editingSubscription.id : 'new-subscription'}
                    onSubmit={handleSubscriptionAdded}
                    isLoading={isLoadingSubscriptions}
                    categories={categories}
                    accounts={accounts}
                    groups={groups}
                    initialData={editingSubscription ? {
                        ...editingSubscription,
                        startDate: parseISO(editingSubscription.startDate),
                        nextPaymentDate: parseISO(editingSubscription.nextPaymentDate),
                        tags: editingSubscription.tags || [],
                        description: editingSubscription.description || "",
                    } : undefined}
                    />
                )}
              </DialogContent>
            </Dialog>
          </div>
          <CardDescription>Manage your recurring income and expenses.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="grid md:grid-cols-2 gap-8">
                <Card className="bg-card/50">
                    <CardHeader>
                        <div className="flex items-center">
                        <ArrowUpCircle className="h-6 w-6 mr-2 text-green-500" />
                        <CardTitle>Income Subscriptions</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {isLoadingSubscriptions ? (
                        <Skeleton className="h-40 w-full" />
                        ) : Object.keys(incomeSubscriptionsByGroup).length > 0 && Object.values(incomeSubscriptionsByGroup).some(arr => arr.length > 0) ? (
                        renderGroupedSubscriptions(incomeSubscriptionsByGroup, 'income')
                        ) : (
                        <div className="text-center py-10">
                            <p className="text-muted-foreground">
                            No recurring income added yet.
                            </p>
                        </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="bg-card/50">
                    <CardHeader>
                        <div className="flex items-center">
                        <ArrowDownCircle className="h-6 w-6 mr-2 text-red-500" />
                        <CardTitle>Expense Subscriptions</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {isLoadingSubscriptions ? (
                        <Skeleton className="h-40 w-full" />
                        ) : Object.keys(expenseSubscriptionsByGroup).length > 0 && Object.values(expenseSubscriptionsByGroup).some(arr => arr.length > 0) ? (
                        renderGroupedSubscriptions(expenseSubscriptionsByGroup, 'expense')
                        ) : (
                        <div className="text-center py-10">
                            <p className="text-muted-foreground">
                            No recurring expenses added yet.
                            </p>
                        </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </CardContent>
      </Card>

     <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Loans</CardTitle>
            <Dialog open={isAddLoanDialogOpen} onOpenChange={(isOpen) => {
              setIsAddLoanDialogOpen(isOpen);
              if (!isOpen) setEditingLoan(null);
            }}>
              <DialogTrigger asChild>
                <Button variant="default" size="sm">
                  <Landmark className="mr-2 h-4 w-4" /> Add New Loan
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editingLoan ? 'Edit' : 'Add New'} Loan</DialogTitle>
                  <DialogDescription>
                    {editingLoan ? 'Update the details of your loan.' : 'Enter the details for your new loan.'}
                  </DialogDescription>
                </DialogHeader>
                {isLoadingCommonData ? (<Skeleton className="h-80 w-full" />) : (
                  <AddLoanForm
                    key={editingLoan ? editingLoan.id : 'new-loan'}
                    onSubmit={handleLoanAdded}
                    isLoading={isLoadingLoans}
                    initialData={editingLoan ? {
                      ...editingLoan,
                      startDate: parseISO(editingLoan.startDate),
                      loanType: editingLoan.loanType,
                      notes: editingLoan.notes || "",
                    } : undefined}
                  />
                )}
              </DialogContent>
            </Dialog>
          </div>
          <CardDescription>
            Track your loans, payments, and remaining balances.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingLoans ? (
            <div className="space-y-4">
              {[...Array(2)].map((_, i) => <Skeleton key={`loan-skel-${i}`} className="h-40 w-full" />)}
            </div>
          ) : loans.length > 0 ? (
            <div className="space-y-4">
              {loans.map(loan => (
                <Card key={loan.id} className="shadow-sm">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{loan.name}</CardTitle>
                        <CardDescription className="text-xs">
                          {loanTypeLabels[loan.loanType] || 'Loan'} from {loan.lender}
                        </CardDescription>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditLoanDialog(loan)}>
                            <Edit className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <div
                                className="relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-destructive/10 focus:text-destructive text-destructive data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                                onClick={() => handleDeleteLoan(loan.id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </div>
                            </AlertDialogTrigger>
                            {loanToDelete?.id === loan.id && (
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action will permanently delete the loan "{loanToDelete.name}".
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel onClick={() => setLoanToDelete(null)} disabled={isDeletingLoan}>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={confirmDeleteLoan} disabled={isDeletingLoan} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    {isDeletingLoan ? "Deleting..." : "Delete Loan"}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            )}
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="text-sm space-y-2">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      <div><strong>Original Amount:</strong> {formatCurrency(loan.originalAmount, loan.currency, preferredCurrency, true)}
                        {loan.currency !== preferredCurrency && <span className="text-xs text-muted-foreground block">({formatCurrency(loan.originalAmount, loan.currency, loan.currency, false)})</span>}
                      </div>
                      <div className="text-primary font-semibold"><strong>Remaining:</strong> {formatCurrency(loan.remainingBalance, loan.currency, preferredCurrency, true)}
                        {loan.currency !== preferredCurrency && <span className="text-xs text-muted-foreground block">({formatCurrency(loan.remainingBalance, loan.currency, loan.currency, false)})</span>}
                      </div>
                      <div><strong>Interest Rate (APR):</strong> {loan.interestRate.toFixed(2)}%</div>
                      <div><strong>Term:</strong> {loan.termMonths} months</div>
                      <div><strong>Monthly Payment:</strong> {formatCurrency(loan.monthlyPayment, loan.currency, preferredCurrency, true)}</div>
                       <div><strong>Next Payment:</strong> {format(parseISO(loan.nextPaymentDate), 'MMM dd, yyyy')}</div>
                    </div>
                    {loan.notes && <p className="text-xs text-muted-foreground pt-1"><strong>Notes:</strong> {loan.notes}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <p className="text-muted-foreground">No loans added yet.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Credit Cards</CardTitle>
            <Dialog open={isAddCreditCardDialogOpen} onOpenChange={(isOpen) => {
              setIsAddCreditCardDialogOpen(isOpen);
              if (!isOpen) setEditingCreditCard(null);
            }}>
              <DialogTrigger asChild>
                <Button variant="default" size="sm">
                  <CreditCardIconLucide className="mr-2 h-4 w-4" /> Add New Credit Card
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editingCreditCard ? 'Edit' : 'Add New'} Credit Card</DialogTitle>
                  <DialogDescription>
                    {editingCreditCard ? 'Update the details of your credit card.' : 'Enter the details for your new credit card.'}
                  </DialogDescription>
                </DialogHeader>
                {isLoadingCommonData ? (<Skeleton className="h-80 w-full" />) : (
                  <AddCreditCardForm
                    key={editingCreditCard ? editingCreditCard.id : 'new-credit-card'}
                    onSubmit={handleCreditCardAdded}
                    isLoading={isLoadingCreditCards}
                    initialData={editingCreditCard || undefined}
                  />
                )}
              </DialogContent>
            </Dialog>
          </div>
          <CardDescription>
            Manage your credit cards, limits, and balances.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingCreditCards ? (
            <div className="space-y-4">
              {[...Array(1)].map((_, i) => <Skeleton key={`cc-skel-${i}`} className="h-32 w-full" />)}
            </div>
          ) : creditCards.length > 0 ? (
            <div className="space-y-4">
              {creditCards.map(card => (
                <Card key={card.id} className="shadow-sm">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{card.name}</CardTitle>
                        <CardDescription className="text-xs">
                          {card.bankName}
                        </CardDescription>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditCreditCardDialog(card)}>
                            <Edit className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <div
                                className="relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-destructive/10 focus:text-destructive text-destructive data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                                onClick={() => handleDeleteCreditCard(card.id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </div>
                            </AlertDialogTrigger>
                            {creditCardToDelete?.id === card.id && (
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action will permanently delete the credit card "{creditCardToDelete.name}".
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel onClick={() => setCreditCardToDelete(null)} disabled={isDeletingCreditCard}>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={confirmDeleteCreditCard} disabled={isDeletingCreditCard} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    {isDeletingCreditCard ? "Deleting..." : "Delete Credit Card"}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            )}
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="text-sm space-y-2">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      <div><strong>Limit:</strong> {formatCurrency(card.limit, card.currency, preferredCurrency, true)}
                        {card.currency !== preferredCurrency && <span className="text-xs text-muted-foreground block">({formatCurrency(card.limit, card.currency, card.currency, false)})</span>}
                      </div>
                       <div className={`font-semibold ${card.currentBalance >=0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          <strong>Balance:</strong> {formatCurrency(card.currentBalance, card.currency, preferredCurrency, true)}
                        {card.currency !== preferredCurrency && <span className="text-xs text-muted-foreground block">({formatCurrency(card.currentBalance, card.currency, card.currency, false)})</span>}
                      </div>
                      {card.paymentDueDate && <div><strong>Due Date:</strong> {format(parseISO(card.paymentDueDate), 'MMM dd, yyyy')}</div>}
                      {card.statementClosingDay && <div><strong>Closes On:</strong> Day {card.statementClosingDay}</div>}
                      {card.interestRate !== undefined && card.interestRate !== null && <div><strong>APR:</strong> {card.interestRate.toFixed(2)}%</div>}
                    </div>
                    {card.notes && <p className="text-xs text-muted-foreground pt-1"><strong>Notes:</strong> {card.notes}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <p className="text-muted-foreground">No credit cards added yet.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Budgets Card */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Budgets</CardTitle>
            <Dialog open={isAddBudgetDialogOpen} onOpenChange={(isOpen) => {
              setIsAddBudgetDialogOpen(isOpen);
              if (!isOpen) setEditingBudget(null);
            }}>
              <DialogTrigger asChild>
                <Button variant="default" size="sm">
                  <PercentCircle className="mr-2 h-4 w-4" /> Add New Budget
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editingBudget ? 'Edit' : 'Add New'} Budget</DialogTitle>
                  <DialogDescription>
                    {editingBudget ? 'Update your budget details.' : 'Define a new budget for categories or groups.'}
                  </DialogDescription>
                </DialogHeader>
                {isLoadingCommonData ? (<Skeleton className="h-96 w-full" />) : (
                  <AddBudgetForm
                    key={editingBudget ? editingBudget.id : 'new-budget'}
                    onSubmit={handleBudgetAdded}
                    isLoading={isLoadingBudgets}
                    categories={categories}
                    groups={groups}
                    initialData={editingBudget || undefined}
                  />
                )}
              </DialogContent>
            </Dialog>
          </div>
          <CardDescription>
            Create and track your spending against budgets for different categories or groups.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingBudgets ? (
            <div className="space-y-4">
              {[...Array(1)].map((_, i) => <Skeleton key={`budget-skel-${i}`} className="h-24 w-full" />)}
            </div>
          ) : budgets.length > 0 ? (
            <div className="space-y-4">
              {budgets.map(budget => (
                <Card key={budget.id} className="shadow-sm">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{budget.name}</CardTitle>
                        <CardDescription className="text-xs">
                          {formatCurrency(budget.amount, budget.currency, preferredCurrency, true)} / {budget.period}
                          {budget.currency !== preferredCurrency && <span className="text-xs text-muted-foreground block">({formatCurrency(budget.amount, budget.currency, budget.currency, false)})</span>}
                        </CardDescription>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditBudgetDialog(budget)}>
                            <Edit className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <div
                                className="relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-destructive/10 focus:text-destructive text-destructive data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                                onClick={() => handleDeleteBudget(budget.id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </div>
                            </AlertDialogTrigger>
                            {budgetToDelete?.id === budget.id && (
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action will permanently delete the budget "{budgetToDelete.name}".
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel onClick={() => setBudgetToDelete(null)} disabled={isDeletingBudget}>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={confirmDeleteBudget} disabled={isDeletingBudget} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    {isDeletingBudget ? "Deleting..." : "Delete Budget"}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            )}
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="text-sm space-y-2">
                    <p><strong>Period:</strong> {budget.period.charAt(0).toUpperCase() + budget.period.slice(1)} starting {format(parseISO(budget.startDate), "MMM dd, yyyy")}
                       {budget.period === 'custom' && budget.endDate ? ` to ${format(parseISO(budget.endDate), "MMM dd, yyyy")}` : ''}
                    </p>
                    <p><strong>Applies to:</strong> {budget.appliesTo === 'categories' ? 'Categories' : 'Groups'}</p>
                    <div className="flex flex-wrap gap-1">
                        {budget.selectedIds.map(id => {
                            const item = budget.appliesTo === 'categories' ? categories.find(c=>c.id === id) : groups.find(g=>g.id === id);
                            return item ? <Badge key={id} variant="secondary">{item.name}</Badge> : null;
                        })}
                    </div>
                     <div className="pt-2">
                        <Label className="text-xs text-muted-foreground">Spending Progress (Coming Soon)</Label>
                        <Progress value={0} className="h-2 mt-1" />
                        <div className="flex justify-between text-xs mt-1">
                            <span>{formatCurrency(0, preferredCurrency, preferredCurrency, false)} spent</span>
                            <span>{formatCurrency(budget.amount, budget.currency, preferredCurrency, false)}</span>
                        </div>
                    </div>
                    {budget.notes && <p className="text-xs text-muted-foreground pt-1"><strong>Notes:</strong> {budget.notes}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <p className="text-muted-foreground">No budgets created yet.</p>
            </div>
          )}
        </CardContent>
      </Card>


      <Card>
        <CardHeader>
          <CardTitle>Target</CardTitle>
          <CardDescription>
            Set up and track progress towards your savings goals.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-10">
            <p className="text-muted-foreground">
              Target (Savings Goals) feature coming soon!
            </p>
          </div>
        </CardContent>
      </Card>

      {loanToDelete && !loans.find(l => l.id === loanToDelete.id && editingLoan?.id !== l.id) && (
         <AlertDialog open={!!loanToDelete} onOpenChange={(open) => { if(!open) setLoanToDelete(null);}}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Loan?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to delete the loan "{loanToDelete.name}"? This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setLoanToDelete(null)} disabled={isDeletingLoan}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmDeleteLoan} disabled={isDeletingLoan} className="bg-destructive hover:bg-destructive/80">
                        {isDeletingLoan ? "Deleting..." : "Delete Loan"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
         </AlertDialog>
      )}
       {creditCardToDelete && !creditCards.find(c => c.id === creditCardToDelete.id && editingCreditCard?.id !== c.id) && (
         <AlertDialog open={!!creditCardToDelete} onOpenChange={(open) => { if(!open) setCreditCardToDelete(null);}}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Credit Card?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to delete the card "{creditCardToDelete.name}"? This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setCreditCardToDelete(null)} disabled={isDeletingCreditCard}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmDeleteCreditCard} disabled={isDeletingCreditCard} className="bg-destructive hover:bg-destructive/80">
                        {isDeletingCreditCard ? "Deleting..." : "Delete Credit Card"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
         </AlertDialog>
      )}
      {budgetToDelete && !budgets.find(b => b.id === budgetToDelete.id && editingBudget?.id !== b.id) && (
         <AlertDialog open={!!budgetToDelete} onOpenChange={(open) => { if(!open) setBudgetToDelete(null);}}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Budget?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to delete the budget "{budgetToDelete.name}"? This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setBudgetToDelete(null)} disabled={isDeletingBudget}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmDeleteBudget} disabled={isDeletingBudget} className="bg-destructive hover:bg-destructive/80">
                        {isDeletingBudget ? "Deleting..." : "Delete Budget"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
         </AlertDialog>
      )}


    </div>
  );
}


    