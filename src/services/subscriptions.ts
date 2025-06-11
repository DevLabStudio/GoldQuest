
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
  accountId?: string | null; // Changed to allow null explicitly for Firebase
  groupId: string | null;
  startDate: string; // ISO string: YYYY-MM-DD
  frequency: SubscriptionFrequency;
  nextPaymentDate: string; // ISO string: YYYY-MM-DD
  notes?: string | null; // Changed to allow null
  tags?: string[];
  lastPaidMonth?: string | null;
  description?: string | null; // Changed to allow null
  createdAt?: object | string;
  updatedAt?: object | string;
}

export type NewSubscriptionData = Omit<Subscription, 'id' | 'createdAt' | 'updatedAt' | 'lastPaidMonth'> & {
    lastPaidMonth?: string | null;
    groupId?: string | null;
    accountId?: string | null; // Ensure this can also be null here for consistency
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
        const subData = data as Partial<Omit<Subscription, 'id'>>;
        return {
          id,
          name: subData.name || 'Unnamed Subscription',
          amount: typeof subData.amount === 'number' ? subData.amount : 0,
          currency: subData.currency || 'USD',
          type: subData.type || 'expense',
          category: subData.category || 'Uncategorized',
          accountId: subData.accountId === undefined ? null : subData.accountId,
          groupId: subData.groupId === undefined ? null : subData.groupId,
          startDate: typeof subData.startDate === 'string' && subData.startDate ? subData.startDate : new Date().toISOString().split('T')[0],
          frequency: subData.frequency || 'monthly',
          nextPaymentDate: typeof subData.nextPaymentDate === 'string' && subData.nextPaymentDate ? subData.nextPaymentDate : new Date().toISOString().split('T')[0],
          notes: subData.notes === undefined ? null : subData.notes,
          tags: subData.tags || [],
          lastPaidMonth: subData.lastPaidMonth === undefined ? null : subData.lastPaidMonth,
          description: subData.description === undefined ? null : subData.description,
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

  // Prepare data for saving, ensuring undefined optional fields become null
  const dataToSave: Omit<Subscription, 'id'> = {
    name: subscriptionData.name,
    amount: subscriptionData.amount,
    currency: subscriptionData.currency,
    type: subscriptionData.type,
    category: subscriptionData.category,
    accountId: subscriptionData.accountId === undefined ? null : subscriptionData.accountId,
    groupId: subscriptionData.groupId === undefined || subscriptionData.groupId === "" ? null : subscriptionData.groupId,
    startDate: subscriptionData.startDate,
    frequency: subscriptionData.frequency,
    nextPaymentDate: subscriptionData.nextPaymentDate,
    notes: subscriptionData.notes === undefined ? null : subscriptionData.notes,
    tags: subscriptionData.tags || [],
    lastPaidMonth: subscriptionData.lastPaidMonth === undefined ? null : subscriptionData.lastPaidMonth,
    description: subscriptionData.description === undefined ? null : subscriptionData.description,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const newSubscription: Subscription = {
    id: newSubscriptionRef.key,
    ...dataToSave, // Use the processed dataToSave which has nulls for undefined
    // serverTimestamp() returns an object, which is fine for DB, but for immediate state, we might convert/approximate
    createdAt: new Date().toISOString(), // Approximate for immediate use
    updatedAt: new Date().toISOString(), // Approximate for immediate use
  };


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
    description: updatedSubscription.description === undefined ? null : updatedSubscription.description,
    updatedAt: serverTimestamp(),
    accountId: updatedSubscription.accountId === undefined ? null : updatedSubscription.accountId,
    groupId: updatedSubscription.groupId === undefined || updatedSubscription.groupId === "" ? null : updatedSubscription.groupId,
    notes: updatedSubscription.notes === undefined ? null : updatedSubscription.notes,
  };

  try {
    await update(subscriptionRef, dataToUpdate);
    return {
      ...updatedSubscription, // Start with the input data
      accountId: dataToUpdate.accountId === null ? undefined : dataToUpdate.accountId,
      groupId: dataToUpdate.groupId,
      notes: dataToUpdate.notes === null ? undefined : dataToUpdate.notes,
      description: dataToUpdate.description === null ? undefined : dataToUpdate.description,
      lastPaidMonth: dataToUpdate.lastPaidMonth,
      updatedAt: new Date().toISOString(), // Approximate for local state
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

