
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getAccounts, addAccount, deleteAccount, updateAccount, type Account, type NewAccountData } from "@/services/account-sync";
import { getTransactions, type Transaction } from '@/services/transactions';
import { PlusCircle, Edit, Trash2, MoreHorizontal, Eye, ChevronDown, Landmark, Bitcoin as BitcoinIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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
import { useAuthContext } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';


export default function AccountsPage() {
  const { user, isLoadingAuth } = useAuthContext();
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
        if (!user || isLoadingAuth || typeof window === 'undefined') {
            setIsLoading(false);
            if (!user && !isLoadingAuth) setError("Please log in to view accounts.");
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const prefs = await getUserPreferences();
            setPreferredCurrency(prefs.preferredCurrency);

            const fetchedAccounts = await getAccounts();
            // Sort accounts: assets first, then crypto, then by name
            fetchedAccounts.sort((a, b) => {
                if (a.category === 'asset' && b.category === 'crypto') return -1;
                if (a.category === 'crypto' && b.category === 'asset') return 1;
                return a.name.localeCompare(b.name);
            });
            setAllAccounts(fetchedAccounts);


            if (fetchedAccounts.length > 0) {
                const transactionPromises = fetchedAccounts.map(acc => getTransactions(acc.id));
                const transactionsByAccount = await Promise.all(transactionPromises);
                const combinedTransactions = transactionsByAccount.flat();
                setAllTransactions(combinedTransactions);
            } else {
                setAllTransactions([]);
            }

        } catch (err: any) {
            console.error("Failed to fetch accounts or transactions:", err);
            setError("Could not load data. Please ensure local storage is accessible and try again. Details: " + err.message);
            toast({
                title: "Error",
                description: "Failed to load accounts or transactions. Details: " + err.message,
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    }, [toast, user, isLoadingAuth]);


  useEffect(() => {
    if (user && !isLoadingAuth) {
        fetchAllData();
    } else if (!isLoadingAuth && !user) {
        setIsLoading(false);
        setAllAccounts([]);
        setAllTransactions([]);
        setError("Please log in to view accounts.");
    }

    const handleStorageChange = (event: StorageEvent) => {
         if (event.type === 'storage' && user && !isLoadingAuth) {
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
  }, [fetchAllData, user, isLoadingAuth]);

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
    } catch (err: any) {
       console.error("Failed to add account:", err);
       toast({
        title: "Error",
        description: "Could not add the account. Details: " + err.message,
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
    } catch (err: any) {
       console.error("Failed to update account:", err);
       toast({
        title: "Error",
        description: "Could not update the account. Details: " + err.message,
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
    } catch (err: any) {
        console.error("Failed to delete account:", err);
        toast({
            title: "Error",
            description: "Could not delete the account. Details: " + err.message,
            variant: "destructive",
        });
    }
  };

  const openEditDialog = (account: Account) => {
    setSelectedAccount(account);
    setIsEditDialogOpen(true);
  };

  const accountBalanceHistoryData = useMemo(() => {
    if (isLoading || allAccounts.length === 0 || !preferredCurrency) {
        return { data: [], accountNames: [], chartConfig: {} };
    }

    const relevantAccounts = allAccounts.filter(acc => acc.includeInNetWorth !== false);
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
    const chartEndDate = endOfDay(selectedDateRange.to || maxTxDateOverall);

    const initialChartBalances: { [accountId: string]: number } = {};
    relevantAccounts.forEach(acc => {
        let balanceAtChartStart = acc.balance; // This is the current balance
        // Roll back transactions that happened *after* the chartStartDate
        allTransactions
            .filter(tx => {
                const txDate = parseISO(tx.date.includes('T') ? tx.date : tx.date + 'T00:00:00Z');
                return tx.accountId === acc.id && txDate >= chartStartDate;
            })
            .forEach(tx => {
                let amountInAccountCurrency = tx.amount;
                // Ensure transaction currency is converted to account's primary currency
                if (tx.transactionCurrency && acc.primaryCurrency && tx.transactionCurrency.toUpperCase() !== acc.primaryCurrency.toUpperCase()) {
                    amountInAccountCurrency = convertCurrency(tx.amount, tx.transactionCurrency, acc.primaryCurrency);
                }
                balanceAtChartStart -= amountInAccountCurrency; // Subtract future transactions to get past balance
            });
        initialChartBalances[acc.id] = balanceAtChartStart;
    });

    const chartDatesSet = new Set<string>();
    chartDatesSet.add(formatDateFns(chartStartDate, 'yyyy-MM-dd'));
    allTransactions.forEach(tx => {
        const txDate = parseISO(tx.date.includes('T') ? tx.date : tx.date + 'T00:00:00Z');
        if (txDate >= chartStartDate && txDate <= chartEndDate) {
            chartDatesSet.add(formatDateFns(startOfDay(txDate), 'yyyy-MM-dd'));
        }
    });
    chartDatesSet.add(formatDateFns(chartEndDate, 'yyyy-MM-dd'));

    const sortedUniqueChartDates = Array.from(chartDatesSet)
        .map(d => parseISO(d))
        .sort(compareAsc)
        .filter(date => date <= chartEndDate);

    if (sortedUniqueChartDates.length === 0) {
         const dataPoint: any = { date: formatDateFns(chartStartDate, 'yyyy-MM-dd') };
         relevantAccounts.forEach(acc => {
             dataPoint[acc.name] = acc.primaryCurrency ? convertCurrency(initialChartBalances[acc.id] || 0, acc.primaryCurrency, preferredCurrency) : 0;
         });
         return { data: [dataPoint], accountNames: relevantAccounts.map(a => a.name), chartConfig };
    }

    const historicalData: Array<{ date: string, [key: string]: any }> = [];
    const runningBalancesInAccountCurrency = { ...initialChartBalances };

    sortedUniqueChartDates.forEach((currentDisplayDate) => {
        allTransactions
            .filter(tx => {
                const txDate = parseISO(tx.date.includes('T') ? tx.date : tx.date + 'T00:00:00Z');
                return isSameDay(txDate, currentDisplayDate) && relevantAccounts.some(acc => acc.id === tx.accountId);
            })
            .forEach(tx => {
                const account = relevantAccounts.find(a => a.id === tx.accountId);
                if (account && account.primaryCurrency) {
                    let amountInAccountCurrency = tx.amount;
                     if (tx.transactionCurrency && account.primaryCurrency && tx.transactionCurrency.toUpperCase() !== account.primaryCurrency.toUpperCase()) {
                        amountInAccountCurrency = convertCurrency(tx.amount, tx.transactionCurrency, account.primaryCurrency);
                    }
                    runningBalancesInAccountCurrency[tx.accountId] = (runningBalancesInAccountCurrency[tx.accountId] || 0) + amountInAccountCurrency;
                }
            });

        const dateStr = formatDateFns(currentDisplayDate, 'yyyy-MM-dd');
        const dailySnapshot: { date: string, [key: string]: any } = { date: dateStr };
        relevantAccounts.forEach(acc => {
            dailySnapshot[acc.name] = acc.primaryCurrency ? convertCurrency(runningBalancesInAccountCurrency[acc.id] || 0, acc.primaryCurrency, preferredCurrency) : 0;
        });
        
        const existingEntryIndex = historicalData.findIndex(hd => hd.date === dateStr);
        if (existingEntryIndex !== -1) {
            historicalData[existingEntryIndex] = dailySnapshot;
        } else {
            historicalData.push(dailySnapshot);
        }
    });
    
    historicalData.sort((a,b) => compareAsc(parseISO(a.date), parseISO(b.date)));

    return { data: historicalData, accountNames: relevantAccounts.map(a => a.name), chartConfig };

  }, [allAccounts, allTransactions, preferredCurrency, isLoading, selectedDateRange]);


  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-6">
         <h1 className="text-3xl font-bold">Accounts Management</h1>
         {/* Add buttons are now within the unified table card */}
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

        <Card className="mb-8">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle>All Your Accounts</CardTitle>
                    <div className="flex gap-2">
                        <Dialog open={isAddAssetDialogOpen} onOpenChange={setIsAddAssetDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="default" size="sm">
                                <Landmark className="mr-2 h-4 w-4" /> Create Asset Account
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-3xl">
                                <DialogHeader>
                                <DialogTitle>Add New Asset Account</DialogTitle>
                                <DialogDescription>Enter the details of your new asset account.</DialogDescription>
                                </DialogHeader>
                                <AddAccountForm onAccountAdded={handleAccountAdded} />
                            </DialogContent>
                        </Dialog>
                        <Dialog open={isAddCryptoDialogOpen} onOpenChange={setIsAddCryptoDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="default" size="sm">
                                <BitcoinIcon className="mr-2 h-4 w-4" /> Create Crypto Account
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-3xl">
                                <DialogHeader>
                                <DialogTitle>Add New Crypto Account</DialogTitle>
                                <DialogDescription>Enter the details of your new crypto account.</DialogDescription>
                                </DialogHeader>
                                <AddCryptoForm onAccountAdded={handleAccountAdded} />
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
                <CardDescription>View and manage all your financial accounts and platform holdings.</CardDescription>
            </CardHeader>
            <CardContent>
                 {isLoading && allAccounts.length === 0 ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Provider</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Current balance</TableHead>
                                <TableHead>Last activity</TableHead>
                                <TableHead>Balance difference</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {[...Array(3)].map((_, i) => (
                                <TableRow key={`skeleton-all-${i}`}>
                                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                <TableCell className="text-right"><Skeleton className="h-8 w-16 inline-block" /></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                 ) : allAccounts.length > 0 ? (
                    <Accordion type="multiple" className="w-full">
                        {allAccounts.map((account) => {
                            const primaryBalanceEntry = account.balances.find(b => b.currency === account.primaryCurrency) || account.balances[0];
                            const displayBalance = primaryBalanceEntry ? primaryBalanceEntry.amount : 0;
                            const displayCurrency = primaryBalanceEntry ? primaryBalanceEntry.currency : account.primaryCurrency || 'N/A';

                            return (
                            <AccordionItem value={account.id} key={account.id} className="border-b">
                                <AccordionTrigger className="hover:no-underline hover:bg-muted/30 data-[state=open]:bg-muted/20 px-3 py-2 w-full rounded-md text-sm">
                                    <Table className="w-full table-fixed -my-1">
                                        <colgroup>
                                            <col style={{ width: '20%' }} />
                                            <col style={{ width: '20%' }} />
                                            <col style={{ width: '15%' }} />
                                            <col style={{ width: '20%' }} />
                                            <col style={{ width: '15%' }} />
                                            <col style={{ width: '10%' }} />
                                        </colgroup>
                                        {/* Only render TableHeader visually for the first item by hiding subsequent ones */}
                                        { allAccounts.indexOf(account) === 0 && (
                                            <TableHeader className="[&_tr]:border-0">
                                                <TableRow className="hover:bg-transparent">
                                                    <TableHead className="py-1.5">Name</TableHead>
                                                    <TableHead className="py-1.5">Provider</TableHead>
                                                    <TableHead className="py-1.5">Type</TableHead>
                                                    <TableHead className="py-1.5">Balance</TableHead>
                                                    <TableHead className="py-1.5">Last Activity</TableHead>
                                                    <TableHead className="text-right py-1.5">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                        )}
                                        <TableBody>
                                            <TableRow className="border-b-0 hover:bg-transparent data-[state=selected]:bg-transparent">
                                                <TableCell className="font-medium py-1.5 truncate">
                                                    <Link href={`/accounts/${account.id}`} passHref>
                                                    <Button variant="link" size="sm" className="p-0 h-auto text-base font-medium text-primary hover:text-primary/80 hover:no-underline" onClick={(e) => e.stopPropagation()}>
                                                        {account.name}
                                                    </Button>
                                                    </Link>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground py-1.5 truncate">{account.providerName || 'N/A'}</TableCell>
                                                <TableCell className="text-muted-foreground py-1.5 truncate">
                                                    <span className={cn("text-xs font-semibold px-1.5 py-0.5 rounded-full", account.category === 'asset' ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300" : "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300")}>
                                                        {account.category === 'asset' ? 'Asset' : 'Crypto'}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground"> - {account.type}</span>
                                                </TableCell>
                                                <TableCell className="py-1.5">
                                                    <div className="flex flex-col">
                                                    <span className="font-semibold text-primary">
                                                        {formatCurrency(displayBalance, displayCurrency, displayCurrency, false)}
                                                    </span>
                                                    {preferredCurrency && displayCurrency.toUpperCase() !== preferredCurrency.toUpperCase() && (
                                                        <span className="text-xs text-muted-foreground mt-0.5">
                                                            (≈ {formatCurrency(displayBalance, displayCurrency, preferredCurrency, true)})
                                                        </span>
                                                    )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground py-1.5 truncate">
                                                    {account.lastActivity ? formatDateFns(parseISO(account.lastActivity), 'PP') : 'N/A'}
                                                </TableCell>
                                                <TableCell className="text-right py-1.5">
                                                    <DropdownMenu>
                                                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
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
                                        </TableBody>
                                    </Table>
                                </AccordionTrigger>
                                <AccordionContent className="px-4 pt-3 pb-4 bg-muted/10 rounded-b-md border-t">
                                    <p className="text-sm text-muted-foreground mb-2">Other currency balances for {account.name}:</p>
                                    {account.balances.filter(b => b.currency !== account.primaryCurrency).length > 0 ? (
                                        <ul className="list-disc pl-5 text-xs space-y-1">
                                            {account.balances.filter(b => b.currency !== account.primaryCurrency).map(bal => (
                                                <li key={bal.currency}>
                                                    {formatCurrency(bal.amount, bal.currency, bal.currency, false)}
                                                    {bal.currency.toUpperCase() !== preferredCurrency.toUpperCase() && (
                                                        <span className="text-muted-foreground/80 ml-1">
                                                            (≈ {formatCurrency(bal.amount, bal.currency, preferredCurrency, true)})
                                                        </span>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-xs text-muted-foreground italic">No other currency balances recorded for this account.</p>
                                    )}
                                </AccordionContent>
                            </AccordionItem>
                        )})}
                    </Accordion>
                 ) : (
                     <div className="text-center py-10">
                        <p className="text-muted-foreground">No accounts added yet.</p>
                         <div className="flex gap-2 justify-center mt-4">
                            <Dialog open={isAddAssetDialogOpen} onOpenChange={setIsAddAssetDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="default" size="sm">
                                    <Landmark className="mr-2 h-4 w-4" /> Add Asset Account
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-3xl">
                                    <DialogHeader><DialogTitle>Add New Asset Account</DialogTitle><DialogDescription>Enter the details of your new asset account.</DialogDescription></DialogHeader>
                                    <AddAccountForm onAccountAdded={handleAccountAdded} />
                                </DialogContent>
                            </Dialog>
                            <Dialog open={isAddCryptoDialogOpen} onOpenChange={setIsAddCryptoDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="default" size="sm">
                                    <BitcoinIcon className="mr-2 h-4 w-4" /> Add Crypto Account
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-3xl">
                                    <DialogHeader><DialogTitle>Add New Crypto Account</DialogTitle><DialogDescription>Enter the details of your new crypto account.</DialogDescription></DialogHeader>
                                    <AddCryptoForm onAccountAdded={handleAccountAdded} />
                                </DialogContent>
                            </Dialog>
                        </div>
                     </div>
                 )}
            </CardContent>
        </Card>


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
