
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { MoreHorizontal, Edit, Trash2, PlusCircle, Repeat } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

import { useAuthContext } from '@/contexts/AuthContext';
import { useDateRange } from '@/contexts/DateRangeContext';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, getCurrencySymbol } from '@/lib/currency';
import { format as formatDateFns, parseISO, isWithinInterval } from 'date-fns';

import { getSwaps, addSwap, updateSwap, deleteSwap, type Swap, type NewSwapData } from '@/services/swaps';
import { getAccounts, type Account } from '@/services/account-sync';
import AddSwapForm, { type AddSwapFormData } from '@/components/swaps/add-swap-form';
import { Skeleton } from '@/components/ui/skeleton';


const formatDate = (dateString: string): string => {
    try {
        const date = parseISO(dateString.includes('T') ? dateString : dateString + 'T00:00:00Z');
        return formatDateFns(date, 'MMM do, yyyy');
    } catch (error) {
        return 'Invalid Date';
    }
};

export default function SwapsPage() {
  const { user, isLoadingAuth, userPreferences } = useAuthContext();
  const { selectedDateRange } = useDateRange();
  const { toast } = useToast();

  const [swaps, setSwaps] = useState<Swap[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isAddSwapDialogOpen, setIsAddSwapDialogOpen] = useState(false);
  const [editingSwap, setEditingSwap] = useState<Swap | null>(null);
  const [swapToDelete, setSwapToDelete] = useState<Swap | null>(null);
  const [isDeletingSwap, setIsDeletingSwap] = useState(false);

  const preferredCurrency = useMemo(() => userPreferences?.preferredCurrency || 'BRL', [userPreferences]);

  const fetchData = useCallback(async () => {
    if (!user || isLoadingAuth) {
      setIsLoading(false);
      if (!user && !isLoadingAuth) setError("Please log in to view swaps.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [fetchedSwaps, fetchedAccounts] = await Promise.all([
        getSwaps(),
        getAccounts()
      ]);
      setSwaps(fetchedSwaps);
      setAccounts(fetchedAccounts);
    } catch (err: any) {
      console.error("Failed to fetch swap data:", err);
      setError("Could not load swap data. " + err.message);
      toast({ title: "Error", description: err.message || "Failed to load data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [user, isLoadingAuth, toast]);

  useEffect(() => {
    fetchData();
    const handleStorage = () => fetchData(); // Re-fetch data on any 'storage' event
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [fetchData]);

  const filteredSwaps = useMemo(() => {
    return swaps.filter(swap => {
      const swapDate = parseISO(swap.date.includes('T') ? swap.date : swap.date + 'T00:00:00Z');
      if (!selectedDateRange.from || !selectedDateRange.to) return true;
      return isWithinInterval(swapDate, { start: selectedDateRange.from, end: selectedDateRange.to });
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [swaps, selectedDateRange]);

  const handleSwapSubmit = async (data: NewSwapData) => {
    try {
      if (editingSwap) {
        await updateSwap({ ...editingSwap, ...data });
        toast({ title: "Success", description: "Swap updated successfully." });
      } else {
        await addSwap(data);
        toast({ title: "Success", description: "Swap recorded successfully." });
      }
      setIsAddSwapDialogOpen(false);
      setEditingSwap(null);
      fetchData(); // Refresh data
    } catch (error: any) {
      toast({ title: "Error", description: `Could not save swap: ${error.message}`, variant: "destructive" });
    }
  };

  const openEditSwapDialog = (swap: Swap) => {
    setEditingSwap(swap);
    setIsAddSwapDialogOpen(true);
  };

  const handleDeleteSwap = (swapId: string) => {
    const swap = swaps.find(s => s.id === swapId);
    if (swap) setSwapToDelete(swap);
  };

  const confirmDeleteSwap = async () => {
    if (!swapToDelete) return;
    setIsDeletingSwap(true);
    try {
      await deleteSwap(swapToDelete.id);
      toast({ title: "Success", description: "Swap record deleted." });
      setSwapToDelete(null);
      fetchData(); // Refresh data
    } catch (error: any) {
      toast({ title: "Error", description: `Could not delete swap: ${error.message}`, variant: "destructive" });
    } finally {
      setIsDeletingSwap(false);
    }
  };

  const getPlatformAccountName = (accountId: string) => accounts.find(a => a.id === accountId)?.name || 'Unknown Platform';

  const calculateEffectiveRate = (swap: Swap): string => {
    if (swap.fromAmount > 0 && swap.toAmount > 0 && swap.fromAsset && swap.toAsset) {
      const rate = swap.toAmount / swap.fromAmount;
      return `1 ${swap.fromAsset.toUpperCase()} = ${rate.toFixed(Math.max(2, Math.min(8, (rate < 0.0001 ? 10 : 6))))} ${swap.toAsset.toUpperCase()}`;
    }
    return "N/A";
  };


  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Swap Transactions</h1>
        <Dialog open={isAddSwapDialogOpen} onOpenChange={(isOpen) => {
            setIsAddSwapDialogOpen(isOpen);
            if (!isOpen) setEditingSwap(null);
        }}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> Record New Swap
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>{editingSwap ? 'Edit Swap Record' : 'Record New Swap'}</DialogTitle>
              <DialogDescription>
                Log a currency or cryptocurrency swap event. This records the details of the swap itself.
              </DialogDescription>
            </DialogHeader>
            {isLoadingAuth || (isLoading && !accounts.length) ? (<Skeleton className="h-80 w-full" />) : (
              <AddSwapForm
                key={editingSwap ? editingSwap.id : 'new-swap'}
                onSubmit={handleSwapSubmit}
                isLoading={isLoading}
                accounts={accounts}
                initialData={editingSwap || undefined}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-destructive/10 text-destructive border border-destructive rounded-md">{error}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Swap History</CardTitle>
          <CardDescription>Overview of your recorded swap activities for the selected period.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && filteredSwaps.length === 0 ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={`swap-skel-${i}`} className="h-12 w-full" />)}
            </div>
          ) : filteredSwaps.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Fee</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSwaps.map((swap) => (
                  <TableRow key={swap.id} className="hover:bg-muted/50">
                    <TableCell className="whitespace-nowrap">{formatDate(swap.date)}</TableCell>
                    <TableCell>{getPlatformAccountName(swap.platformAccountId)}</TableCell>
                    <TableCell>{formatCurrency(swap.fromAmount, swap.fromAsset, swap.fromAsset, false)}</TableCell>
                    <TableCell>{formatCurrency(swap.toAmount, swap.toAsset, swap.toAsset, false)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{calculateEffectiveRate(swap)}</TableCell>
                    <TableCell>
                      {swap.feeAmount && swap.feeAmount > 0 && swap.feeCurrency
                        ? formatCurrency(swap.feeAmount, swap.feeCurrency, swap.feeCurrency, false)
                        : '-'}
                    </TableCell>
                    <TableCell className="max-w-xs truncate" title={swap.notes || undefined}>{swap.notes || '-'}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditSwapDialog(swap)}>
                            <Edit className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <div
                                className="relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-destructive/10 focus:text-destructive text-destructive data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                                onClick={(e) => { e.stopPropagation(); handleDeleteSwap(swap.id); }}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') {e.stopPropagation(); handleDeleteSwap(swap.id);}}}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </div>
                            </AlertDialogTrigger>
                            {swapToDelete?.id === swap.id && (
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action will permanently delete this swap record for '{swap.fromAmount} {swap.fromAsset} to {swap.toAmount} {swap.toAsset}'.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel onClick={() => setSwapToDelete(null)} disabled={isDeletingSwap}>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={confirmDeleteSwap} disabled={isDeletingSwap} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    {isDeletingSwap ? "Deleting..." : "Delete Swap Record"}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            )}
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-10">
              <p className="text-muted-foreground">No swap transactions recorded for this period.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
