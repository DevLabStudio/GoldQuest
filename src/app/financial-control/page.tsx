
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { PlusCircle, ArrowUpCircle, ArrowDownCircle, Users, Eye, Landmark, PercentCircle, PiggyBank, Trash2, Edit } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import AddSubscriptionForm, { type AddSubscriptionFormData } from '@/components/subscriptions/add-subscription-form';
import type { Subscription, SubscriptionFrequency } from '@/services/subscriptions';
import { getSubscriptions, addSubscription as saveSubscription, deleteSubscription, updateSubscription } from '@/services/subscriptions';
import { getCategories, type Category } from '@/services/categories';
import { getAccounts, type Account } from '@/services/account-sync';
import { getGroups, type Group } from '@/services/groups';

import AddLoanForm, { type AddLoanFormData } from '@/components/loans/add-loan-form';
import type { Loan, NewLoanData } from '@/services/loans';
import { getLoans, addLoan as saveLoan, deleteLoan as removeLoan, updateLoan as changeLoan } from '@/services/loans';

import { useToast } from '@/hooks/use-toast';
import { formatCurrency, convertCurrency } from '@/lib/currency';
import { getUserPreferences } from '@/lib/preferences';
import { format, parseISO, isSameMonth, isSameYear } from 'date-fns';
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


  // Common State
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [preferredCurrency, setPreferredCurrency] = useState('BRL');
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    if (typeof window === 'undefined') {
        setIsLoadingSubscriptions(false);
        setIsLoadingLoans(false);
        return;
    }
    setIsLoadingSubscriptions(true);
    setIsLoadingLoans(true);
    try {
      const prefs = await getUserPreferences();
      setPreferredCurrency(prefs.preferredCurrency);
      const [subs, cats, accs, grps, fetchedLoans] = await Promise.all([
        getSubscriptions(),
        getCategories(),
        getAccounts(),
        getGroups(),
        getLoans(),
      ]);
      setSubscriptions(subs.sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()));
      setCategories(cats);
      setAccounts(accs);
      setGroups(grps.sort((a, b) => a.name.localeCompare(b.name)));
      setLoans(fetchedLoans.sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()));
    } catch (error) {
      console.error("Failed to fetch financial control data:", error);
      toast({ title: "Error", description: "Could not load data.", variant: "destructive" });
    } finally {
      setIsLoadingSubscriptions(false);
      setIsLoadingLoans(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
    const handleStorageChange = (event: StorageEvent) => {
        if (typeof window !== 'undefined' && event.type === 'storage') {
            const isLikelyOurCustomEvent = event.key === null;
            const relevantKeysForThisPage = ['userSubscriptions', 'userLoans', 'userCategories', 'userAccounts', 'userGroups', 'userPreferences', 'transactions-'];
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
      window.dispatchEvent(new Event('storage'));
    } catch (error: any) {
      console.error("Failed to update paid status:", error);
      toast({ title: "Error", description: "Could not update paid status.", variant: "destructive" });
    }
  };

  // --- Loan Handlers ---
  const handleLoanAdded = async (data: NewLoanData) => {
    try {
        if (editingLoan) {
            await changeLoan({ ...editingLoan, ...data });
            toast({ title: "Success", description: "Loan updated successfully." });
        } else {
            await saveLoan(data);
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
      <CardContent className="text-xs space-y-1 pt-2">
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
                {(isLoadingSubscriptions || isLoadingLoans) && (!categories.length || !accounts.length || !groups.length) ? (
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
                 {(isLoadingLoans || isLoadingSubscriptions) ? ( <Skeleton className="h-80 w-full"/>) : (
                    <AddLoanForm
                        key={editingLoan ? editingLoan.id : 'new-loan'}
                        onSubmit={handleLoanAdded}
                        isLoading={isLoadingLoans}
                        initialData={editingLoan ? {
                            ...editingLoan,
                            startDate: parseISO(editingLoan.startDate),
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
                {[...Array(2)].map((_,i) => <Skeleton key={`loan-skel-${i}`} className="h-24 w-full"/>)}
            </div>
           ) : loans.length > 0 ? (
            <div className="space-y-4">
                {loans.map(loan => (
                    <Card key={loan.id} className="bg-muted/30 dark:bg-muted/20">
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                                <CardTitle className="text-lg">{loan.name}</CardTitle>
                                <Badge variant="outline">{loan.currency}</Badge>
                            </div>
                            <CardDescription className="text-xs">Lender: {loan.lender}</CardDescription>
                        </CardHeader>
                        <CardContent className="text-sm space-y-1">
                            <p><span className="font-medium">Original:</span> {formatCurrency(loan.originalAmount, loan.currency, preferredCurrency, true)}
                               {loan.currency !== preferredCurrency && <span className="text-xs text-muted-foreground"> ({formatCurrency(loan.originalAmount, loan.currency, loan.currency, false)})</span>}
                            </p>
                            <p><span className="font-medium">Remaining:</span> {formatCurrency(loan.remainingBalance, loan.currency, preferredCurrency, true)}
                               {loan.currency !== preferredCurrency && <span className="text-xs text-muted-foreground"> ({formatCurrency(loan.remainingBalance, loan.currency, loan.currency, false)})</span>}
                            </p>
                            <p><span className="font-medium">APR:</span> {loan.interestRate}%</p>
                            <p><span className="font-medium">Term:</span> {loan.termMonths} months</p>
                            <p><span className="font-medium">Monthly Payment:</span> {formatCurrency(loan.monthlyPayment, loan.currency, preferredCurrency, true)}</p>
                            <p><span className="font-medium">Start Date:</span> {format(parseISO(loan.startDate), 'MMM dd, yyyy')}</p>
                            <p><span className="font-medium">Next Payment:</span> {format(parseISO(loan.nextPaymentDate), 'MMM dd, yyyy')}</p>
                            {loan.notes && <p className="text-xs text-muted-foreground pt-1">Notes: {loan.notes}</p>}
                            <div className="flex gap-2 pt-2">
                               <Button variant="outline" size="sm" onClick={() => openEditLoanDialog(loan)}><Edit className="mr-1 h-3 w-3"/>Edit</Button>
                               <Button variant="destructive" size="sm" onClick={() => handleDeleteLoan(loan.id)}><Trash2 className="mr-1 h-3 w-3"/>Delete</Button>
                            </div>
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

      {loanToDelete && (
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


      <Card>
        <CardHeader>
          <CardTitle>Budgets</CardTitle>
          <CardDescription>
            Create and track your spending against budgets for different categories.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-10">
            <p className="text-muted-foreground">
              Budgets feature coming soon!
            </p>
          </div>
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
    </div>
  );
}

