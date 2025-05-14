
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
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
import { format as formatDateFns, parseISO, compareAsc, startOfDay, isSameDay, endOfDay } from 'date-fns';
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


   const fetchAllData = useCallback(async () => {
        if (typeof window === 'undefined') {
            setIsLoading(false);
            setError("Account data can only be loaded on the client.");
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const prefs = await getUserPreferences();
            setPreferredCurrency(prefs.preferredCurrency);

            const fetchedAccounts = await getAccounts();
            setAllAccounts(fetchedAccounts);

            if (fetchedAccounts.length > 0) {
                const transactionPromises = fetchedAccounts.map(acc => getTransactions(acc.id));
                const transactionsByAccount = await Promise.all(transactionPromises);
                const combinedTransactions = transactionsByAccount.flat();
                setAllTransactions(combinedTransactions);
            } else {
                setAllTransactions([]);
            }

        } catch (err) {
            console.error("Failed to fetch accounts or transactions:", err);
            setError("Could not load data. Please ensure local storage is accessible and try again.");
            toast({
                title: "Error",
                description: "Failed to load accounts or transactions.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);


  useEffect(() => {
    fetchAllData();

    const handleStorageChange = (event: StorageEvent) => {
         if (event.type === 'storage') {
            const isLikelyOurCustomEvent = event.key === null;
            const relevantKeysForThisPage = ['userAccounts', 'userPreferences', 'transactions-'];
            const isRelevantExternalChange = typeof event.key === 'string' && relevantKeysForThisPage.some(k => event.key!.includes(k));


            if (isLikelyOurCustomEvent || isRelevantExternalChange) {
                console.log(`Storage change (key: ${event.key || 'custom'}), refetching data for accounts page...`);
                fetchAllData();
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
  }, [fetchAllData]);

  const handleAccountAdded = async (newAccountData: NewAccountData) => {
    try {
      await addAccount(newAccountData);
      setIsAddAssetDialogOpen(false);
      setIsAddCryptoDialogOpen(false);
      toast({
        title: "Success",
        description: `Account "${newAccountData.name}" added successfully.`,
      });
      window.dispatchEvent(new Event('storage'));
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
      setIsEditDialogOpen(false);
      setSelectedAccount(null);
      toast({
        title: "Success",
        description: `Account "${updatedAccountData.name}" updated successfully.`,
      });
      window.dispatchEvent(new Event('storage'));
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
        toast({
            title: "Account Deleted",
            description: `Account removed successfully.`,
        });
        window.dispatchEvent(new Event('storage'));
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
        return { data: [], accountNames: [], chartConfig: {} };
    }

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

    const allTxDates = allTransactions.map(tx => parseISO(tx.date.includes('T') ? tx.date : tx.date + 'T00:00:00Z'));
    const minTxDateOverall = allTxDates.length > 0 ? allTxDates.reduce((min, d) => d < min ? d : min, allTxDates[0]) : new Date();
    const maxTxDateOverall = allTxDates.length > 0 ? allTxDates.reduce((max, d) => d > max ? d : max, allTxDates[0]) : new Date();

    const chartStartDate = startOfDay(selectedDateRange.from || minTxDateOverall);
    const chartEndDate = endOfDay(selectedDateRange.to || maxTxDateOverall); // Use endOfDay for the chart's actual end

    // Calculate balance for each account AT THE START of chartStartDate
    const balanceAtChartStart: { [accountId: string]: number } = {};
    relevantAccounts.forEach(acc => {
        let currentBalance = acc.balance; // Current balance in account's native currency
        allTransactions
            .filter(tx => {
                const txDate = parseISO(tx.date.includes('T') ? tx.date : tx.date + 'T00:00:00Z');
                return tx.accountId === acc.id && txDate >= chartStartDate; // Transactions ON or AFTER chart start
            })
            .forEach(tx => {
                // Subtract these from current balance to roll back to chartStartDate
                currentBalance -= convertCurrency(tx.amount, tx.transactionCurrency, acc.currency);
            });
        balanceAtChartStart[acc.id] = currentBalance;
    });

    const chartDatesSet = new Set<string>();
    chartDatesSet.add(formatDateFns(chartStartDate, 'yyyy-MM-dd')); // Ensure chart start date is included
    allTransactions.forEach(tx => {
        const txDate = parseISO(tx.date.includes('T') ? tx.date : tx.date + 'T00:00:00Z');
        if (txDate >= chartStartDate && txDate <= chartEndDate) {
            chartDatesSet.add(formatDateFns(startOfDay(txDate), 'yyyy-MM-dd'));
        }
    });
    chartDatesSet.add(formatDateFns(chartEndDate, 'yyyy-MM-dd')); // Ensure chart end date is included


    const sortedUniqueChartDates = Array.from(chartDatesSet)
        .map(d => parseISO(d))
        .sort(compareAsc)
        .filter(date => date <= chartEndDate); // Make sure we don't go beyond chartEndDate

    if (sortedUniqueChartDates.length === 0) {
         const dataPoint: any = { date: formatDateFns(chartStartDate, 'yyyy-MM-dd') };
         relevantAccounts.forEach(acc => {
             dataPoint[acc.name] = convertCurrency(balanceAtChartStart[acc.id] || 0, acc.currency, preferredCurrency);
         });
         return { data: [dataPoint], accountNames: relevantAccounts.map(a => a.name), chartConfig };
    }

    const historicalData: Array<{ date: string, [key: string]: any }> = [];
    const runningBalancesInAccountCurrency = { ...balanceAtChartStart }; // Balances are in account's native currency

    sortedUniqueChartDates.forEach((currentDisplayDate, index) => {
        // If it's not the very first date in our sorted list, the runningBalances
        // already reflect the start of currentDisplayDate (end of previousDisplayDate).
        // For the very first date (chartStartDate), runningBalances are already set correctly.

        // Apply transactions FOR currentDisplayDate
        allTransactions
            .filter(tx => {
                const txDate = parseISO(tx.date.includes('T') ? tx.date : tx.date + 'T00:00:00Z');
                return isSameDay(txDate, currentDisplayDate) && relevantAccounts.some(acc => acc.id === tx.accountId);
            })
            .forEach(tx => {
                const account = relevantAccounts.find(a => a.id === tx.accountId);
                if (account) {
                    const amountInAccountCurrency = convertCurrency(tx.amount, tx.transactionCurrency, account.currency);
                    runningBalancesInAccountCurrency[tx.accountId] = (runningBalancesInAccountCurrency[tx.accountId] || 0) + amountInAccountCurrency;
                }
            });

        // Create snapshot for the END of currentDisplayDate
        const dateStr = formatDateFns(currentDisplayDate, 'yyyy-MM-dd');
        const dailySnapshot: { date: string, [key: string]: any } = { date: dateStr };
        relevantAccounts.forEach(acc => {
            dailySnapshot[acc.name] = convertCurrency(runningBalancesInAccountCurrency[acc.id] || 0, acc.currency, preferredCurrency);
        });
        
        // Add or update the snapshot for this date
        const existingEntryIndex = historicalData.findIndex(hd => hd.date === dateStr);
        if (existingEntryIndex !== -1) {
            historicalData[existingEntryIndex] = dailySnapshot;
        } else {
            historicalData.push(dailySnapshot);
        }
    });
    
    // Ensure data is sorted by date for the chart, especially if chartStartDate/EndDate points were manually added out of order initially
    historicalData.sort((a,b) => compareAsc(parseISO(a.date), parseISO(b.date)));


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
                       {account.lastActivity ? formatDateFns(parseISO(account.lastActivity), 'PP') : 'N/A'}
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
                <CardDescription>Historical balance of your accounts in {preferredCurrency}. Display period: {selectedDateRange.from ? formatDateFns(selectedDateRange.from, 'PP') : 'Start'} - {selectedDateRange.to ? formatDateFns(selectedDateRange.to, 'PP') : 'End'}</CardDescription>
            </CardHeader>
            <CardContent className="h-[400px]">
                 {isLoading || accountBalanceHistoryData.data.length === 0 ? (
                    <div className="flex h-full items-center justify-center">
                        {isLoading ? <Skeleton className="h-full w-full" /> : <p className="text-muted-foreground">No data to display chart. Add accounts and transactions, or adjust date range.</p>}
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
