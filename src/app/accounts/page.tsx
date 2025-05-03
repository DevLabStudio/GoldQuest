
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getAccounts, addAccount, deleteAccount, type Account } from "@/services/account-sync";
import { PlusCircle, Edit, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import AddAccountForm from '@/components/accounts/add-account-form';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from '@/lib/currency'; // Use the new currency formatter
import { getUserPreferences } from '@/lib/preferences'; // Get user preferences for display currency


export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const [preferredCurrency, setPreferredCurrency] = useState('BRL'); // Default preference

   // Fetch preferences on mount
  useEffect(() => {
    // Need to ensure this runs client-side only as it accesses localStorage
    if (typeof window !== 'undefined') {
        const prefs = getUserPreferences();
        setPreferredCurrency(prefs.preferredCurrency);
    }
  }, []);


  const fetchAccountsData = async () => {
    // Ensure this runs client-side as getAccounts now might use localStorage
     if (typeof window === 'undefined') {
         setIsLoading(false);
         setError("Account data can only be loaded on the client.");
         return;
     }

    setIsLoading(true);
    setError(null);
    try {
      const fetchedAccounts = await getAccounts();
      setAccounts(fetchedAccounts);
    } catch (err) {
      console.error("Failed to fetch accounts:", err);
      setError("Could not load accounts. Please ensure local storage is accessible and try again.");
      toast({
        title: "Error",
        description: "Failed to load accounts.",
        variant: "destructive",
      });
       // Clear potentially corrupted storage as a recovery mechanism
      if (typeof window !== 'undefined') {
          localStorage.removeItem('userAccounts');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccountsData();
     // Add event listener for storage changes from other tabs/windows
     const handleStorageChange = (event: StorageEvent) => {
        if (event.key === 'userAccounts' || event.key === 'userPreferences') {
            console.log("Storage changed, refetching data...");
             const prefs = getUserPreferences();
             setPreferredCurrency(prefs.preferredCurrency);
             fetchAccountsData();
        }
     };
     window.addEventListener('storage', handleStorageChange);

     // Cleanup listener on component unmount
     return () => {
       window.removeEventListener('storage', handleStorageChange);
     };
  }, []); // Fetch accounts on initial load

  const handleAccountAdded = async (newAccountData: Omit<Account, 'id'>) => {
    try {
      // Use the addAccount service which now handles localStorage
      await addAccount(newAccountData);
      await fetchAccountsData(); // Refetch to update the list
      setIsDialogOpen(false); // Close the dialog
      toast({
        title: "Success",
        description: `Account "${newAccountData.name}" added successfully.`,
      });
    } catch (err) {
       console.error("Failed to add account:", err);
       toast({
        title: "Error",
        description: "Could not add the account.",
        variant: "destructive",
      });
    }
  };

   const handleDeleteAccount = async (accountId: string) => {
    try {
        // Use the deleteAccount service which now handles localStorage
        await deleteAccount(accountId);
        await fetchAccountsData(); // Refetch to update the list
        toast({
            title: "Account Deleted",
            description: `Account removed successfully.`,
            variant: "destructive", // Use "default" or remove variant for less alarming feedback
        });
    } catch (err) {
        console.error("Failed to delete account:", err);
        toast({
            title: "Error",
            description: "Could not delete the account.",
            variant: "destructive",
        });
    }
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
            View and manage your manually added financial accounts. Balances shown in your preferred currency ({preferredCurrency}).
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
                    <p className="text-sm text-muted-foreground capitalize">{account.bankName || 'N/A'} - {account.type} ({account.currency})</p>
                  </div>
                  <div className="flex flex-col items-end">
                     {/* Use the new formatCurrency function */}
                     <p className="font-bold text-xl text-primary">{formatCurrency(account.balance, account.currency)}</p>
                     <p className="text-xs text-muted-foreground">Current Balance</p>
                      <div className="mt-2 space-x-2">
                          {/* TODO: Implement Edit functionality */}
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
