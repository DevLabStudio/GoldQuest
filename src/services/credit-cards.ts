
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
  paymentDueDate?: string | null;  // ISO string: YYYY-MM-DD for the next payment due date
  statementClosingDay?: number | null; // Day of the month (1-31) when the statement closes
  interestRate?: number | null;    // APR as a percentage, e.g., 19.99
  notes?: string | null;
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

  const newCardForApp: CreditCard = { // This object is for returning to the app
    ...cardData,
    id: newCardRef.key,
    paymentDueDate: cardData.paymentDueDate || null,
    statementClosingDay: cardData.statementClosingDay === undefined ? null : cardData.statementClosingDay,
    interestRate: cardData.interestRate === undefined ? null : cardData.interestRate,
    notes: cardData.notes || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  
  // Data to be saved to Firebase, ensuring no undefined values for optional fields
  const dataToSave: any = {
    name: cardData.name,
    bankName: cardData.bankName,
    limit: cardData.limit,
    currency: cardData.currency,
    currentBalance: cardData.currentBalance,
    paymentDueDate: cardData.paymentDueDate || null,
    statementClosingDay: cardData.statementClosingDay === undefined ? null : cardData.statementClosingDay,
    interestRate: cardData.interestRate === undefined ? null : cardData.interestRate,
    notes: cardData.notes || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };


  try {
    await set(newCardRef, dataToSave);
    // Return the version with the ID for immediate use in the app
    return { ...newCardForApp, id: newCardRef.key };
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

  const dataToUpdate: any = {
    name: updatedCard.name,
    bankName: updatedCard.bankName,
    limit: updatedCard.limit,
    currency: updatedCard.currency,
    currentBalance: updatedCard.currentBalance,
    paymentDueDate: updatedCard.paymentDueDate === undefined ? null : updatedCard.paymentDueDate,
    statementClosingDay: updatedCard.statementClosingDay === undefined ? null : updatedCard.statementClosingDay,
    interestRate: updatedCard.interestRate === undefined ? null : updatedCard.interestRate,
    notes: updatedCard.notes === undefined ? null : updatedCard.notes,
    updatedAt: serverTimestamp(),
  };
  
  // id and createdAt should not be part of the update payload itself
  // as id is the key and createdAt is set on creation.

  try {
    await update(cardRef, dataToUpdate);
    // Construct the object to return, reflecting the update (including possible nulls)
    return {
        ...updatedCard, // Start with the input data
        paymentDueDate: dataToUpdate.paymentDueDate,
        statementClosingDay: dataToUpdate.statementClosingDay,
        interestRate: dataToUpdate.interestRate,
        notes: dataToUpdate.notes,
        // updatedAt will be a server timestamp object, which is fine for the app to handle
    };
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
