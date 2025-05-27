
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { getAccounts, addAccount, deleteAccount, updateAccount, type Account, type NewAccountData } from "@/services/account-sync";
import { getTransactions, type Transaction } from '@/services/transactions';
import { Landmark, Bitcoin as BitcoinIcon, MoreHorizontal, Eye, Edit3 as EditIcon, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import AddAccountForm from '@/components/accounts/add-account-form';
import AddCryptoForm from '@/components/accounts/add-crypto-form';
import EditAccountForm from '@/components/accounts/edit-account-form';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, convertCurrency, getCurrencySymbol } from '@/lib/currency';
import { getUserPreferences } from '@/lib/preferences';
import { format as formatDateFns, parseISO, compareAsc, startOfDay, isSameDay, endOfDay } from 'date-fns';
import Link from 'next/link';
import AccountBalanceHistoryChart from '@/components/accounts/account-balance-history-chart';
import { useDateRange } from '@/contexts/DateRangeContext';
import { useAuthContext } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';


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
        setError("Could not load data. Details: " + err.message);
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
         if (typeof window !== 'undefined' && event.type === 'storage' && user && !isLoadingAuth) {
            const isLikelyOurCustomEvent = event.key === null;
            const relevantKeysForThisPage = ['userAccounts', 'userPreferences', 'transactions-'];
            const isRelevantExternalChange = typeof event.key === 'string' && relevantKeysForThisPage.some(k => event.key && event.key.includes(k));

            if (isLikelyOurCustomEvent || isRelevantExternalChange) {
                fetchAllData();
            }
        }
    };
    if (typeof window !== 'undefined') window.addEventListener('storage', handleStorageChange);
    return () => {
        if (typeof window !== 'undefined') window.removeEventListener('storage', handleStorageChange);
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
    if (isLoading || allAccounts.length === 0 || !preferredCurrency || !allTransactions) {
        return { data: [], accountNames: [], chartConfig: {} };
    }

    const relevantAccounts = allAccounts.filter(acc => acc.includeInNetWorth !== false && acc.balances && acc.balances.length > 0);
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
    
    const initialChartBalances = new Map<string, number>();

    relevantAccounts.forEach(acc => {
        // Start with the current balance and roll back transactions *after* the chart start date
        const primaryBalanceEntry = acc.balances.find(b => b.currency === acc.primaryCurrency);
        let balanceAtChartStart = primaryBalanceEntry ? primaryBalanceEntry.amount : 0;

        // Subtract transactions that happened between chartStartDate and now (or end of tx data)
        allTransactions
            .filter(tx => {
                const txDate = parseISO(tx.date.includes('T') ? tx.date : tx.date + 'T00:00:00Z');
                return tx.accountId === acc.id && txDate >= chartStartDate && txDate <= maxTxDateOverall;
            })
            .forEach(tx => {
                let amountInAccountPrimaryCurrency = tx.amount;
                if (acc.primaryCurrency && tx.transactionCurrency.toUpperCase() !== acc.primaryCurrency.toUpperCase()) {
                    amountInAccountPrimaryCurrency = convertCurrency(tx.amount, tx.transactionCurrency, acc.primaryCurrency);
                }
                balanceAtChartStart -= amountInAccountPrimaryCurrency; // Subtract to roll back
            });
            
        // Now add transactions that happened *before* chartStartDate to this rolled-back balance
        allTransactions
            .filter(tx => {
                const txDate = parseISO(tx.date.includes('T') ? tx.date : tx.date + 'T00:00:00Z');
                return tx.accountId === acc.id && txDate < chartStartDate;
            })
            .forEach(tx => {
                let amountInAccountPrimaryCurrency = tx.amount;
                 if (acc.primaryCurrency && tx.transactionCurrency.toUpperCase() !== acc.primaryCurrency.toUpperCase()) {
                    amountInAccountPrimaryCurrency = convertCurrency(tx.amount, tx.transactionCurrency, acc.primaryCurrency);
                }
                balanceAtChartStart += amountInAccountPrimaryCurrency; // Add to build up to chart start
            });

        initialChartBalances.set(acc.id, balanceAtChartStart);
    });


    const chartDatesSet = new Set<string>();
    chartDatesSet.add(formatDateFns(chartStartDate, 'yyyy-MM-dd')); // Always include the chart start date
    allTransactions.forEach(tx => {
        const txDate = parseISO(tx.date.includes('T') ? tx.date : tx.date + 'T00:00:00Z');
        if (txDate >= chartStartDate && txDate <= chartEndDate && relevantAccounts.some(ra => ra.id === tx.accountId)) {
            chartDatesSet.add(formatDateFns(startOfDay(txDate), 'yyyy-MM-dd'));
        }
    });
     // Always include the chart end date if it's within reasonable bounds or current
    if (allTxDates.length === 0 || chartEndDate <= new Date() || chartEndDate >= maxTxDateOverall) {
        chartDatesSet.add(formatDateFns(chartEndDate, 'yyyy-MM-dd'));
    }


    const sortedUniqueChartDates = Array.from(chartDatesSet)
        .map(d => parseISO(d))
        .sort(compareAsc)
        .filter(date => date >= chartStartDate && date <= chartEndDate);


    const historicalData: Array<{ date: string, [key: string]: any }> = [];
    const runningBalances = new Map<string, number>(initialChartBalances);

    if (sortedUniqueChartDates.length === 0) { // Handle case with no transactions in range
         const dataPoint: any = { date: formatDateFns(chartStartDate, 'yyyy-MM-dd') };
         relevantAccounts.forEach(acc => {
             const balanceForChart = initialChartBalances.get(acc.id) || 0;
             dataPoint[acc.name] = acc.primaryCurrency ? convertCurrency(balanceForChart, acc.primaryCurrency, preferredCurrency) : 0;
         });
         // Add a second point for the end of the range if it's different
         if (!isSameDay(chartStartDate, chartEndDate)) {
            const endDataPoint = { ...dataPoint, date: formatDateFns(chartEndDate, 'yyyy-MM-dd')};
            return { data: [dataPoint, endDataPoint], accountNames: relevantAccounts.map(a => a.name), chartConfig };
         }
         return { data: [dataPoint], accountNames: relevantAccounts.map(a => a.name), chartConfig };
    }
    
    // Ensure the very first point is the chartStartDate with initial balances
    const firstDataPoint: any = { date: formatDateFns(chartStartDate, 'yyyy-MM-dd') };
    relevantAccounts.forEach(acc => {
        const balanceForChart = initialChartBalances.get(acc.id) || 0;
        firstDataPoint[acc.name] = acc.primaryCurrency ? convertCurrency(balanceForChart, acc.primaryCurrency, preferredCurrency) : 0;
    });
    historicalData.push(firstDataPoint);


    sortedUniqueChartDates.forEach((currentDisplayDate) => {
        // Skip if currentDisplayDate is the same as chartStartDate and we've already added it
        if (isSameDay(currentDisplayDate, chartStartDate) && historicalData.length > 0 && historicalData[0].date === formatDateFns(chartStartDate, 'yyyy-MM-dd')) {
            // We only process transactions for chartStartDate, running balances are already set
        }

        allTransactions
            .filter(tx => {
                const txDate = parseISO(tx.date.includes('T') ? tx.date : tx.date + 'T00:00:00Z');
                return isSameDay(txDate, currentDisplayDate) && relevantAccounts.some(acc => acc.id === tx.accountId);
            })
            .forEach(tx => {
                const account = relevantAccounts.find(a => a.id === tx.accountId);
                if (account && account.primaryCurrency) {
                    let amountInAccountPrimaryCurrency = tx.amount;
                     if (tx.transactionCurrency.toUpperCase() !== account.primaryCurrency.toUpperCase()) {
                        amountInAccountPrimaryCurrency = convertCurrency(tx.amount, tx.transactionCurrency, account.primaryCurrency);
                    }
                    runningBalances.set(tx.accountId, (runningBalances.get(tx.accountId) || 0) + amountInAccountPrimaryCurrency);
                }
            });
        
        const dateStr = formatDateFns(currentDisplayDate, 'yyyy-MM-dd');
        // Update existing point for chartStartDate or add new point for other dates
        const existingPointIndex = historicalData.findIndex(p => p.date === dateStr);
        const dailySnapshot: { date: string, [key: string]: any } = existingPointIndex !== -1 ? historicalData[existingPointIndex] : { date: dateStr };

        relevantAccounts.forEach(acc => {
            const balanceForChart = runningBalances.get(acc.id) || 0;
            dailySnapshot[acc.name] = acc.primaryCurrency ? convertCurrency(balanceForChart, acc.primaryCurrency, preferredCurrency) : 0;
        });
        
        if (existingPointIndex === -1) {
            historicalData.push(dailySnapshot);
        }
    });
    
    // Ensure the chart extends to chartEndDate if no transactions on that day
    const lastChartDateStr = formatDateFns(chartEndDate, 'yyyy-MM-dd');
    if (historicalData.length > 0 && historicalData[historicalData.length -1].date !== lastChartDateStr && !isSameDay(chartStartDate, chartEndDate) ) {
        const lastKnownBalances = { ...historicalData[historicalData.length - 1], date: lastChartDateStr };
        historicalData.push(lastKnownBalances);
    }
    
    historicalData.sort((a,b) => compareAsc(parseISO(a.date), parseISO(b.date)));
    
    // Deduplicate if chartStartDate or chartEndDate were added twice
    const uniqueHistoricalData = historicalData.filter((item, index, self) =>
        index === self.findIndex((t) => t.date === item.date)
    );

    return { data: uniqueHistoricalData, accountNames: relevantAccounts.map(a => a.name), chartConfig };

  }, [allAccounts, allTransactions, preferredCurrency, isLoading, selectedDateRange]);


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

        <Card className="mb-8">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle>All Accounts</CardTitle>
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
                    <div className="space-y-3">
                        {[...Array(3)].map((_, i) => (
                            <Card key={`skeleton-all-${i}`} className="p-4 border rounded-lg shadow-sm bg-card">
                                <div className="flex justify-between items-center">
                                    <div className="space-y-1">
                                        <Skeleton className="h-5 w-24" />
                                        <Skeleton className="h-4 w-32" />
                                    </div>
                                    <Skeleton className="h-8 w-16" />
                                </div>
                            </Card>
                        ))}
                    </div>
                 ) : allAccounts.length > 0 ? (
                    <Accordion type="multiple" className="w-full">
                        {allAccounts.map((account) => {
                            const primaryBalanceEntry = account.balances && account.balances.length > 0
                                ? account.balances.find(b => b.currency === account.primaryCurrency) || account.balances[0]
                                : null;
                            const displayBalance = primaryBalanceEntry ? primaryBalanceEntry.amount : 0;
                            const displayCurrency = primaryBalanceEntry ? primaryBalanceEntry.currency : (account.primaryCurrency || 'N/A');

                            return (
                            <AccordionItem value={account.id} key={account.id} className="border rounded-lg shadow-sm mb-3 bg-card overflow-hidden">
                                <AccordionTrigger className="p-4 hover:bg-muted/50 data-[state=open]:bg-muted/30 data-[state=open]:border-b w-full text-left">
                                    <div className="flex-1 grid grid-cols-[2fr_1.5fr_1fr_1.5fr_1fr_auto] items-center gap-4">
                                        <div className="truncate">
                                            <Link
                                                href={`/accounts/${account.id}`}
                                                className={cn(buttonVariants({ variant: "link", size: "sm" }), "p-0 h-auto text-base font-medium text-primary hover:text-primary/80 hover:no-underline focus:outline-none focus:ring-1 focus:ring-primary rounded")}
                                                onClick={(e) => e.stopPropagation()}
                                                aria-label={`View account ${account.name}`}
                                            >
                                                {account.name}
                                            </Link>
                                            <p className="text-xs text-muted-foreground truncate">{account.providerName || 'N/A'}</p>
                                        </div>
                                        <div className="truncate">
                                            <Badge variant="outline" className={cn(
                                                "text-xs font-semibold px-1.5 py-0.5",
                                                account.category === 'asset' ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300" : "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300"
                                            )}>
                                                {account.category === 'asset' ? 'Asset' : 'Crypto'}
                                            </Badge>
                                            <p className="text-xs text-muted-foreground truncate">{account.type}</p>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-semibold text-primary">
                                                {formatCurrency(displayBalance, displayCurrency, displayCurrency, false)}
                                            </div>
                                            {preferredCurrency && typeof displayCurrency === 'string' && displayCurrency.toUpperCase() !== preferredCurrency.toUpperCase() && (
                                                <div className="text-xs text-muted-foreground mt-0.5">
                                                    (≈ {formatCurrency(displayBalance, displayCurrency, preferredCurrency, true)})
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-muted-foreground truncate">
                                            {account.lastActivity ? formatDateFns(parseISO(account.lastActivity), 'PP') : 'N/A'}
                                        </div>
                                        <div className="flex-shrink-0"> {/* Ensure actions don't cause overflow */}
                                            <DropdownMenu>
                                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                <div
                                                    role="button"
                                                    tabIndex={0}
                                                    aria-haspopup="menu"
                                                    aria-expanded={false} // This should be managed by DropdownMenu state internally
                                                    className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'h-8 w-8 p-0 cursor-pointer flex items-center justify-center')}
                                                    // onKeyDown for space/enter if needed for DropdownMenuTrigger if not a button
                                                >
                                                    <span className="sr-only">Open menu</span>
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </div>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem asChild>
                                                    <Link href={`/accounts/${account.id}`} className="flex items-center w-full">
                                                        <Eye className="mr-2 h-4 w-4" />
                                                        <span>View Transactions</span>
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => openEditDialog(account)}>
                                                <EditIcon className="mr-2 h-4 w-4" />
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
                                        </div>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-4 pt-3 pb-4 bg-muted/10">
                                    <p className="text-sm text-muted-foreground mb-2">Other currency balances for {account.name}:</p>
                                    {account.balances && account.balances.filter(b => b.currency !== account.primaryCurrency).length > 0 ? (
                                        <ul className="list-disc pl-5 text-xs space-y-1">
                                            {account.balances.filter(b => b.currency !== account.primaryCurrency).map(bal => (
                                                <li key={bal.currency}>
                                                    {formatCurrency(bal.amount, bal.currency, bal.currency, false)}
                                                    {bal.currency && typeof bal.currency === 'string' && bal.currency.toUpperCase() !== preferredCurrency.toUpperCase() && (
                                                        <span className="text-muted-foreground/80 ml-1 break-words">
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

