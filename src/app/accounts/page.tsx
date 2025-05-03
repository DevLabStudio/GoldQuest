
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getAccounts, addAccount, deleteAccount, updateAccount, type Account } from "@/services/account-sync";
import { PlusCircle, Edit, Trash2, MoreHorizontal, Check } from "lucide-react"; // Added MoreHorizontal, Check
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"; // Added DropdownMenu components
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"; // Added Table components
import AddAccountForm from '@/components/accounts/add-account-form';
import EditAccountForm from '@/components/accounts/edit-account-form';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from '@/lib/currency';
import { getUserPreferences } from '@/lib/preferences';
import { format } from 'date-fns'; // For formatting placeholder date


export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
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
  }, []);

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
      await fetchAccountsData();
      setIsEditDialogOpen(false);
      setSelectedAccount(null);
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
        <h1 className="text-3xl font-bold">Asset accounts</h1> {/* Corrected capitalization */}
        {/* Add Account Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
             {/* Updated Button Style - Removed green classes */}
            <Button variant="default"> {/* Rely on theme primary color */}
              <PlusCircle className="mr-2 h-4 w-4" /> Create a new asset account
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

        {/* Table Layout */}
        <Card>
          <CardHeader className="sr-only"> {/* Hide header visually, but keep for structure */}
            <CardTitle>Your Accounts</CardTitle>
            <CardDescription>
              View and manage your manually added accounts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  {/* Removed Role */}
                  <TableHead>Account number</TableHead>
                  <TableHead>Current balance</TableHead>
                  {/* Removed Is active? */}
                  <TableHead>Last activity</TableHead>
                  <TableHead>Balance difference</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  // Skeleton rows
                  [...Array(3)].map((_, i) => (
                    <TableRow key={`skeleton-${i}`}>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      {/* Removed Role Skeleton */}
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                      {/* Removed Is active? Skeleton */}
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-16 inline-block" /></TableCell>
                    </TableRow>
                  ))
                ) : accounts.length > 0 ? (
                  accounts.map((account) => (
                    <TableRow key={account.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">{account.name}</TableCell>
                      {/* Removed Role Cell */}
                      <TableCell className="text-muted-foreground">{account.bankName || 'N/A'}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-semibold text-primary">
                            {formatCurrency(account.balance, account.currency, undefined, false)}
                          </span>
                          {account.currency !== preferredCurrency && (
                            <span className="text-xs text-muted-foreground mt-1">
                                (≈ {formatCurrency(account.balance, account.currency)})
                            </span>
                          )}
                        </div>
                      </TableCell>
                       {/* Removed Is active? Cell */}
                       <TableCell className="text-muted-foreground">
                           {/* Placeholder for 'Last activity' */}
                           {format(new Date(account.lastActivity || Date.now()), 'PP')} {/* Format existing date or fallback */}
                       </TableCell>
                       <TableCell className="text-muted-foreground">
                           {/* Placeholder for 'Balance difference' */}
                           {formatCurrency(account.balanceDifference ?? 0, account.currency)} {/* Format existing diff or fallback */}
                       </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(account)}>
                              <Edit className="mr-2 h-4 w-4" />
                              <span>Edit</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteAccount(account.id)}
                              className="text-destructive focus:text-destructive focus:bg-destructive/10"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              <span>Delete</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  // Empty state row
                  <TableRow>
                    {/* Adjusted colSpan */}
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No accounts added yet.
                       <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                         <DialogTrigger asChild>
                            <Button variant="link" className="ml-2 px-0 h-auto text-primary">
                                Add your first account
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
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
           {/* Add button at the bottom if needed */}
           {!isLoading && accounts.length > 0 && (
              <CardContent className="pt-4 border-t">
                  <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                      <DialogTrigger asChild>
                           {/* Updated Button Style - Removed green classes */}
                          <Button variant="default" size="sm"> {/* Rely on theme primary color */}
                              <PlusCircle className="mr-2 h-4 w-4" /> Create a new asset account
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
              </CardContent>
            )}
        </Card>


       {/* Edit Account Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) setSelectedAccount(null);
      }}>
          <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                  <DialogTitle>Edit Account</DialogTitle>
                  <DialogDescription>
                      Modify the details of your account.
                  </DialogDescription>
              </DialogHeader>
              {selectedAccount && (
                  <EditAccountForm
                      account={selectedAccount}
                      onAccountUpdated={handleAccountUpdated}
                  />
              )}
          </DialogContent>
      </Dialog>

    </div>
  );
}

