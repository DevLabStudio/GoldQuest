
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { getAccounts, addAccount, deleteAccount, updateAccount, type Account, type NewAccountData } from "@/services/account-sync";
import { getTransactions, type Transaction } from '@/services/transactions';
import { Landmark, Bitcoin as BitcoinIcon, MoreHorizontal, Eye, Edit3 as EditIcon, Trash2, CheckCircle, XCircle, MinusCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription as FormDialogDescription, DialogTrigger } from "@/components/ui/dialog"; // Renamed DialogDescription to avoid conflict
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
// Accordion components removed
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
import Image from 'next/image';


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

    const relevantAccounts = allAccounts.filter(acc => acc.includeInNetWorth !== false && acc.balances && acc.balances.length > 0 && acc.primaryCurrency);
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
        const primaryBalanceEntry = acc.balances.find(b => b.currency === acc.primaryCurrency);
        let balanceAtChartStart = primaryBalanceEntry ? primaryBalanceEntry.amount : 0; 

        allTransactions
            .filter(tx => {
                const txDate = parseISO(tx.date.includes('T') ? tx.date : tx.date + 'T00:00:00Z');
                return tx.accountId === acc.id && txDate >= chartStartDate && txDate <= maxTxDateOverall && tx.category?.toLowerCase() !== 'opening balance';
            })
            .forEach(tx => {
                let amountInAccountPrimaryCurrency = tx.amount;
                if (acc.primaryCurrency && tx.transactionCurrency.toUpperCase() !== acc.primaryCurrency.toUpperCase()) {
                    amountInAccountPrimaryCurrency = convertCurrency(tx.amount, tx.transactionCurrency, acc.primaryCurrency);
                }
                balanceAtChartStart -= amountInAccountPrimaryCurrency;
            });
            
        allTransactions
            .filter(tx => {
                const txDate = parseISO(tx.date.includes('T') ? tx.date : tx.date + 'T00:00:00Z');
                return tx.accountId === acc.id && txDate < chartStartDate && tx.category?.toLowerCase() !== 'opening balance';
            })
            .forEach(tx => {
                let amountInAccountPrimaryCurrency = tx.amount;
                 if (acc.primaryCurrency && tx.transactionCurrency.toUpperCase() !== acc.primaryCurrency.toUpperCase()) {
                    amountInAccountPrimaryCurrency = convertCurrency(tx.amount, tx.transactionCurrency, acc.primaryCurrency);
                }
                balanceAtChartStart += amountInAccountPrimaryCurrency;
            });

        initialChartBalances.set(acc.id, balanceAtChartStart);
    });


    const chartDatesSet = new Set<string>();
    chartDatesSet.add(formatDateFns(chartStartDate, 'yyyy-MM-dd')); 
    allTransactions.forEach(tx => {
        const txDate = parseISO(tx.date.includes('T') ? tx.date : tx.date + 'T00:00:00Z');
        if (txDate >= chartStartDate && txDate <= chartEndDate && relevantAccounts.some(ra => ra.id === tx.accountId) && tx.category?.toLowerCase() !== 'opening balance') {
            chartDatesSet.add(formatDateFns(startOfDay(txDate), 'yyyy-MM-dd'));
        }
    });
    if (allTxDates.length === 0 || chartEndDate <= new Date() || chartEndDate >= maxTxDateOverall) {
        chartDatesSet.add(formatDateFns(chartEndDate, 'yyyy-MM-dd'));
    }

    const sortedUniqueChartDates = Array.from(chartDatesSet)
        .map(d => parseISO(d))
        .sort(compareAsc)
        .filter(date => date >= chartStartDate && date <= chartEndDate);

    const historicalData: Array<{ date: string, [key: string]: any }> = [];
    const runningBalances = new Map<string, number>(initialChartBalances);

    if (sortedUniqueChartDates.length === 0) { 
         const dataPoint: any = { date: formatDateFns(chartStartDate, 'yyyy-MM-dd') };
         relevantAccounts.forEach(acc => {
             const balanceForChart = initialChartBalances.get(acc.id) || 0;
             dataPoint[acc.name] = acc.primaryCurrency ? convertCurrency(balanceForChart, acc.primaryCurrency, preferredCurrency) : 0;
         });
         if (!isSameDay(chartStartDate, chartEndDate)) {
            const endDataPoint = { ...dataPoint, date: formatDateFns(chartEndDate, 'yyyy-MM-dd')};
            return { data: [dataPoint, endDataPoint], accountNames: relevantAccounts.map(a => a.name), chartConfig };
         }
         return { data: [dataPoint], accountNames: relevantAccounts.map(a => a.name), chartConfig };
    }
    
    const firstDataPoint: any = { date: formatDateFns(chartStartDate, 'yyyy-MM-dd') };
    relevantAccounts.forEach(acc => {
        const balanceForChart = initialChartBalances.get(acc.id) || 0;
        firstDataPoint[acc.name] = acc.primaryCurrency ? convertCurrency(balanceForChart, acc.primaryCurrency, preferredCurrency) : 0;
    });
    historicalData.push(firstDataPoint);

    sortedUniqueChartDates.forEach((currentDisplayDate) => {
        if (isSameDay(currentDisplayDate, chartStartDate) && historicalData.length > 0 && historicalData[0].date === formatDateFns(chartStartDate, 'yyyy-MM-dd')) {
            // Already processed initial balances for chartStartDate
        }

        allTransactions
            .filter(tx => {
                const txDate = parseISO(tx.date.includes('T') ? tx.date : tx.date + 'T00:00:00Z');
                return isSameDay(txDate, currentDisplayDate) && relevantAccounts.some(acc => acc.id === tx.accountId) && tx.category?.toLowerCase() !== 'opening balance';
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
    
    const lastChartDateStr = formatDateFns(chartEndDate, 'yyyy-MM-dd');
    if (historicalData.length > 0 && historicalData[historicalData.length -1].date !== lastChartDateStr && !isSameDay(chartStartDate, chartEndDate) ) {
        const lastKnownBalances = { ...historicalData[historicalData.length - 1], date: lastChartDateStr };
        historicalData.push(lastKnownBalances);
    }
    
    historicalData.sort((a,b) => compareAsc(parseISO(a.date), parseISO(b.date)));
    
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

        <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-semibold">All Accounts</h2>
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
                            <FormDialogDescription>Enter the details of your new asset account.</FormDialogDescription>
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
                            <FormDialogDescription>Enter the details of your new crypto account.</FormDialogDescription>
                            </DialogHeader>
                            <AddCryptoForm onAccountAdded={handleAccountAdded} />
                        </DialogContent>
                    </Dialog>
                </div>
            </div>
            <p className="text-muted-foreground mb-6">View and manage all your financial accounts and platform holdings.</p>

            {isLoading && allAccounts.length === 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[...Array(3)].map((_, i) => (
                        <Card key={`skeleton-all-${i}`} className="p-4 border rounded-lg shadow-sm bg-card">
                            <div className="flex justify-between items-center mb-2">
                                <Skeleton className="h-6 w-8 rounded-md" />
                                <Skeleton className="h-5 w-20" />
                                <Skeleton className="h-6 w-6 rounded-full" />
                            </div>
                            <Skeleton className="h-7 w-3/4 mb-1" />
                            <Skeleton className="h-4 w-1/2 mb-3" />
                            <div className="flex justify-between items-center">
                                <Skeleton className="h-4 w-16" />
                                <Skeleton className="h-4 w-20" />
                            </div>
                        </Card>
                    ))}
                </div>
            ) : allAccounts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {allAccounts.map((account) => {
                        const primaryBalanceEntry = account.balances && account.balances.length > 0
                            ? account.balances.find(b => b.currency === account.primaryCurrency) || account.balances[0]
                            : null;
                        const displayBalance = primaryBalanceEntry ? primaryBalanceEntry.amount : 0;
                        const displayCurrency = primaryBalanceEntry ? primaryBalanceEntry.currency : (account.primaryCurrency || 'N/A');
                        const IconComponent = account.category === 'crypto' ? BitcoinIcon : Landmark;
                        
                        let netWorthStatusIcon;
                        if (account.includeInNetWorth === true) {
                           netWorthStatusIcon = <CheckCircle className="h-4 w-4 text-green-500" title="Included in Net Worth" />;
                        } else if (account.includeInNetWorth === false) {
                           netWorthStatusIcon = <XCircle className="h-4 w-4 text-red-500" title="Excluded from Net Worth" />;
                        } else {
                            netWorthStatusIcon = <MinusCircle className="h-4 w-4 text-muted-foreground" title="Net Worth status not set" />;
                        }


                        return (
                            <Card key={account.id} className="shadow-md hover:shadow-lg transition-shadow duration-200 flex flex-col">
                                <CardHeader className="flex flex-row items-start justify-between pb-3 pt-4 px-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-muted rounded-md">
                                        {account.category === 'crypto' && account.providerDisplayIconUrl ? (
                                            <Image src={account.providerDisplayIconUrl} alt={`${account.providerName} logo`} width={24} height={24} className="rounded-full object-contain" data-ai-hint={`${account.providerName} logo`}/>
                                        ) : (
                                            <IconComponent className="w-6 h-6 text-primary" />
                                        )}
                                        </div>
                                        <div>
                                            <CardTitle className="text-md">
                                                <Link href={`/accounts/${account.id}`} className="font-medium text-primary hover:text-primary/80 hover:underline focus:outline-none focus:ring-1 focus:ring-primary rounded text-base p-0.5">
                                                    {account.name}
                                                </Link>
                                            </CardTitle>
                                            <CardDescription className="text-xs">{account.providerName || 'N/A'}</CardDescription>
                                        </div>
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 -mt-1 -mr-1">
                                                <MoreHorizontal className="h-4 w-4" />
                                                <span className="sr-only">Account actions</span>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem asChild>
                                                <Link href={`/accounts/${account.id}`} className="flex items-center w-full">
                                                    <Eye className="mr-2 h-4 w-4" /> View Transactions
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => openEditDialog(account)}>
                                                <EditIcon className="mr-2 h-4 w-4" /> Edit Account
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleDeleteAccount(account.id)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                                <Trash2 className="mr-2 h-4 w-4" /> Delete Account
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </CardHeader>
                                <CardContent className="flex-grow space-y-3 pt-0 pb-3 px-4">
                                    <div className="text-2xl font-bold text-primary">
                                        {formatCurrency(displayBalance, displayCurrency, displayCurrency, false)}
                                    </div>
                                    {preferredCurrency && typeof displayCurrency === 'string' && displayCurrency.toUpperCase() !== preferredCurrency.toUpperCase() && (
                                        <div className="text-xs text-muted-foreground -mt-2">
                                            (≈ {formatCurrency(displayBalance, displayCurrency, preferredCurrency, true)})
                                        </div>
                                    )}
                                    <div className="flex flex-wrap gap-2 items-center">
                                        <Badge variant="outline" className={cn(
                                            "text-xs px-1.5 py-0.5",
                                            account.category === 'asset' ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300" : "border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                                        )}>
                                            {account.category === 'asset' ? 'Asset' : 'Crypto'}
                                        </Badge>
                                        <Badge variant="secondary" className="text-xs px-1.5 py-0.5">{account.type}</Badge>
                                        {netWorthStatusIcon}
                                    </div>
                                    
                                    {account.balances && account.balances.filter(b => b.currency !== account.primaryCurrency).length > 0 && (
                                        <div>
                                            <p className="text-xs text-muted-foreground mb-1 mt-2">Other balances:</p>
                                            <div className="flex flex-wrap gap-1">
                                            {account.balances.filter(b => b.currency !== account.primaryCurrency).map(bal => (
                                                <Badge key={bal.currency} variant="outline" className="text-xs font-normal px-1.5 py-0.5">
                                                    {formatCurrency(bal.amount, bal.currency, bal.currency, false)}
                                                </Badge>
                                            ))}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                                <CardFooter className="text-xs text-muted-foreground pt-0 pb-3 px-4">
                                    Last activity: {account.lastActivity ? formatDateFns(parseISO(account.lastActivity), 'PP') : 'N/A'}
                                </CardFooter>
                            </Card>
                        )
                    })}
                </div>
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
                                <DialogHeader><DialogTitle>Add New Asset Account</DialogTitle><FormDialogDescription>Enter the details of your new asset account.</FormDialogDescription></DialogHeader>
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
                                <DialogHeader><DialogTitle>Add New Crypto Account</DialogTitle><FormDialogDescription>Enter the details of your new crypto account.</FormDialogDescription></DialogHeader>
                                <AddCryptoForm onAccountAdded={handleAccountAdded} />
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            )}
        </div>

      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) setSelectedAccount(null);
      }}>
          <DialogContent className="sm:max-w-3xl">
              <DialogHeader>
                  <DialogTitle>Edit Account</DialogTitle>
                  <FormDialogDescription>
                      Modify the details of your account.
                  </FormDialogDescription>
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



