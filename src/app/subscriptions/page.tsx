
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { PlusCircle, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import AddSubscriptionForm, { type AddSubscriptionFormData } from '@/components/subscriptions/add-subscription-form';
import type { Subscription, SubscriptionFrequency } from '@/services/subscriptions'; // Assuming Subscription type is defined
import { getSubscriptions, addSubscription as saveSubscription, deleteSubscription, updateSubscription } from '@/services/subscriptions';
import { getCategories, type Category } from '@/services/categories';
import { getAccounts, type Account } from '@/services/account-sync';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/currency';
import { getUserPreferences } from '@/lib/preferences';
import { format, parseISO } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

export default function SubscriptionsPage() {
  const [isAddSubscriptionDialogOpen, setIsAddSubscriptionDialogOpen] = useState(false);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [preferredCurrency, setPreferredCurrency] = useState('BRL');
  const { toast } = useToast();
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);


  const fetchData = async () => {
    setIsLoading(true);
    try {
      const prefs = await getUserPreferences();
      setPreferredCurrency(prefs.preferredCurrency);
      const [subs, cats, accs] = await Promise.all([
        getSubscriptions(),
        getCategories(),
        getAccounts()
      ]);
      setSubscriptions(subs.sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()));
      setCategories(cats);
      setAccounts(accs);
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
      if (editingSubscription) {
        await updateSubscription({ ...editingSubscription, ...data, nextPaymentDate: data.nextPaymentDate.toISOString() });
        toast({ title: "Success", description: "Subscription updated successfully." });
      } else {
        await saveSubscription({ ...data, nextPaymentDate: data.nextPaymentDate.toISOString() });
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

  const incomeSubscriptions = subscriptions.filter(sub => sub.type === 'income');
  const expenseSubscriptions = subscriptions.filter(sub => sub.type === 'expense');

  const renderSubscriptionCard = (subscription: Subscription) => (
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
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm space-y-1 pt-2">
        <p>Next Payment: {format(parseISO(subscription.nextPaymentDate), 'MMM dd, yyyy')}</p>
        {subscription.accountId && <p>Account: {accounts.find(acc => acc.id === subscription.accountId)?.name || 'N/A'}</p>}
         <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => openEditDialog(subscription)}>Edit</Button>
            <Button variant="destructive" size="sm" onClick={() => handleDeleteSubscription(subscription.id)}>Delete</Button>
        </div>
      </CardContent>
    </Card>
  );

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
              initialData={editingSubscription ? {
                ...editingSubscription,
                startDate: parseISO(editingSubscription.startDate),
                nextPaymentDate: parseISO(editingSubscription.nextPaymentDate),
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
