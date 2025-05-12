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
  groupId?: string; // Optional: Link to a group
  startDate: string; // ISO string: YYYY-MM-DD
  frequency: SubscriptionFrequency;
  nextPaymentDate: string; // ISO string: YYYY-MM-DD
  notes?: string;
  tags?: string[];
  lastPaidMonth?: string | null; // YYYY-MM format, or null if not paid for the current cycle
  createdAt?: object; // For server timestamp
  updatedAt?: object; // For server timestamp
}

export type NewSubscriptionData = Omit<Subscription, 'id' | 'createdAt' | 'updatedAt' | 'lastPaidMonth'> & {
    lastPaidMonth?: string | null;
};

function getSubscriptionsRefPath(currentUser: User | null) {
  if (!currentUser?.uid) throw new Error("User not authenticated to access subscriptions.");
  return `users/${currentUser.uid}/subscriptions`;
}

function getSingleSubscriptionRefPath(currentUser: User | null, subscriptionId: string) {
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
      return Object.entries(subscriptionsData).map(([id, data]) => ({
        id,
        ...(data as Omit<Subscription, 'id'>),
        lastPaidMonth: (data as Subscription).lastPaidMonth || null, // Ensure lastPaidMonth exists
        groupId: (data as Subscription).groupId || undefined, // Ensure groupId exists
      }));
    }
    return [];
  } catch (error) {
    console.error("Error fetching subscriptions from Firebase:", error);
    throw error;
  }
}

export async function addSubscription(subscriptionData: NewSubscriptionData): Promise<Subscription> {
  const currentUser = auth.currentUser;
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
    groupId: subscriptionData.groupId || undefined,
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
  const subscriptionRefPath = getSingleSubscriptionRefPath(currentUser, id);
  const subscriptionRef = ref(database, subscriptionRefPath);

  const dataToUpdate = {
    ...updatedSubscription,
    lastPaidMonth: updatedSubscription.lastPaidMonth || null,
    groupId: updatedSubscription.groupId || undefined,
    updatedAt: serverTimestamp(),
  } as any;
  delete dataToUpdate.id;
  delete dataToUpdate.createdAt; // Don't update createdAt

  try {
    await update(subscriptionRef, dataToUpdate);
    return updatedSubscription;
  } catch (error) {
    console.error("Error updating subscription in Firebase:", error);
    throw error;
  }
}

export async function deleteSubscription(subscriptionId: string): Promise<void> {
  const currentUser = auth.currentUser;
  const subscriptionRefPath = getSingleSubscriptionRefPath(currentUser, subscriptionId);
  const subscriptionRef = ref(database, subscriptionRefPath);

  try {
    await remove(subscriptionRef);
  } catch (error) {
    console.error("Error deleting subscription from Firebase:", error);
    throw error;
  }
}