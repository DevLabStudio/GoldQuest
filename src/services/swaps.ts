
'use client';

import { database, auth } from '@/lib/firebase';
import { ref, set, get, push, remove, update, serverTimestamp } from 'firebase/database';
import type { User } from 'firebase/auth';
import { addTransaction, getTransactions, deleteTransaction as deleteTransactionService, type Transaction } from './transactions'; // Import transaction services

export interface Swap {
  id: string;
  date: string; // ISO string: YYYY-MM-DD
  platformAccountId: string; // ID of the 'Account' entity representing the platform (e.g., Wise, Binance)
  fromAsset: string; // Currency code or crypto ticker, e.g., "EUR", "BTC"
  fromAmount: number;
  toAsset: string; // Currency code or crypto ticker, e.g., "BRL", "ETH"
  toAmount: number;
  feeAmount?: number | null;
  feeCurrency?: string | null;
  notes?: string | null;
  createdAt?: object | string;
  updatedAt?: object | string;
  relatedTransactionIds?: string[]; // To store IDs of transactions created for this swap
}

export type NewSwapData = Omit<Swap, 'id' | 'createdAt' | 'updatedAt' | 'relatedTransactionIds'>;

export function getSwapsRefPath(currentUser: User | null) {
  if (!currentUser?.uid) throw new Error("User not authenticated to access swaps.");
  return `users/${currentUser.uid}/swaps`;
}

export function getSingleSwapRefPath(currentUser: User | null, swapId: string) {
  if (!currentUser?.uid) throw new Error("User not authenticated to access swap.");
  return `users/${currentUser.uid}/swaps/${swapId}`;
}

export async function getSwaps(): Promise<Swap[]> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.warn("getSwaps called without authenticated user, returning empty array.");
    return [];
  }
  const swapsRefPath = getSwapsRefPath(currentUser);
  const swapsRef = ref(database, swapsRefPath);

  try {
    const snapshot = await get(swapsRef);
    if (snapshot.exists()) {
      const swapsData = snapshot.val();
      return Object.entries(swapsData).map(([id, data]) => ({
        id,
        ...(data as Omit<Swap, 'id'>),
        feeAmount: (data as Swap).feeAmount === undefined ? null : (data as Swap).feeAmount,
        feeCurrency: (data as Swap).feeCurrency === undefined ? null : (data as Swap).feeCurrency,
        notes: (data as Swap).notes === undefined ? null : (data as Swap).notes,
        relatedTransactionIds: (data as Swap).relatedTransactionIds || [],
      })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    return [];
  } catch (error) {
    console.error("Error fetching swaps from Firebase:", error);
    throw error;
  }
}

async function createSwapTransactions(swapData: NewSwapData, swapId: string, platformAccountId: string): Promise<string[]> {
    const transactionIds: string[] = [];
    const baseDescription = `Swap: ${swapData.fromAmount} ${swapData.fromAsset} to ${swapData.toAmount} ${swapData.toAsset}`;
    const swapTag = `goldquest-swap-leg:${swapId}`;

    // From Asset (Expense)
    const fromTx = await addTransaction({
        accountId: platformAccountId,
        amount: -Math.abs(swapData.fromAmount),
        transactionCurrency: swapData.fromAsset.toUpperCase(),
        date: swapData.date,
        description: `${baseDescription} (Sent)`,
        category: 'Transfer', // Swaps are essentially internal transfers of value
        tags: [swapTag, 'Swap Outflow'],
    });
    transactionIds.push(fromTx.id);

    // To Asset (Income)
    const toTx = await addTransaction({
        accountId: platformAccountId,
        amount: Math.abs(swapData.toAmount),
        transactionCurrency: swapData.toAsset.toUpperCase(),
        date: swapData.date,
        description: `${baseDescription} (Received)`,
        category: 'Transfer',
        tags: [swapTag, 'Swap Inflow'],
    });
    transactionIds.push(toTx.id);

    // Fee (Expense, if applicable)
    if (swapData.feeAmount && swapData.feeAmount > 0 && swapData.feeCurrency) {
        const feeTx = await addTransaction({
            accountId: platformAccountId,
            amount: -Math.abs(swapData.feeAmount),
            transactionCurrency: swapData.feeCurrency.toUpperCase(),
            date: swapData.date,
            description: `Fee for ${baseDescription}`,
            category: 'Fees', // Or a more specific fee category
            tags: [swapTag, 'Swap Fee'],
        });
        transactionIds.push(feeTx.id);
    }
    return transactionIds;
}

export async function addSwap(swapData: NewSwapData): Promise<Swap> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("User not authenticated. Cannot add swap.");
  }
  const swapsRefPath = getSwapsRefPath(currentUser);
  const swapsRef = ref(database, swapsRefPath);
  const newSwapRef = push(swapsRef);

  if (!newSwapRef.key) {
    throw new Error("Failed to generate a new swap ID.");
  }

  // Create related transactions first
  const relatedTransactionIds = await createSwapTransactions(swapData, newSwapRef.key, swapData.platformAccountId);

  const dataToSave: Omit<Swap, 'id'> = {
    ...swapData,
    feeAmount: swapData.feeAmount === undefined ? null : swapData.feeAmount,
    feeCurrency: swapData.feeCurrency === undefined ? null : swapData.feeCurrency,
    notes: swapData.notes === undefined ? null : swapData.notes,
    relatedTransactionIds,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const newSwapForApp: Swap = {
    id: newSwapRef.key,
    ...dataToSave,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    await set(newSwapRef, dataToSave);
    return newSwapForApp;
  } catch (error) {
    console.error("Error adding swap to Firebase:", error);
    // If swap save fails, attempt to roll back transactions (best effort)
    for (const txId of relatedTransactionIds) {
        try {
            await deleteTransactionService(txId, swapData.platformAccountId);
            console.log(`Rolled back transaction ${txId} for failed swap ${newSwapRef.key}`);
        } catch (rollbackError) {
            console.error(`Failed to roll back transaction ${txId} for swap ${newSwapRef.key}:`, rollbackError);
        }
    }
    throw error;
  }
}

export async function updateSwap(updatedSwap: Swap): Promise<Swap> {
  const currentUser = auth.currentUser;
  const { id } = updatedSwap;
  if (!currentUser || !id) {
    throw new Error("User not authenticated or swap ID missing for update.");
  }
  const swapRefPath = getSingleSwapRefPath(currentUser, id);
  const swapRef = ref(database, swapRefPath);

  // For now, updating a swap does NOT automatically update/recreate transactions.
  // This is a complex operation involving finding old transactions, deleting them,
  // and creating new ones, potentially with rollback logic.
  // Users should be advised to delete and recreate swaps if amounts/assets change significantly.
  const dataToUpdate: Partial<Omit<Swap, 'id' | 'createdAt' | 'relatedTransactionIds'>> & { updatedAt: object } = {
    date: updatedSwap.date,
    platformAccountId: updatedSwap.platformAccountId,
    fromAsset: updatedSwap.fromAsset,
    fromAmount: updatedSwap.fromAmount,
    toAsset: updatedSwap.toAsset,
    toAmount: updatedSwap.toAmount,
    feeAmount: updatedSwap.feeAmount === undefined ? null : updatedSwap.feeAmount,
    feeCurrency: updatedSwap.feeCurrency === undefined ? null : updatedSwap.feeCurrency,
    notes: updatedSwap.notes === undefined ? null : updatedSwap.notes,
    updatedAt: serverTimestamp(),
  };
  // Note: relatedTransactionIds are NOT updated here. They belong to the original swap creation.

  try {
    await update(swapRef, dataToUpdate);
    return { ...updatedSwap, updatedAt: new Date().toISOString() };
  } catch (error) {
    console.error("Error updating swap in Firebase:", error);
    throw error;
  }
}

export async function deleteSwap(swapId: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("User not authenticated. Cannot delete swap.");
  }
  const swapRefPath = getSingleSwapRefPath(currentUser, swapId);
  
  // Fetch the swap to get platformAccountId and relatedTransactionIds
  const swapSnapshot = await get(swapRefPath);
  if (!swapSnapshot.exists()) {
    console.warn(`Swap with ID ${swapId} not found for deletion.`);
    return; // Or throw error
  }
  const swapToDelete = swapSnapshot.val() as Swap;

  try {
    // Delete related transactions
    if (swapToDelete.relatedTransactionIds && swapToDelete.relatedTransactionIds.length > 0) {
      for (const txId of swapToDelete.relatedTransactionIds) {
        try {
          await deleteTransactionService(txId, swapToDelete.platformAccountId);
          console.log(`Deleted related transaction ${txId} for swap ${swapId}`);
        } catch (txDeleteError) {
          console.error(`Error deleting transaction ${txId} for swap ${swapId}:`, txDeleteError);
          // Decide if you want to proceed with swap deletion or throw an error
        }
      }
    }
    // Delete the swap record itself
    await remove(swapRefPath);
  } catch (error) {
    console.error("Error deleting swap from Firebase:", error);
    throw error;
  }
}
