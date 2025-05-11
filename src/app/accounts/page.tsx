'use client';

import { useState, useEffect, useMemo } from 'react';
import type { FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getAccounts, addAccount, deleteAccount, updateAccount, type Account, type NewAccountData } from "@/services/account-sync";
import { getTransactions, type Transaction } from '@/services/transactions';
import { PlusCircle, Edit, Trash2, MoreHorizontal, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import AddAccountForm from '@/components/accounts/add-account-form';
import AddCryptoForm from '@/components/accounts/add-crypto-form';
import EditAccountForm from '@/components/accounts/edit-account-form';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, convertCurrency } from '@/lib/currency';
import { getUserPreferences } from '@/lib/preferences';
import { format, parseISO, compareAsc, startOfDay } from 'date-fns';
import Link from 'next/link';
import AccountBalanceHistoryChart from '@/components/accounts/account-balance-history-chart';
import { useDateRange } from '@/contexts/DateRangeContext';


export default function AccountsPage() {
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddAssetDialogOpen, setIsAddAssetDialogOpen] = useState(false);
  const [isAddCryptoDialogOpen, setIsAddCryptoDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const { toast } = useToast();
  const [preferredCurrency, setPreferredCurrency] = useState('BRL');
  const { selectedDateRange } = useDateRange();


   useEffect(() => {
    const fetchPrefs = async () => {
        if (typeof window !== 'undefined') {
            const prefs = await getUserPreferences();
            setPreferredCurrency(prefs.preferredCurrency);
        }
    };
    fetchPrefs();
  }, []);


  useEffect(() => {
    let isMounted = true;
    const fetchAllData = async () => {
        if (typeof window === 'undefined') {
            if(isMounted) setIsLoading(false);
            if(isMounted) setError("Account data can only be loaded on the client.");
            return;
        }

        if(isMounted) setIsLoading(true);
        if(isMounted) setError(null);
        try {
            const fetchedAccounts = await getAccounts();
            if(isMounted) setAllAccounts(fetchedAccounts);

            if (fetchedAccounts.length > 0) {
                const transactionPromises = fetchedAccounts.map(acc => getTransactions(acc.id));
                const transactionsByAccount = await Promise.all(transactionPromises);
                const combinedTransactions = transactionsByAccount.flat();
                if(isMounted) setAllTransactions(combinedTransactions);
            } else {
                if(isMounted) setAllTransactions([]);
            }

        } catch (err) {
            console.error("Failed to fetch accounts or transactions:", err);
            if(isMounted) setError("Could not load data. Please ensure local storage is accessible and try again.");
            if(isMounted) toast({
                title: "Error",
                description: "Failed to load accounts or transactions.",
                variant: "destructive",
            });
        } finally {
            if(isMounted) setIsLoading(false);
        }
    };

    fetchAllData();

    const handleStorageChange = (event: StorageEvent) => {
        if (event.key === 'userAccounts' || event.key === 'userPreferences' || event.key?.startsWith('transactions-')) {
            console.log("Storage changed, refetching data for accounts page...");
            if (typeof window !== 'undefined' && isMounted) {
                const fetchPrefs = async () => {
                    const prefs = await getUserPreferences();
                    setPreferredCurrency(prefs.preferredCurrency);
                };
                fetchPrefs();
                fetchAllData();
            }
        }
    };

    if (typeof window !== 'undefined') {
        window.addEventListener('storage', handleStorageChange);
    }

    return () => {
        isMounted = false;
        if (typeof window !== 'undefined') {
            window.removeEventListener('storage', handleStorageChange);
        }
    };
  }, [toast]);

  const localFetchAccountsData = async () => {
    if (typeof window === 'undefined') return;
    setIsLoading(true); setError(null);
    try { 
        const fetchedAccounts = await getAccounts();
        setAllAccounts(fetchedAccounts);
        if (fetchedAccounts.length > 0) {
            const transactionPromises = fetchedAccounts.map(acc => getTransactions(acc.id));
            const transactionsByAccount = await Promise.all(transactionPromises);
            setAllTransactions(transactionsByAccount.flat());
        } else {
            setAllTransactions([]);
        }
    }
    catch (err) { console.error(err); setError("Could not reload accounts."); }
    finally { setIsLoading(false); }
  }

  const handleAccountAdded = async (newAccountData: NewAccountData) => {
    try {
      await addAccount(newAccountData);
      await localFetchAccountsData();
      setIsAddAssetDialogOpen(false);
      setIsAddCryptoDialogOpen(false);
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
      await localFetchAccountsData();
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
        await localFetchAccountsData();
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

  const assetAccounts = useMemo(() => allAccounts.filter(acc => acc.category === 'asset'), [allAccounts]);
  const cryptoAccounts = useMemo(() => allAccounts.filter(acc => acc.category === 'crypto'), [allAccounts]);

  const accountBalanceHistoryData = useMemo(() => {
    if (isLoading || allAccounts.length === 0 || !preferredCurrency) {
        return {
            data: [],
            accountNames: [],
            chartConfig: {}
        };
    }

    // Show ALL accounts in this chart, regardless of includeInNetWorth
    const relevantAccounts = [...allAccounts]; 
    if (relevantAccounts.length === 0) return { data: [], accountNames: [], chartConfig: {} };

    const accountColors = [
        "hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))",
        "hsl(var(--chart-4))", "hsl(var(--chart-5))", "hsl(var(--primary))",
        "hsl(var(--secondary))",
    ];
    const chartConfig = relevantAccounts.reduce((acc, account, index) => {
        acc[account.name] = { label: account.name, color: accountColors[index % accountColors.length] };
        return acc;
    }, {} as any);


    // Get all unique transaction dates across all relevant accounts, plus start/end of global range
    let allDates = new Set<string>();
    if (selectedDateRange.from) allDates.add(format(startOfDay(selectedDateRange.from), 'yyyy-MM-dd'));
    if (selectedDateRange.to) allDates.add(format(startOfDay(selectedDateRange.to), 'yyyy-MM-dd'));

    allTransactions.forEach(tx => {
        if (relevantAccounts.some(acc => acc.id === tx.accountId)) {
            const txDate = startOfDay(parseISO(tx.date));
            if (selectedDateRange.from && selectedDateRange.to) {
                if (txDate >= selectedDateRange.from && txDate <= selectedDateRange.to) {
                    allDates.add(format(txDate, 'yyyy-MM-dd'));
                }
            } else { // All time
                 allDates.add(format(txDate, 'yyyy-MM-dd'));
            }
        }
    });
    
    const sortedUniqueDates = Array.from(allDates).map(d => parseISO(d)).sort(compareAsc);

    if (sortedUniqueDates.length === 0 && relevantAccounts.length > 0) {
        // If no transactions in range, show current balances at "today"
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const dataPoint: any = { date: todayStr };
        relevantAccounts.forEach(acc => {
            dataPoint[acc.name] = convertCurrency(acc.balance, acc.currency, preferredCurrency);
        });
        return { data: [dataPoint], accountNames: relevantAccounts.map(a => a.name), chartConfig };
    }
    if (sortedUniqueDates.length === 0) return { data: [], accountNames: [], chartConfig: {} };


    const historicalData: Array<{ date: string, [key: string]: any }> = [];
    const runningBalances: { [accountId: string]: number } = {}; // in account's original currency

    relevantAccounts.forEach(acc => {
        // Find opening balance transaction for this account
        const openingBalanceTx = allTransactions.find(
            tx => tx.accountId === acc.id && tx.category?.toLowerCase() === 'opening balance'
        );
        runningBalances[acc.id] = openingBalanceTx ? openingBalanceTx.amount : 0; // Assumes OB tx amount is correct initial balance
    });


    // Create initial state before the first transaction date or at the start of the range
    const firstChartDate = sortedUniqueDates[0];
    const initialDataPoint: any = { date: format(firstChartDate, 'yyyy-MM-dd') };
    relevantAccounts.forEach(acc => {
        let balanceBeforeFirstTx = runningBalances[acc.id];
         allTransactions
            .filter(tx => tx.accountId === acc.id && parseISO(tx.date) < firstChartDate && tx.category?.toLowerCase() !== 'opening balance')
            .sort((a,b) => compareAsc(parseISO(a.date), parseISO(b.date)))
            .forEach(tx => {
                balanceBeforeFirstTx += convertCurrency(tx.amount, tx.transactionCurrency, acc.currency);
            });
        initialDataPoint[acc.name] = convertCurrency(balanceBeforeFirstTx, acc.currency, preferredCurrency);
        runningBalances[acc.id] = balanceBeforeFirstTx; // Update running balance to this point
    });
    if (Object.keys(initialDataPoint).length > 1) historicalData.push(initialDataPoint);


    for (const currentDate of sortedUniqueDates) {
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        const dailySnapshot: { date: string, [key: string]: any } = { date: dateStr };

        const transactionsOnThisDay = allTransactions.filter(tx => 
            format(startOfDay(parseISO(tx.date)), 'yyyy-MM-dd') === dateStr &&
            tx.category?.toLowerCase() !== 'opening balance' && // Ignore OB for daily changes
            relevantAccounts.some(acc => acc.id === tx.accountId)
        );

        transactionsOnThisDay.forEach(tx => {
            const account = relevantAccounts.find(a => a.id === tx.accountId);
            if (account) {
                const amountInAccountCurrency = convertCurrency(tx.amount, tx.transactionCurrency, account.currency);
                runningBalances[tx.accountId] = (runningBalances[tx.accountId] || 0) + amountInAccountCurrency;
            }
        });

        relevantAccounts.forEach(acc => {
            dailySnapshot[acc.name] = convertCurrency(runningBalances[acc.id] || 0, acc.currency, preferredCurrency);
        });
        
        // Update existing point for the day or add new if not present
        const existingPointIndex = historicalData.findIndex(p => p.date === dateStr);
        if (existingPointIndex > -1) {
            historicalData[existingPointIndex] = { ...historicalData[existingPointIndex], ...dailySnapshot };
        } else {
            historicalData.push(dailySnapshot);
        }
    }
    
    // Ensure data is sorted by date again after potential out-of-order processing
    historicalData.sort((a, b) => compareAsc(parseISO(a.date), parseISO(b.date)));

    return { data: historicalData, accountNames: relevantAccounts.map(a => a.name), chartConfig };
  }, [allAccounts, allTransactions, preferredCurrency, isLoading, selectedDateRange]);


  interface AccountTableProps {
      accounts: Account[];
      title: string;
      category: 'asset' | 'crypto';
      onAddClick: () => void;
      isAddDialogOpen: boolean;
      onOpenChange: (open: boolean) => void;
      AddFormComponent: FC<{ onAccountAdded: (data: NewAccountData) => void }>;
  }

  const AccountTable: FC<AccountTableProps> = ({ accounts, title, category, onAddClick, isAddDialogOpen, onOpenChange, AddFormComponent }) => (
    <Card className="mb-8">
      <CardHeader>
         <div className="flex justify-between items-center">
            <CardTitle>{title}</CardTitle>
             <Dialog open={isAddDialogOpen} onOpenChange={onOpenChange}>
               <DialogTrigger asChild>
                 <Button variant="default" size="sm">
                   <PlusCircle className="mr-2 h-4 w-4" /> Create new {category} account
                 </Button>
               </DialogTrigger>
               <DialogContent className="sm:max-w-3xl">
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
              <TableHead>{category === 'asset' ? 'Bank/Institution' : 'Exchange/Wallet'}</TableHead>
              <TableHead>Current balance</TableHead>
              <TableHead>Last activity</TableHead>
              <TableHead>Balance difference</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(2)].map((_, i) => (
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
                  <TableCell className="font-medium">
                     <Link href={`/accounts/${account.id}`} passHref>
                       <Button variant="link" size="sm" className="p-0 h-auto text-base font-medium text-primary hover:text-primary/80 hover:no-underline">
                          {account.name}
                       </Button>
                     </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{account.providerName || 'N/A'}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-semibold text-primary">
                        {formatCurrency(account.balance, account.currency, account.currency, false)}
                      </span>
                      {preferredCurrency && account.currency.toUpperCase() !== preferredCurrency.toUpperCase() && (
                        <span className="text-xs text-muted-foreground mt-1">
                            (≈ {formatCurrency(account.balance, account.currency, preferredCurrency, true)})
                        </span>
                      )}
                    </div>
                  </TableCell>
                   <TableCell className="text-muted-foreground">
                       {account.lastActivity ? format(new Date(account.lastActivity), 'PP') : 'N/A'}
                   </TableCell>
                   <TableCell className="text-muted-foreground">
                       {formatCurrency(account.balanceDifference ?? 0, account.currency, preferredCurrency, false)}
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
                        <DropdownMenuItem asChild>
                            <Link href={`/accounts/${account.id}`} className="flex items-center w-full">
                                <Eye className="mr-2 h-4 w-4" />
                                <span>View Transactions</span>
                            </Link>
                        </DropdownMenuItem>
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
                        <Button variant="default" size="sm" className="ml-2">
                           <PlusCircle className="mr-2 h-4 w-4" /> Add your first {category} account
                        </Button>
                      </DialogTrigger>
                     <DialogContent className="sm:max-w-3xl">
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
        {!isLoading && accounts.length > 0 && (
          <CardContent className="pt-4 border-t">
              <Dialog open={isAddDialogOpen} onOpenChange={onOpenChange}>
                  <DialogTrigger asChild>
                      <Button variant="default" size="sm">
                          <PlusCircle className="mr-2 h-4 w-4" /> Create new {category} account
                      </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-3xl">
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
         <h1 className="text-3xl font-bold">Accounts Management</h1>
      </div>

        {error && (
          <div className="mb-4 p-4 bg-destructive/10 text-destructive border border-destructive rounded-md">
              {error}
          </div>
       )}

        <Card className="mb-8">
            <CardHeader>
                <CardTitle>Your Accounts Overview</CardTitle>
                <CardDescription>Historical balance of your accounts in {preferredCurrency}.</CardDescription>
            </CardHeader>
            <CardContent className="h-[400px]">
                 {isLoading || accountBalanceHistoryData.data.length === 0 ? (
                    <div className="flex h-full items-center justify-center">
                        {isLoading ? <Skeleton className="h-full w-full" /> : <p className="text-muted-foreground">No data to display chart. Add accounts and transactions.</p>}
                    </div>
                ) : (
                    <AccountBalanceHistoryChart
                        data={accountBalanceHistoryData.data}
                        accountConfigs={accountBalanceHistoryData.chartConfig}
                        preferredCurrency={preferredCurrency}
                    />
                )}
            </CardContent>
        </Card>


        <AccountTable
            accounts={assetAccounts}
            title="Property (Asset Accounts)"
            category="asset"
            onAddClick={() => setIsAddAssetDialogOpen(true)}
            isAddDialogOpen={isAddAssetDialogOpen}
            onOpenChange={setIsAddAssetDialogOpen}
            AddFormComponent={AddAccountForm}
        />

        <AccountTable
            accounts={cryptoAccounts}
            title="Self-Custody (Crypto Accounts)"
            category="crypto"
            onAddClick={() => setIsAddCryptoDialogOpen(true)}
            isAddDialogOpen={isAddCryptoDialogOpen}
            onOpenChange={setIsAddCryptoDialogOpen}
            AddFormComponent={AddCryptoForm}
        />


      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) setSelectedAccount(null);
      }}>
          <DialogContent className="sm:max-w-3xl">
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
