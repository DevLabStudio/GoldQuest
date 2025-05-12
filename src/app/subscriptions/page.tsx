'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { PlusCircle, ArrowUpCircle, ArrowDownCircle, Users } from 'lucide-react'; // Added Users for group icon
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from "@/components/ui/checkbox"; // Import Checkbox
import { Label } from "@/components/ui/label"; // Import Label
import AddSubscriptionForm, { type AddSubscriptionFormData } from '@/components/subscriptions/add-subscription-form';
import type { Subscription, SubscriptionFrequency } from '@/services/subscriptions';
import { getSubscriptions, addSubscription as saveSubscription, deleteSubscription, updateSubscription } from '@/services/subscriptions';
import { getCategories, type Category } from '@/services/categories';
import { getAccounts, type Account } from '@/services/account-sync';
import { getGroups, type Group } from '@/services/groups'; // Import Group service
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/currency';
import { getUserPreferences } from '@/lib/preferences';
import { format, parseISO, isSameMonth, isSameYear } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

export default function SubscriptionsPage() {
  const [isAddSubscriptionDialogOpen, setIsAddSubscriptionDialogOpen] = useState(false);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [groups, setGroups] = useState<Group[]>([]); // State for groups
  const [isLoading, setIsLoading] = useState(true);
  const [preferredCurrency, setPreferredCurrency] = useState('BRL');
  const { toast } = useToast();
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);


  const fetchData = async () => {
    setIsLoading(true);
    try {
      const prefs = await getUserPreferences();
      setPreferredCurrency(prefs.preferredCurrency);
      const [subs, cats, accs, grps] = await Promise.all([ // Fetch groups
        getSubscriptions(),
        getCategories(),
        getAccounts(),
        getGroups(),
      ]);
      setSubscriptions(subs.sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()));
      setCategories(cats);
      setAccounts(accs);
      setGroups(grps); // Set groups state
    } catch (error) {
      console.error("Failed to fetch subscriptions data:", error);
      toast({ title: "Error", description: "Could not load subscriptions.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [toast]);

  const handleSubscriptionAdded = async (data: AddSubscriptionFormData) => {
    try {
      const payload = {
        ...data,
        nextPaymentDate: data.nextPaymentDate.toISOString(),
        startDate: data.startDate.toISOString(), // Ensure startDate is ISO string
        // lastPaidMonth will be handled by handleTogglePaidStatus or set to null initially
      };

      if (editingSubscription) {
        await updateSubscription({ 
            ...editingSubscription, 
            ...payload,
            // Preserve existing lastPaidMonth if not explicitly changed by other means
            lastPaidMonth: editingSubscription.lastPaidMonth 
        });
        toast({ title: "Success", description: "Subscription updated successfully." });
      } else {
        await saveSubscription({ ...payload, lastPaidMonth: null }); // New subs start as not paid for current cycle
        toast({ title: "Success", description: "Subscription added successfully." });
      }
      setIsAddSubscriptionDialogOpen(false);
      setEditingSubscription(null);
      fetchData(); // Refresh list
    } catch (error: any) {
      console.error("Failed to save subscription:", error);
      toast({ title: "Error", description: `Could not save subscription: ${error.message}`, variant: "destructive" });
    }
  };

  const handleDeleteSubscription = async (subscriptionId: string) => {
    try {
      await deleteSubscription(subscriptionId);
      toast({ title: "Success", description: "Subscription deleted." });
      fetchData();
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
      fetchData(); // Refresh list
    } catch (error: any) {
      console.error("Failed to update paid status:", error);
      toast({ title: "Error", description: "Could not update paid status.", variant: "destructive" });
    }
  };

  const incomeSubscriptions = subscriptions.filter(sub => sub.type === 'income');
  const expenseSubscriptions = subscriptions.filter(sub => sub.type === 'expense');

  const renderSubscriptionCard = (subscription: Subscription) => {
    const currentMonthStr = format(new Date(), 'yyyy-MM');
    const isPaidThisMonth = subscription.lastPaidMonth === currentMonthStr;
    const groupName = subscription.groupId ? groups.find(g => g.id === subscription.groupId)?.name : null;

    return (
    <Card key={subscription.id} className="mb-4">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg">{subscription.name}</CardTitle>
          <span className={`font-semibold ${subscription.type === 'income' ? 'text-green-500' : 'text-red-500'}`}>
            {formatCurrency(subscription.amount, subscription.currency, preferredCurrency, true)}
            {subscription.currency.toUpperCase() !== preferredCurrency.toUpperCase() &&
             <span className="text-xs text-muted-foreground ml-1">({formatCurrency(subscription.amount, subscription.currency, subscription.currency, false)})</span>}
          </span>
        </div>
        <CardDescription className="text-xs">
          {subscription.category} - {subscription.frequency.charAt(0).toUpperCase() + subscription.frequency.slice(1)}
          {groupName && (
            <span className="ml-2 inline-flex items-center">
              <Users className="h-3 w-3 mr-1 text-muted-foreground" /> {groupName}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm space-y-2 pt-2"> {/* Increased space-y */}
        <p>Next Payment: {format(parseISO(subscription.nextPaymentDate), 'MMM dd, yyyy')}</p>
        {subscription.accountId && <p>Account: {accounts.find(acc => acc.id === subscription.accountId)?.name || 'N/A'}</p>}
         <div className="flex items-center space-x-2 pt-1"> {/* Added pt-1 */}
          <Checkbox
            id={`paid-${subscription.id}`}
            checked={isPaidThisMonth}
            onCheckedChange={(checked) => handleTogglePaidStatus(subscription.id, !!checked)}
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

  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Subscriptions</h1>
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
            <AddSubscriptionForm
              onSubmit={handleSubscriptionAdded}
              isLoading={isLoading}
              categories={categories}
              accounts={accounts}
              groups={groups} // Pass groups to the form
              initialData={editingSubscription ? {
                ...editingSubscription,
                startDate: parseISO(editingSubscription.startDate),
                nextPaymentDate: parseISO(editingSubscription.nextPaymentDate),
                // lastPaidMonth is handled by the checkbox logic, not directly edited in form
              } : undefined}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <div className="flex items-center">
              <ArrowUpCircle className="h-6 w-6 mr-2 text-green-500" />
              <CardTitle>Income Subscriptions</CardTitle>
            </div>
            <CardDescription>
              Recurring income sources.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : incomeSubscriptions.length > 0 ? (
              incomeSubscriptions.map(renderSubscriptionCard)
            ) : (
              <div className="text-center py-10">
                <p className="text-muted-foreground">
                  No recurring income added yet.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center">
              <ArrowDownCircle className="h-6 w-6 mr-2 text-red-500" />
              <CardTitle>Expense Subscriptions</CardTitle>
            </div>
            <CardDescription>
              Recurring expenses and bills.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : expenseSubscriptions.length > 0 ? (
              expenseSubscriptions.map(renderSubscriptionCard)
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
    </div>
  );
}
