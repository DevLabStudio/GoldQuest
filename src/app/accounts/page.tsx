
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getAccounts, type Account } from "@/services/account-sync"; // Keep using this for now to display accounts
import { PlusCircle, Edit, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import AddAccountForm from '@/components/accounts/add-account-form';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from "@/hooks/use-toast";


// Helper function to format currency
const formatCurrency = (amount: number): string => {
  // Ensure amount is a number before formatting
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numericAmount)) {
    // Handle cases where conversion might fail, maybe return a default or error string
    console.warn("Invalid amount received for formatting:", amount);
    return 'R$ --,--';
  }
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numericAmount);
};


export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const fetchAccountsData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // TODO: Replace with actual data fetching when backend is ready
      const fetchedAccounts = await getAccounts(); // Simulate fetching
      setAccounts(fetchedAccounts);
    } catch (err) {
      console.error("Failed to fetch accounts:", err);
      setError("Could not load accounts. Please try again later.");
      toast({
        title: "Error",
        description: "Failed to load accounts.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccountsData();
  }, []); // Fetch accounts on initial load

  const handleAccountAdded = (newAccount: Omit<Account, 'id'>) => {
    // Simulate adding account and refetching/updating state
    // In a real app, you'd call an API to add the account,
    // then update the state or refetch the list.
    const accountWithId: Account = {
        ...newAccount,
        id: Math.random().toString(36).substring(2, 15) // Simulate ID generation
    };
    setAccounts(prev => [...prev, accountWithId]);
    setIsDialogOpen(false); // Close the dialog
    toast({
      title: "Success",
      description: `Account "${newAccount.name}" added successfully.`,
    });
    // Optionally: fetchAccountsData(); // Refetch the full list from backend
  };

   const handleDeleteAccount = (accountId: string) => {
    // Simulate deleting account
    // In a real app, you'd call an API to delete the account
    setAccounts(prev => prev.filter(acc => acc.id !== accountId));
     toast({
      title: "Account Deleted",
      description: `Account removed successfully.`,
       variant: "destructive",
    });
  };


  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Accounts</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Account
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Account</DialogTitle>
              <DialogDescription>
                Enter the details of your new financial account.
              </DialogDescription>
            </DialogHeader>
            <AddAccountForm onAccountAdded={handleAccountAdded} />
             {/* DialogFooter can be part of the form if needed */}
          </DialogContent>
        </Dialog>
      </div>

        {error && (
          <div className="mb-4 p-4 bg-destructive/10 text-destructive border border-destructive rounded-md">
              {error}
          </div>
       )}

      <Card>
        <CardHeader>
          <CardTitle>Your Accounts</CardTitle>
          <CardDescription>
            View and manage your manually added financial accounts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
             <div className="space-y-4">
               {[...Array(2)].map((_, i) => (
                 <div key={i} className="flex flex-col md:flex-row justify-between items-start md:items-center border p-4 rounded-lg shadow-sm">
                   <div className="mb-2 md:mb-0 w-full md:w-1/2">
                     <Skeleton className="h-6 w-3/4 mb-1" />
                     <Skeleton className="h-4 w-1/2" />
                   </div>
                   <div className="flex flex-col items-end w-full md:w-auto">
                     <Skeleton className="h-8 w-24 mb-1" />
                     <Skeleton className="h-3 w-20" />
                     <div className="mt-2 space-x-2">
                        <Skeleton className="h-8 w-16 inline-block" />
                        <Skeleton className="h-8 w-16 inline-block" />
                     </div>
                   </div>
                 </div>
               ))}
            </div>
          ) : accounts.length > 0 ? (
            <ul className="space-y-4">
              {accounts.map((account) => (
                <li key={account.id} className="flex flex-col md:flex-row justify-between items-start md:items-center border p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200">
                  <div className="mb-2 md:mb-0">
                    <p className="font-semibold text-lg">{account.name}</p>
                    <p className="text-sm text-muted-foreground capitalize">{account.bankName || 'N/A'} - {account.type}</p>
                  </div>
                  <div className="flex flex-col items-end">
                     <p className="font-bold text-xl text-primary">{formatCurrency(account.balance)}</p>
                     <p className="text-xs text-muted-foreground">Current Balance</p>
                      <div className="mt-2 space-x-2">
                          {/* Add Edit/Delete functionality later */}
                          <Button variant="outline" size="sm" disabled>
                              <Edit className="mr-1 h-3 w-3" /> Edit
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleDeleteAccount(account.id)}>
                              <Trash2 className="mr-1 h-3 w-3" /> Delete
                          </Button>
                      </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-10">
              <p className="text-muted-foreground mb-4">No accounts added yet.</p>
               <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                 <DialogTrigger asChild>
                    <Button>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Your First Account
                    </Button>
                  </DialogTrigger>
                 <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Add New Account</DialogTitle>
                      <DialogDescription>
                        Enter the details of your new financial account.
                      </DialogDescription>
                    </DialogHeader>
                    <AddAccountForm onAccountAdded={handleAccountAdded} />
                 </DialogContent>
               </Dialog>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
