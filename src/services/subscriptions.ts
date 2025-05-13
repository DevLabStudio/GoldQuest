
'use client';

import { database, auth } from '@/lib/firebase';
import { ref, set, get, push, remove, update, serverTimestamp } from 'firebase/database';
import type { User } from 'firebase/auth';

export type SubscriptionFrequency = 'daily' | 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly' | 'semi-annually' | 'annually';
export type SubscriptionType = 'income' | 'expense';

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  currency: string;
  type: SubscriptionType;
  category: string;
  accountId?: string; // Optional: Link to an account
  groupId: string | null; // Optional: Link to a group, can be null
  startDate: string; // ISO string: YYYY-MM-DD
  frequency: SubscriptionFrequency;
  nextPaymentDate: string; // ISO string: YYYY-MM-DD
  notes?: string;
  tags?: string[];
  lastPaidMonth?: string | null; // YYYY-MM format, or null if not paid for the current cycle
  description?: string;
  createdAt?: object; // For server timestamp
  updatedAt?: object; // For server timestamp
}

export type NewSubscriptionData = Omit<Subscription, 'id' | 'createdAt' | 'updatedAt' | 'lastPaidMonth'> & {
    lastPaidMonth?: string | null;
    groupId?: string | null; // Ensure groupId is optional and can be null here too
};

export function getSubscriptionsRefPath(currentUser: User | null) {
  if (!currentUser?.uid) throw new Error("User not authenticated to access subscriptions.");
  return `users/${currentUser.uid}/subscriptions`;
}

export function getSingleSubscriptionRefPath(currentUser: User | null, subscriptionId: string) {
  if (!currentUser?.uid) throw new Error("User not authenticated to access subscription.");
  return `users/${currentUser.uid}/subscriptions/${subscriptionId}`;
}

export async function getSubscriptions(): Promise<Subscription[]> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.warn("getSubscriptions called without authenticated user, returning empty array.");
    return [];
  }
  const subscriptionsRefPath = getSubscriptionsRefPath(currentUser);
  const subscriptionsRef = ref(database, subscriptionsRefPath);

  try {
    const snapshot = await get(subscriptionsRef);
    if (snapshot.exists()) {
      const subscriptionsData = snapshot.val();
      return Object.entries(subscriptionsData).map(([id, data]) => {
        const subData = data as Partial<Omit<Subscription, 'id'>>; // Treat as partial initially
        return {
          id,
          name: subData.name || 'Unnamed Subscription',
          amount: typeof subData.amount === 'number' ? subData.amount : 0,
          currency: subData.currency || 'USD', // Default currency
          type: subData.type || 'expense', // Default type
          category: subData.category || 'Uncategorized',
          accountId: subData.accountId,
          groupId: subData.groupId === undefined ? null : subData.groupId, // Ensure groupId is null if undefined
          startDate: typeof subData.startDate === 'string' && subData.startDate ? subData.startDate : new Date().toISOString().split('T')[0], // Default if missing/invalid
          frequency: subData.frequency || 'monthly', // Default frequency
          nextPaymentDate: typeof subData.nextPaymentDate === 'string' && subData.nextPaymentDate ? subData.nextPaymentDate : new Date().toISOString().split('T')[0], // Default if missing/invalid
          notes: subData.notes,
          tags: subData.tags || [],
          lastPaidMonth: subData.lastPaidMonth || null,
          description: subData.description,
          createdAt: subData.createdAt,
          updatedAt: subData.updatedAt,
        };
      });
    }
    return [];
  } catch (error) {
    console.error("Error fetching subscriptions from Firebase:", error);
    throw error;
  }
}

export async function addSubscription(subscriptionData: NewSubscriptionData): Promise<Subscription> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("User not authenticated. Cannot add subscription.");
  }
  const subscriptionsRefPath = getSubscriptionsRefPath(currentUser);
  const subscriptionsRef = ref(database, subscriptionsRefPath);
  const newSubscriptionRef = push(subscriptionsRef);

  if (!newSubscriptionRef.key) {
    throw new Error("Failed to generate a new subscription ID.");
  }

  const newSubscription: Subscription = {
    ...subscriptionData,
    id: newSubscriptionRef.key,
    lastPaidMonth: subscriptionData.lastPaidMonth || null,
    groupId: subscriptionData.groupId === undefined || subscriptionData.groupId === "" ? null : subscriptionData.groupId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const dataToSave = { ...newSubscription } as any;
  delete dataToSave.id; // Firebase key is the ID

  try {
    await set(newSubscriptionRef, dataToSave);
    return newSubscription;
  } catch (error) {
    console.error("Error adding subscription to Firebase:", error);
    throw error;
  }
}

export async function updateSubscription(updatedSubscription: Subscription): Promise<Subscription> {
  const currentUser = auth.currentUser;
  const { id } = updatedSubscription;

  if (!currentUser || !id) {
      throw new Error("User not authenticated or subscription ID missing for update.");
  }
  const subscriptionRefPath = getSingleSubscriptionRefPath(currentUser, id);
  const subscriptionRef = ref(database, subscriptionRefPath);

  // Build the update object selectively to avoid sending undefined values
  const dataToUpdate: Partial<Omit<Subscription, 'id' | 'createdAt'>> & { updatedAt: object } = {
    name: updatedSubscription.name,
    amount: updatedSubscription.amount,
    currency: updatedSubscription.currency,
    type: updatedSubscription.type,
    category: updatedSubscription.category,
    startDate: updatedSubscription.startDate,
    frequency: updatedSubscription.frequency,
    nextPaymentDate: updatedSubscription.nextPaymentDate,
    tags: updatedSubscription.tags || [],
    lastPaidMonth: updatedSubscription.lastPaidMonth === undefined ? null : updatedSubscription.lastPaidMonth,
    description: updatedSubscription.description || null, // Ensure description is null if empty
    updatedAt: serverTimestamp(),
  };

  // Handle optional fields correctly, ensuring they are set to null if not provided
  // to remove them from Firebase if they were previously set.
  dataToUpdate.accountId = updatedSubscription.accountId || null; // set to null if undefined or empty
  dataToUpdate.groupId = updatedSubscription.groupId === undefined || updatedSubscription.groupId === "" ? null : updatedSubscription.groupId;
  dataToUpdate.notes = updatedSubscription.notes || null;


  try {
    await update(subscriptionRef, dataToUpdate);
    // Return a consistent object reflecting what was attempted to be saved
    return {
      ...updatedSubscription,
      accountId: dataToUpdate.accountId === null ? undefined : dataToUpdate.accountId,
      groupId: dataToUpdate.groupId,
      notes: dataToUpdate.notes === null ? undefined : dataToUpdate.notes,
      description: dataToUpdate.description === null ? undefined : dataToUpdate.description,
      lastPaidMonth: dataToUpdate.lastPaidMonth,
    };
  } catch (error) {
    console.error("Error updating subscription in Firebase:", error);
    throw error;
  }
}

export async function deleteSubscription(subscriptionId: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("User not authenticated. Cannot delete subscription.");
  }
  const subscriptionRefPath = getSingleSubscriptionRefPath(currentUser, subscriptionId);
  const subscriptionRef = ref(database, subscriptionRefPath);

  try {
    await remove(subscriptionRef);
  } catch (error) {
    console.error("Error deleting subscription from Firebase:", error);
    throw error;
  }
}

