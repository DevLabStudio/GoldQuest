
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getAccounts, addAccount, deleteAccount, updateAccount, type Account, type NewAccountData } from "@/services/account-sync";
import { getTransactions, type Transaction } from '@/services/transactions';
import { PlusCircle, Edit, Trash2, MoreHorizontal, Eye, ChevronDown } from "lucide-react"; // Added ChevronDown
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"; // Import Accordion
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
    const chartEndDate = endOfDay(selectedDateRange.to || maxTxDateOverall);

    const initialChartBalances: { [accountId: string]: number } = {};
    relevantAccounts.forEach(acc => {
        let balanceAtChartStart = acc.balance;
        allTransactions
            .filter(tx => {
                const txDate = parseISO(tx.date.includes('T') ? tx.date : tx.date + 'T00:00:00Z');
                return tx.accountId === acc.id && txDate >= chartStartDate;
            })
            .forEach(tx => {
                let amountInAccountCurrency = tx.amount;
                if (tx.transactionCurrency && acc.currency && tx.transactionCurrency.toUpperCase() !== acc.currency.toUpperCase()) {
                    amountInAccountCurrency = convertCurrency(tx.amount, tx.transactionCurrency, acc.currency);
                }
                balanceAtChartStart -= amountInAccountCurrency;
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
             dataPoint[acc.name] = acc.currency ? convertCurrency(initialChartBalances[acc.id] || 0, acc.currency, preferredCurrency) : 0;
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
                if (account && account.currency) {
                    let amountInAccountCurrency = tx.amount;
                     if (tx.transactionCurrency && account.currency && tx.transactionCurrency.toUpperCase() !== account.currency.toUpperCase()) {
                        amountInAccountCurrency = convertCurrency(tx.amount, tx.transactionCurrency, account.currency);
                    }
                    runningBalancesInAccountCurrency[tx.accountId] = (runningBalancesInAccountCurrency[tx.accountId] || 0) + amountInAccountCurrency;
                }
            });

        const dateStr = formatDateFns(currentDisplayDate, 'yyyy-MM-dd');
        const dailySnapshot: { date: string, [key: string]: any } = { date: dateStr };
        relevantAccounts.forEach(acc => {
            dailySnapshot[acc.name] = acc.currency ? convertCurrency(runningBalancesInAccountCurrency[acc.id] || 0, acc.currency, preferredCurrency) : 0;
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
        {isLoading ? (
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
                    {[...Array(2)].map((_, i) => (
                        <TableRow key={`skeleton-${category}-${i}`}>
                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-8 w-16 inline-block" /></TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        ) : accounts.length > 0 ? (
            <Accordion type="multiple" className="w-full">
                {accounts.map((account) => (
                    <AccordionItem value={account.id} key={account.id} className="border-b-0">
                        <AccordionTrigger className="hover:no-underline hover:bg-muted/50 px-2 py-0 rounded-md -mx-2">
                             <Table className="w-full table-fixed">{/* Ensure no leading/trailing spaces or newlines inside this JSX tag */}
                                <colgroup>
                                    <col style={{ width: '25%' }} />
                                    <col style={{ width: '20%' }} />
                                    <col style={{ width: '20%' }} />
                                    <col style={{ width: '15%' }} />
                                    <col style={{ width: '10%' }} />
                                    <col style={{ width: '10%' }} />
                                </colgroup>
                                { /* Only render TableHeader for the first item or outside the map if columns are always the same */ }
                                { accounts.indexOf(account) === 0 && (
                                    <TableHeader className="invisible h-0">
                                        <TableRow>
                                            <TableHead className="py-0">Name</TableHead>
                                            <TableHead className="py-0">{category === 'asset' ? 'Bank/Institution' : 'Exchange/Wallet'}</TableHead>
                                            <TableHead className="py-0">Current balance</TableHead>
                                            <TableHead className="py-0">Last activity</TableHead>
                                            <TableHead className="py-0">Balance diff.</TableHead>
                                            <TableHead className="text-right py-0">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                )}
                                <TableBody>
                                    <TableRow className="border-b-0 hover:bg-transparent data-[state=selected]:bg-transparent">
                                        <TableCell className="font-medium py-3 truncate">
                                            <Link href={`/accounts/${account.id}`} passHref>
                                            <Button variant="link" size="sm" className="p-0 h-auto text-base font-medium text-primary hover:text-primary/80 hover:no-underline" onClick={(e) => e.stopPropagation()}>
                                                {account.name}
                                            </Button>
                                            </Link>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground py-3 truncate">{account.providerName || 'N/A'}</TableCell>
                                        <TableCell className="py-3">
                                            <div className="flex flex-col">
                                            <span className="font-semibold text-primary">
                                                {account.currency ? formatCurrency(account.balance, account.currency, account.currency, false) : 'N/A'}
                                            </span>
                                            {preferredCurrency && account.currency && account.currency.toUpperCase() !== preferredCurrency.toUpperCase() && (
                                                <span className="text-xs text-muted-foreground mt-1">
                                                    (≈ {formatCurrency(account.balance, account.currency, preferredCurrency, true)})
                                                </span>
                                            )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground py-3 truncate">
                                            {account.lastActivity ? formatDateFns(parseISO(account.lastActivity), 'PP') : 'N/A'}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground py-3 truncate">
                                            {account.currency ? formatCurrency(account.balanceDifference ?? 0, account.currency, preferredCurrency, false) : 'N/A'}
                                        </TableCell>
                                        <TableCell className="text-right py-3">
                                            <DropdownMenu>
                                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
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
                                </TableBody>
                            </Table>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 py-3 bg-muted/20 rounded-b-md">
                            <p className="text-sm text-muted-foreground mb-2">Sub-accounts for {account.name}:</p>
                            {/* Placeholder for sub-accounts list */}
                            <p className="text-xs text-muted-foreground italic">Sub-account display coming soon.</p>
                            <Button variant="outline" size="sm" className="mt-2">
                                <PlusCircle className="mr-2 h-3.5 w-3.5" /> Add Sub-Account
                            </Button>
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        ) : (
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
                </TableBody>
            </Table>
        )}
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

