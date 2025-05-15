
'use client';

import { database, auth } from '@/lib/firebase';
import { ref, set, get, push, remove, update, serverTimestamp } from 'firebase/database';
import type { User } from 'firebase/auth';
import { supportedCurrencies } from '@/lib/currency'; // Assuming this exists

export type BudgetPeriod = 'monthly' | 'quarterly' | 'annually' | 'custom';

export interface Budget {
  id: string;
  name: string;
  amount: number;
  currency: string;
  period: BudgetPeriod;
  startDate: string; // ISO YYYY-MM-DD
  endDate?: string | null; // ISO YYYY-MM-DD, only for 'custom' period
  appliesTo: 'categories' | 'groups'; // What the budget tracks
  selectedIds: string[]; // Array of Category IDs or Group IDs
  notes?: string | null;
  createdAt?: object | string;
  updatedAt?: object | string;
}

export type NewBudgetData = Omit<Budget, 'id' | 'createdAt' | 'updatedAt'>;

export function getBudgetsRefPath(currentUser: User | null) {
  if (!currentUser?.uid) throw new Error("User not authenticated to access budgets.");
  return `users/${currentUser.uid}/budgets`;
}

export function getSingleBudgetRefPath(currentUser: User | null, budgetId: string) {
  if (!currentUser?.uid) throw new Error("User not authenticated to access budget.");
  return `users/${currentUser.uid}/budgets/${budgetId}`;
}

export async function getBudgets(): Promise<Budget[]> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.warn("getBudgets called without authenticated user, returning empty array.");
    return [];
  }
  const budgetsRefPath = getBudgetsRefPath(currentUser);
  const budgetsRef = ref(database, budgetsRefPath);

  try {
    const snapshot = await get(budgetsRef);
    if (snapshot.exists()) {
      const budgetsData = snapshot.val();
      return Object.entries(budgetsData).map(([id, data]) => {
        const budget = data as Omit<Budget, 'id'>;
        return {
          id,
          ...budget,
          selectedIds: budget.selectedIds || [],
          endDate: budget.endDate === undefined ? null : budget.endDate,
          notes: budget.notes === undefined ? null : budget.notes,
        };
      });
    }
    return [];
  } catch (error) {
    console.error("Error fetching budgets from Firebase:", error);
    throw error;
  }
}

export async function addBudget(budgetData: NewBudgetData): Promise<Budget> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("User not authenticated. Cannot add budget.");
  }
  const budgetsRefPath = getBudgetsRefPath(currentUser);
  const budgetsRef = ref(database, budgetsRefPath);
  const newBudgetRef = push(budgetsRef);

  if (!newBudgetRef.key) {
    throw new Error("Failed to generate a new budget ID.");
  }

  const newBudget: Budget = {
    ...budgetData,
    id: newBudgetRef.key,
    selectedIds: budgetData.selectedIds || [],
    endDate: budgetData.endDate === undefined ? null : budgetData.endDate,
    notes: budgetData.notes === undefined ? null : budgetData.notes,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const dataToSave = { ...newBudget } as any;
  delete dataToSave.id;

  try {
    await set(newBudgetRef, dataToSave);
    return newBudget;
  } catch (error) {
    console.error("Error adding budget to Firebase:", error);
    throw error;
  }
}

export async function updateBudget(updatedBudget: Budget): Promise<Budget> {
  const currentUser = auth.currentUser;
  const { id } = updatedBudget;
  if (!currentUser || !id) {
    throw new Error("User not authenticated or budget ID missing for update.");
  }
  const budgetRefPath = getSingleBudgetRefPath(currentUser, id);
  const budgetRef = ref(database, budgetRefPath);

  const dataToUpdate: Partial<Omit<Budget, 'id' | 'createdAt'>> & { updatedAt: object } = {
    name: updatedBudget.name,
    amount: updatedBudget.amount,
    currency: updatedBudget.currency,
    period: updatedBudget.period,
    startDate: updatedBudget.startDate,
    endDate: updatedBudget.endDate === undefined ? null : updatedBudget.endDate,
    appliesTo: updatedBudget.appliesTo,
    selectedIds: updatedBudget.selectedIds || [],
    notes: updatedBudget.notes === undefined ? null : updatedBudget.notes,
    updatedAt: serverTimestamp(),
  };

  try {
    await update(budgetRef, dataToUpdate);
    // For immediate UI update, we create a new object reflecting the changes, 
    // especially for updatedAt. Firebase serverTimestamp() returns an object,
    // but for local state, a string representation like ISOString is often more useful.
    // However, to keep it simple and consistent with how Firebase might return it later,
    // we'll merge and return. For production, you might convert serverTimestamp objects to date strings.
    const updatedLocalBudget = { ...updatedBudget, ...dataToUpdate, updatedAt: new Date().toISOString() } as Budget;
    return updatedLocalBudget;
  } catch (error) {
    console.error("Error updating budget in Firebase:", error);
    throw error;
  }
}

export async function deleteBudget(budgetId: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("User not authenticated. Cannot delete budget.");
  }
  const budgetRefPath = getSingleBudgetRefPath(currentUser, budgetId);
  const budgetRef = ref(database, budgetRefPath);
  try {
    await remove(budgetRef);
  } catch (error) {
    console.error("Error deleting budget from Firebase:", error);
    throw error;
  }
}
