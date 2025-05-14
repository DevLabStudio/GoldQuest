'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { PlusCircle, ArrowUpCircle, ArrowDownCircle, Users, Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import AddSubscriptionForm, { type AddSubscriptionFormData } from '@/components/subscriptions/add-subscription-form';
import type { Subscription, SubscriptionFrequency } from '@/services/subscriptions';
import { getSubscriptions, addSubscription as saveSubscription, deleteSubscription, updateSubscription } from '@/services/subscriptions';
import { getCategories, type Category } from '@/services/categories';
import { getAccounts, type Account } from '@/services/account-sync';
import { getGroups, type Group } from '@/services/groups';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, convertCurrency } from '@/lib/currency';
import { getUserPreferences } from '@/lib/preferences';
import { format, parseISO, isSameMonth, isSameYear } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';

export default function FinancialControlPage() {
  // States for Subscriptions
  const [isAddSubscriptionDialogOpen, setIsAddSubscriptionDialogOpen] = useState(false);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoadingSubscriptions, setIsLoadingSubscriptions] = useState(true);
  const [preferredCurrency, setPreferredCurrency] = useState('BRL');
  const { toast } = useToast();
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);

  // --- Data Fetching for Subscriptions ---
  const fetchSubscriptionData = useCallback(async () => {
    if (typeof window === 'undefined') {
        setIsLoadingSubscriptions(false);
        return;
    }
    setIsLoadingSubscriptions(true);
    try {
      const prefs = await getUserPreferences();
      setPreferredCurrency(prefs.preferredCurrency);
      const [subs, cats, accs, grps] = await Promise.all([
        getSubscriptions(),
        getCategories(),
        getAccounts(),
        getGroups(),
      ]);
      setSubscriptions(subs.sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()));
      setCategories(cats);
      setAccounts(accs);
      setGroups(grps.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error("Failed to fetch subscriptions data:", error);
      toast({ title: "Error", description: "Could not load subscriptions.", variant: "destructive" });
    } finally {
      setIsLoadingSubscriptions(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSubscriptionData();
    const handleStorageChange = (event: StorageEvent) => {
        if (event.type === 'storage') {
            const isLikelyOurCustomEvent = event.key === null;
            const relevantKeysForThisPage = ['userSubscriptions', 'userCategories', 'userAccounts', 'userGroups', 'userPreferences', 'transactions-'];
            const isRelevantExternalChange = typeof event.key === 'string' && relevantKeysForThisPage.some(k => event.key!.includes(k));


            if (isLikelyOurCustomEvent || isRelevantExternalChange) {
                console.log(`Storage change for Financial Control (key: ${event.key || 'custom'}), refetching data...`);
                fetchSubscriptionData();
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
  }, [fetchSubscriptionData]);

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
      // await fetchSubscriptionData(); // Let storage event handle this
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
      // await fetchSubscriptionData(); // Let storage event handle this
      window.dispatchEvent(new Event('storage'));
    } catch (error: any) {
      console.error("Failed to delete subscription:", error);
      toast({ title: "Error", description: `Could not delete subscription: ${error.message}`, variant: "destructive" });
    }
  };

  const openEditDialog = (subscription: Subscription) => {
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
      // await fetchSubscriptionData(); // Let storage event handle this
      window.dispatchEvent(new Event('storage'));
    } catch (error: any) {
      console.error("Failed to update paid status:", error);
      toast({ title: "Error", description: "Could not update paid status.", variant: "destructive" });
    }
  };

  const groupSubscriptionsByType = (type: 'income' | 'expense') => {
    const filteredSubs = subscriptions.filter(sub => sub.type === type);
    const grouped: Record<string, Subscription[]> = {};

    filteredSubs.forEach(sub => {
      const groupId = sub.groupId || 'no-group';
      if (!grouped[groupId]) {
        grouped[groupId] = [];
      }
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
            <Button variant="outline" size="sm" onClick={() => openEditDialog(subscription)}>Edit</Button>
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

      {/* Budgets Section */}
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

      {/* Subscriptions Section */}
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
                {isLoadingSubscriptions && (!categories.length || !accounts.length || !groups.length) ? (
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

      {/* Piggy Banks Section */}
      <Card>
        <CardHeader>
          <CardTitle>Piggy Banks</CardTitle>
          <CardDescription>
            Set up and track progress towards your savings goals.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-10">
            <p className="text-muted-foreground">
              Piggy Banks feature coming soon!
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
