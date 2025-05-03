
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAccounts, type Account } from "@/services/account-sync";
import { getTransactions, type Transaction } from "@/services/transactions.tsx";
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/currency';
import { getUserPreferences } from '@/lib/preferences';
import { format } from 'date-fns';
import { ArrowRightLeft, MoreHorizontal, Edit, Trash2 } from 'lucide-react'; // Import icons
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';

// Helper function to format date
const formatDate = (dateString: string): string => {
    try {
        const date = new Date(dateString.includes('T') ? dateString : dateString + 'T00:00:00Z');
        if (isNaN(date.getTime())) throw new Error('Invalid date');
        return format(date, 'PP');
    } catch (error) {
        console.error("Error formatting date:", dateString, error);
        return 'Invalid Date';
    }
};

export default function TransfersPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preferredCurrency, setPreferredCurrency] = useState('BRL');
  const { toast } = useToast();

  // State for Delete Confirmation (Edit might need more complex handling for transfers)
  const [selectedTransactionPair, setSelectedTransactionPair] = useState<Transaction[] | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);


  // Fetch data on mount and listen for storage changes
  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
       if (typeof window === 'undefined') {
         if (isMounted) {
           setIsLoading(false);
           setError("Transfer data can only be loaded on the client.");
         }
         return;
       }

      if (isMounted) setIsLoading(true);
      if (isMounted) setError(null);
      try {
        const prefs = getUserPreferences();
        if (isMounted) setPreferredCurrency(prefs.preferredCurrency);

        const fetchedAccounts = await getAccounts();
        if (isMounted) setAccounts(fetchedAccounts);

        const transactionPromises = fetchedAccounts.map(acc => getTransactions(acc.id));
        const transactionsByAccount = await Promise.all(transactionPromises);
        const combinedTransactions = transactionsByAccount.flat();

        combinedTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        if (isMounted) setAllTransactions(combinedTransactions);

      } catch (err) {
        console.error("Failed to fetch transfer data:", err);
        if (isMounted) setError("Could not load transfer data. Please try again later.");
        toast({ title: "Error", description: "Failed to load data.", variant: "destructive" });
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchData();

     const handleStorageChange = (event: StorageEvent) => {
         if (typeof window !== 'undefined' && (event.key === 'userAccounts' || event.key === 'userPreferences' || event.key === 'userCategories')) {
             console.log("Storage changed, refetching transfer data...");
             if (isMounted) fetchData();
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
     }

  }, [toast]); // Added toast to dependency array

  // Find pairs of transfer transactions (simple matching by description and inverse amount)
  // This is a basic approach and might be fragile. A dedicated transfer ID would be better.
  const transferTransactionPairs = useMemo(() => {
    const transfers: { from: Transaction, to: Transaction }[] = [];
    const processedIds = new Set<string>();

    // Iterate through potential outgoing transfers (negative amount, 'Transfer' category or similar description)
    allTransactions.forEach(txOut => {
      if (txOut.amount < 0 && !processedIds.has(txOut.id) && (txOut.category?.toLowerCase() === 'transfer' || txOut.description?.toLowerCase().includes('transfer'))) {
        // Find a matching incoming transaction
        const txIn = allTransactions.find(tx =>
          tx.amount === -txOut.amount && // Opposite amount
          tx.accountId !== txOut.accountId && // Different account
          !processedIds.has(tx.id) &&
          (tx.category?.toLowerCase() === 'transfer' || tx.description?.toLowerCase().includes('transfer')) &&
          // Very basic matching: check if descriptions mention each other's account name (could be improved)
          (txOut.description?.includes(accounts.find(a => a.id === tx.accountId)?.name || '###') ||
           tx.description?.includes(accounts.find(a => a.id === txOut.accountId)?.name || '###')) &&
           Math.abs(new Date(tx.date).getTime() - new Date(txOut.date).getTime()) < 1000 * 60 * 5 // Within 5 minutes (heuristic)
        );

        if (txIn) {
          transfers.push({ from: txOut, to: txIn });
          processedIds.add(txOut.id);
          processedIds.add(txIn.id);
        }
      }
    });

    return transfers.sort((a, b) => new Date(b.from.date).getTime() - new Date(a.from.date).getTime());
  }, [allTransactions, accounts]);

   const getAccountName = (accountId: string): string => {
        return accounts.find(acc => acc.id === accountId)?.name || 'Unknown Account';
   };

  // --- Edit and Delete Handlers ---
   // Edit for transfers is complex as it involves two transactions. Placeholder for now.
    const openEditDialog = (transferPair: { from: Transaction, to: Transaction }) => {
        // setSelectedTransactionPair([transferPair.from, transferPair.to]);
        // setIsEditDialogOpen(true);
        toast({ title: "Info", description: "Editing transfers is not yet implemented." });
    };

    // Delete for transfers needs to remove both transactions.
     const openDeleteDialog = (transferPair: { from: Transaction, to: Transaction }) => {
        setSelectedTransactionPair([transferPair.from, transferPair.to]);
        // AlertDialog trigger will open the dialog
     };

    const handleDeleteTransferConfirm = async () => {
        if (!selectedTransactionPair || selectedTransactionPair.length !== 2) return;
        setIsDeleting(true);
        try {
            // Delete both the 'from' and 'to' transactions
            await Promise.all([
                deleteTransaction(selectedTransactionPair[0].id, selectedTransactionPair[0].accountId),
                deleteTransaction(selectedTransactionPair[1].id, selectedTransactionPair[1].accountId)
            ]);
             // Refetch data after deletion (consider a less heavy refetch if possible)
             await fetchData();
             toast({
                title: "Transfer Deleted",
                description: `Transfer record removed successfully.`,
            });
        } catch (err: any) {
            console.error("Failed to delete transfer:", err);
            toast({
                title: "Error Deleting Transfer",
                description: err.message || "Could not delete the transfer transactions.",
                variant: "destructive",
            });
        } finally {
            setIsDeleting(false);
            setSelectedTransactionPair(null); // Close confirmation dialog
        }
    };


  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
      <h1 className="text-3xl font-bold mb-6">Transfers Between Accounts</h1>

       {error && (
          <div className="mb-4 p-4 bg-destructive/10 text-destructive border border-destructive rounded-md">
              {error}
          </div>
       )}

      <Card>
        <CardHeader>
          <CardTitle>Transfer History</CardTitle>
           <CardDescription>
                Showing recent transfers between your accounts. Amounts displayed in {preferredCurrency}.
           </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : transferTransactionPairs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>From Account</TableHead>
                  <TableHead>To Account</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount ({preferredCurrency})</TableHead>
                   <TableHead className="text-right">Actions</TableHead> {/* Actions Header */}
                </TableRow>
              </TableHeader>
              <TableBody>
                {transferTransactionPairs.map((pair) => {
                    const fromAccount = getAccountForTransaction(pair.from.accountId);
                    if (!fromAccount) return null; // Should have accounts if transactions exist

                    // Amount is positive, representing the transferred value
                    const formattedAmount = formatCurrency(Math.abs(pair.from.amount), fromAccount.currency, undefined, true);

                    return (
                        <TableRow key={`${pair.from.id}-${pair.to.id}`} className="hover:bg-muted/50">
                            <TableCell className="whitespace-nowrap">{formatDate(pair.from.date)}</TableCell>
                            <TableCell className="text-muted-foreground">{getAccountName(pair.from.accountId)}</TableCell>
                            <TableCell className="text-muted-foreground">{getAccountName(pair.to.accountId)}</TableCell>
                            {/* Show description from the outgoing transaction, or a default */}
                            <TableCell>{pair.from.description || 'Transfer'}</TableCell>
                            <TableCell className="text-right font-medium">
                                {formattedAmount}
                            </TableCell>
                             {/* Actions Cell (Edit might be disabled/different for transfers) */}
                            <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                      <span className="sr-only">Open menu</span>
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {/* Edit might be disabled or show info */}
                                    <DropdownMenuItem onClick={() => openEditDialog(pair)} disabled>
                                      <Edit className="mr-2 h-4 w-4" />
                                      <span>Edit (N/A)</span>
                                    </DropdownMenuItem>
                                    {/* Delete Confirmation */}
                                     <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <div
                                                className="relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-destructive/10 focus:text-destructive text-destructive data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                                                onClick={() => openDeleteDialog(pair)}
                                            >
                                                 <Trash2 className="mr-2 h-4 w-4" />
                                                 <span>Delete</span>
                                            </div>
                                        </AlertDialogTrigger>
                                         {/* Render content only if this specific transfer pair is selected */}
                                        {selectedTransactionPair && selectedTransactionPair[0].id === pair.from.id && (
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                  <AlertDialogDescription>
                                                    This action cannot be undone. This will permanently delete both transactions related to this transfer.
                                                  </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                  <AlertDialogCancel onClick={() => setSelectedTransactionPair(null)} disabled={isDeleting}>Cancel</AlertDialogCancel>
                                                  <AlertDialogAction onClick={handleDeleteTransferConfirm} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                                    {isDeleting ? "Deleting..." : "Delete Transfer"}
                                                  </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        )}
                                    </AlertDialog>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-10">
              <p className="text-muted-foreground">
                No transfer transactions found yet.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      {/* Edit Dialog (Potentially more complex for transfers) - Placeholder */}
      {/* <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}> ... </Dialog> */}
    </div>
  );
}
