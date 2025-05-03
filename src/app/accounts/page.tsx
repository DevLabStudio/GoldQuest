
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getAccounts, addAccount, deleteAccount, updateAccount, type Account, type NewAccountData } from "@/services/account-sync";
import { PlusCircle, Edit, Trash2, MoreHorizontal, Check, Wallet } from "lucide-react"; // Added Wallet icon
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import AddAccountForm from '@/components/accounts/add-account-form';
import AddCryptoForm from '@/components/accounts/add-crypto-form'; // Import the new crypto form
import EditAccountForm from '@/components/accounts/edit-account-form';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from '@/lib/currency';
import { getUserPreferences } from '@/lib/preferences';
import { format } from 'date-fns';


export default function AccountsPage() {
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddAssetDialogOpen, setIsAddAssetDialogOpen] = useState(false);
  const [isAddCryptoDialogOpen, setIsAddCryptoDialogOpen] = useState(false); // State for crypto dialog
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const { toast } = useToast();
  const [preferredCurrency, setPreferredCurrency] = useState('BRL');

   useEffect(() => {
    // Client-side only check for preferences
    if (typeof window !== 'undefined') {
        const prefs = getUserPreferences();
        setPreferredCurrency(prefs.preferredCurrency);
    }
  }, []);


  const fetchAccountsData = async () => {
     // Client-side only check for local storage access
     if (typeof window === 'undefined') {
         setIsLoading(false);
         setError("Account data can only be loaded on the client.");
         return;
     }

    setIsLoading(true);
    setError(null);
    try {
      const fetchedAccounts = await getAccounts();
      setAllAccounts(fetchedAccounts);
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
     // Client-side only listener
     const handleStorageChange = (event: StorageEvent) => {
        if (event.key === 'userAccounts' || event.key === 'userPreferences') {
            console.log("Storage changed, refetching data...");
             if (typeof window !== 'undefined') { // Check again inside listener
                 const prefs = getUserPreferences();
                 setPreferredCurrency(prefs.preferredCurrency);
             }
             fetchAccountsData();
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
  }, []); // Empty dependency array runs once on mount

  // Updated handler to use NewAccountData type
  const handleAccountAdded = async (newAccountData: NewAccountData) => {
    try {
      await addAccount(newAccountData);
      await fetchAccountsData();
      setIsAddAssetDialogOpen(false); // Close respective dialog
      setIsAddCryptoDialogOpen(false); // Close respective dialog
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

  // Filter accounts by category
  const assetAccounts = useMemo(() => allAccounts.filter(acc => acc.category === 'asset'), [allAccounts]);
  const cryptoAccounts = useMemo(() => allAccounts.filter(acc => acc.category === 'crypto'), [allAccounts]);


  // Reusable Table Component
  const AccountTable = ({ accounts, title, category, onAddClick, isAddDialogOpen, onOpenChange, AddFormComponent }: {
      accounts: Account[];
      title: string;
      category: 'asset' | 'crypto';
      onAddClick: () => void;
      isAddDialogOpen: boolean;
      onOpenChange: (open: boolean) => void;
      AddFormComponent: React.FC<{ onAccountAdded: (data: NewAccountData) => void }>;
  }) => (
    <Card className="mb-8"> {/* Add margin between tables */}
      <CardHeader>
         <div className="flex justify-between items-center">
            <CardTitle>{title}</CardTitle>
            {/* Add Account Dialog Trigger for this table */}
             <Dialog open={isAddDialogOpen} onOpenChange={onOpenChange}>
               <DialogTrigger asChild>
                 <Button variant="default" size="sm">
                   <PlusCircle className="mr-2 h-4 w-4" /> Create new {category} account
                 </Button>
               </DialogTrigger>
               <DialogContent className="sm:max-w-[425px]">
                 <DialogHeader>
                   <DialogTitle>Add New {category === 'asset' ? 'Asset' : 'Crypto'} Account</DialogTitle>
                   <DialogDescription>
                     Enter the details of your new {category} account.
                   </DialogDescription>
                 </DialogHeader>
                 <AddFormComponent onAccountAdded={handleAccountAdded} />
               </DialogContent>
             </Dialog>
         </div>
         <CardDescription>View and manage your manually added {category} accounts.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>{category === 'asset' ? 'Bank/Institution' : 'Exchange/Wallet'}</TableHead> {/* Dynamic Header */}
              <TableHead>Current balance</TableHead>
              <TableHead>Last activity</TableHead>
              <TableHead>Balance difference</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(2)].map((_, i) => ( // Fewer skeleton rows per table
                <TableRow key={`skeleton-${category}-${i}`}>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-16 inline-block" /></TableCell>
                </TableRow>
              ))
            ) : accounts.length > 0 ? (
              accounts.map((account) => (
                <TableRow key={account.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">{account.name}</TableCell>
                  <TableCell className="text-muted-foreground">{account.providerName || 'N/A'}</TableCell> {/* Use providerName */}
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-semibold text-primary">
                         {/* Display original balance */}
                        {formatCurrency(account.balance, account.currency, undefined, false)}
                      </span>
                      {/* Conditionally display converted balance */}
                      {account.currency.toUpperCase() !== preferredCurrency.toUpperCase() && (
                        <span className="text-xs text-muted-foreground mt-1">
                            (≈ {formatCurrency(account.balance, account.currency, undefined, true)})
                        </span>
                      )}
                    </div>
                  </TableCell>
                   <TableCell className="text-muted-foreground">
                       {format(new Date(account.lastActivity || Date.now()), 'PP')}
                   </TableCell>
                   <TableCell className="text-muted-foreground">
                       {formatCurrency(account.balanceDifference ?? 0, account.currency, undefined, false)}
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
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No {category} accounts added yet.
                   <Dialog open={isAddDialogOpen} onOpenChange={onOpenChange}>
                     <DialogTrigger asChild>
                        <Button variant="link" className="ml-2 px-0 h-auto text-primary">
                            Add your first {category} account
                        </Button>
                      </DialogTrigger>
                     <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                          <DialogTitle>Add New {category === 'asset' ? 'Asset' : 'Crypto'} Account</DialogTitle>
                           <DialogDescription>
                              Enter the details of your new {category} account.
                           </DialogDescription>
                        </DialogHeader>
                         <AddFormComponent onAccountAdded={handleAccountAdded} />
                     </DialogContent>
                   </Dialog>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
      {/* Optional: Add button at the bottom if needed and accounts exist */}
        {!isLoading && accounts.length > 0 && (
          <CardContent className="pt-4 border-t">
              <Dialog open={isAddDialogOpen} onOpenChange={onOpenChange}>
                  <DialogTrigger asChild>
                      <Button variant="default" size="sm">
                          <PlusCircle className="mr-2 h-4 w-4" /> Create new {category} account
                      </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                         <DialogTitle>Add New {category === 'asset' ? 'Asset' : 'Crypto'} Account</DialogTitle>
                           <DialogDescription>
                              Enter the details of your new {category} account.
                           </DialogDescription>
                      </DialogHeader>
                       <AddFormComponent onAccountAdded={handleAccountAdded} />
                  </DialogContent>
              </Dialog>
          </CardContent>
        )}
    </Card>
  );


  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-6">
         {/* Keep the main page title simple or remove if table titles are enough */}
         <h1 className="text-3xl font-bold">Accounts Management</h1>
         {/* Buttons for adding accounts are now within each table's header */}
      </div>

        {error && (
          <div className="mb-4 p-4 bg-destructive/10 text-destructive border border-destructive rounded-md">
              {error}
          </div>
       )}

       {/* Asset Accounts Table */}
        <AccountTable
            accounts={assetAccounts}
            title="Property (Asset Accounts)" // Updated Title
            category="asset"
            onAddClick={() => setIsAddAssetDialogOpen(true)}
            isAddDialogOpen={isAddAssetDialogOpen}
            onOpenChange={setIsAddAssetDialogOpen}
            AddFormComponent={AddAccountForm}
        />

       {/* Crypto Accounts Table */}
        <AccountTable
            accounts={cryptoAccounts}
            title="Self-Custody (Crypto Accounts)" // New Title
            category="crypto"
            onAddClick={() => setIsAddCryptoDialogOpen(true)}
            isAddDialogOpen={isAddCryptoDialogOpen}
            onOpenChange={setIsAddCryptoDialogOpen}
            AddFormComponent={AddCryptoForm} // Use the new Crypto Form
        />


       {/* Edit Account Dialog (Common for both types) */}
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
              {/* Pass the selected account (could be asset or crypto) to the edit form */}
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

