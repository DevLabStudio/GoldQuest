
'use client';

import { database, auth } from '@/lib/firebase';
import { ref, set, get, push, remove, update, serverTimestamp } from 'firebase/database';
import type { User } from 'firebase/auth';

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
}

export type NewSwapData = Omit<Swap, 'id' | 'createdAt' | 'updatedAt'>;

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
      })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    return [];
  } catch (error) {
    console.error("Error fetching swaps from Firebase:", error);
    throw error;
  }
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

  const dataToSave: Omit<Swap, 'id'> = {
    ...swapData,
    feeAmount: swapData.feeAmount === undefined ? null : swapData.feeAmount,
    feeCurrency: swapData.feeCurrency === undefined ? null : swapData.feeCurrency,
    notes: swapData.notes === undefined ? null : swapData.notes,
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
    // Note: We are NOT automatically adjusting account balances here.
    // User needs to make corresponding transfers/transactions if using sub-account strategy
    // or adjust balances manually if not.
    return newSwapForApp;
  } catch (error) {
    console.error("Error adding swap to Firebase:", error);
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

  const dataToUpdate: Partial<Omit<Swap, 'id' | 'createdAt'>> & { updatedAt: object } = {
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
  const swapRef = ref(database, swapRefPath);
  try {
    await remove(swapRefPath);
  } catch (error) {
    console.error("Error deleting swap from Firebase:", error);
    throw error;
  }
}
