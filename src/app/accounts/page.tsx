
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getAccounts, addAccount, deleteAccount, updateAccount, type Account } from "@/services/account-sync";
import { PlusCircle, Edit, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import AddAccountForm from '@/components/accounts/add-account-form';
import EditAccountForm from '@/components/accounts/edit-account-form'; // Import the new edit form
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from '@/lib/currency';
import { getUserPreferences } from '@/lib/preferences';


export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false); // State for edit dialog
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null); // State for the account being edited
  const { toast } = useToast();
  const [preferredCurrency, setPreferredCurrency] = useState('BRL');

   useEffect(() => {
    if (typeof window !== 'undefined') {
        const prefs = getUserPreferences();
        setPreferredCurrency(prefs.preferredCurrency);
    }
  }, []);


  const fetchAccountsData = async () => {
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
      if (typeof window !== 'undefined') {
          localStorage.removeItem('userAccounts');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccountsData();
     const handleStorageChange = (event: StorageEvent) => {
        if (event.key === 'userAccounts' || event.key === 'userPreferences') {
            console.log("Storage changed, refetching data...");
             const prefs = getUserPreferences();
             setPreferredCurrency(prefs.preferredCurrency);
             fetchAccountsData();
        }
     };
     window.addEventListener('storage', handleStorageChange);
     return () => {
       window.removeEventListener('storage', handleStorageChange);
     };
  }, []); // Remove toast from dependency array as it doesn't change

  const handleAccountAdded = async (newAccountData: Omit<Account, 'id'>) => {
    try {
      await addAccount(newAccountData);
      await fetchAccountsData();
      setIsAddDialogOpen(false);
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

   const handleAccountUpdated = async (updatedAccountData: Account) => {
    try {
      await updateAccount(updatedAccountData);
      await fetchAccountsData(); // Refetch to update the list
      setIsEditDialogOpen(false); // Close the edit dialog
      setSelectedAccount(null); // Clear the selected account
      toast({
        title: "Success",
        description: `Account "${updatedAccountData.name}" updated successfully.`,
      });
    } catch (err) {
       console.error("Failed to update account:", err);
       toast({
        title: "Error",
        description: "Could not update the account.",
        variant: "destructive",
      });
    }
  };

   const handleDeleteAccount = async (accountId: string) => {
    try {
        await deleteAccount(accountId);
        await fetchAccountsData();
        toast({
            title: "Account Deleted",
            description: `Account removed successfully.`,
            // variant: "destructive", // Can make this default for less alarm
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

  const openEditDialog = (account: Account) => {
    setSelectedAccount(account);
    setIsEditDialogOpen(true);
  };


  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Accounts</h1>
        {/* Add Account Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
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
             View and manage your manually added accounts. Balances shown in original currency, with conversions to {preferredCurrency} below.
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
                     <Skeleton className="h-3 w-20" /> {/* Placeholder for original balance */}
                     <Skeleton className="h-3 w-16 mt-1" /> {/* Placeholder for converted balance */}
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
                     {/* Display original balance prominently */}
                     <p className="font-bold text-xl text-primary">{formatCurrency(account.balance, account.currency, undefined, false)}</p>
                     <p className="text-xs text-muted-foreground">Original Balance</p>
                     {/* Display converted balance less prominently if different from original */}
                     {account.currency !== preferredCurrency && (
                         <p className="text-xs text-muted-foreground mt-1">
                             (≈ {formatCurrency(account.balance, account.currency)})
                         </p>
                     )}
                      <div className="mt-2 space-x-2">
                          {/* Enable Edit Button and trigger the dialog */}
                          <Button variant="outline" size="sm" onClick={() => openEditDialog(account)}>
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
               <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
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

       {/* Edit Account Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) setSelectedAccount(null); // Clear selection when closing
      }}>
          <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                  <DialogTitle>Edit Account</DialogTitle>
                  <DialogDescription>
                      Modify the details of your account.
                  </DialogDescription>
              </DialogHeader>
              {/* Render EditAccountForm only if an account is selected */}
              {selectedAccount && (
                  <EditAccountForm
                      account={selectedAccount}
                      onAccountUpdated={handleAccountUpdated}
                  />
              )}
              {/* Optional: Add a footer with a close button if not handled by the form */}
               {/*
               <DialogFooter>
                   <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                   </DialogClose>
              </DialogFooter>
               */}
          </DialogContent>
      </Dialog>

    </div>
  );
}
