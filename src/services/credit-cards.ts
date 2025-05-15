
'use client';

import { database, auth } from '@/lib/firebase';
import { ref, set, get, push, remove, update, serverTimestamp } from 'firebase/database';
import type { User } from 'firebase/auth';
import { format as formatDateFns } from 'date-fns';

export interface CreditCard {
  id: string;
  name: string;          // e.g., "Nubank Ultravioleta"
  bankName: string;      // e.g., "Nubank", "Chase"
  limit: number;         // Credit limit
  currency: string;      // e.g., "BRL", "USD"
  currentBalance: number;  // Current outstanding balance (often negative or zero)
  paymentDueDate?: string;  // ISO string: YYYY-MM-DD for the next payment due date
  statementClosingDay?: number; // Day of the month (1-31) when the statement closes
  interestRate?: number;    // APR as a percentage, e.g., 19.99
  notes?: string;
  createdAt?: object | string;
  updatedAt?: object | string;
}

export type NewCreditCardData = Omit<CreditCard, 'id' | 'createdAt' | 'updatedAt'>;

export function getCreditCardsRefPath(currentUser: User | null) {
  if (!currentUser?.uid) throw new Error("User not authenticated to access credit cards.");
  return `users/${currentUser.uid}/creditCards`;
}

export function getSingleCreditCardRefPath(currentUser: User | null, cardId: string) {
  if (!currentUser?.uid) throw new Error("User not authenticated to access credit card.");
  return `users/${currentUser.uid}/creditCards/${cardId}`;
}

export async function getCreditCards(): Promise<CreditCard[]> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.warn("getCreditCards called without authenticated user, returning empty array.");
    return [];
  }
  const creditCardsRefPath = getCreditCardsRefPath(currentUser);
  const creditCardsRef = ref(database, creditCardsRefPath);

  try {
    const snapshot = await get(creditCardsRef);
    if (snapshot.exists()) {
      const cardsData = snapshot.val();
      return Object.entries(cardsData).map(([id, data]) => ({
        id,
        ...(data as Omit<CreditCard, 'id'>),
      }));
    }
    return [];
  } catch (error) {
    console.error("Error fetching credit cards from Firebase:", error);
    throw error;
  }
}

export async function addCreditCard(cardData: NewCreditCardData): Promise<CreditCard> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("User not authenticated. Cannot add credit card.");
  }
  const creditCardsRefPath = getCreditCardsRefPath(currentUser);
  const creditCardsRef = ref(database, creditCardsRefPath);
  const newCardRef = push(creditCardsRef);

  if (!newCardRef.key) {
    throw new Error("Failed to generate a new credit card ID.");
  }

  const newCard: CreditCard = {
    ...cardData,
    id: newCardRef.key,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const dataToSave = { ...newCard } as any;
  delete dataToSave.id; // Firebase key is the ID

  try {
    await set(newCardRef, dataToSave);
    return newCard;
  } catch (error) {
    console.error("Error adding credit card to Firebase:", error);
    throw error;
  }
}

export async function updateCreditCard(updatedCard: CreditCard): Promise<CreditCard> {
  const currentUser = auth.currentUser;
  const { id } = updatedCard;
  if (!currentUser || !id) {
    throw new Error("User not authenticated or credit card ID missing for update.");
  }
  const cardRefPath = getSingleCreditCardRefPath(currentUser, id);
  const cardRef = ref(database, cardRefPath);

  const dataToUpdate: Partial<Omit<CreditCard, 'id' | 'createdAt'>> & { updatedAt: object } = {
    ...updatedCard,
    updatedAt: serverTimestamp(),
  };
  
  const dataToSave = {...dataToUpdate} as any;
  delete dataToSave.id;
  delete dataToSave.createdAt;

  try {
    await update(cardRef, dataToSave);
    return updatedCard;
  } catch (error) {
    console.error("Error updating credit card in Firebase:", error);
    throw error;
  }
}

export async function deleteCreditCard(cardId: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("User not authenticated. Cannot delete credit card.");
  }
  const cardRefPath = getSingleCreditCardRefPath(currentUser, cardId);
  const cardRef = ref(database, cardRefPath);
  try {
    await remove(cardRef);
  } catch (error) {
    console.error("Error deleting credit card from Firebase:", error);
    throw error;
  }
}
