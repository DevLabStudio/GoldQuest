
'use client';

import { database, auth } from '@/lib/firebase';
import { ref, set, get, push, remove, update, serverTimestamp } from 'firebase/database';
import type { User } from 'firebase/auth';
import { addMonths, format as formatDateFns } from 'date-fns';

export type LoanType = 'mortgage' | 'car' | 'student' | 'personal' | 'credit_card' | 'peer_to_peer' | 'other';

export const loanTypeLabels: Record<LoanType, string> = {
  mortgage: 'Mortgage',
  car: 'Car Loan',
  student: 'Student Loan',
  personal: 'Personal Loan',
  credit_card: 'Credit Card Debt',
  peer_to_peer: 'Peer-to-Peer Loan',
  other: 'Other',
};


export interface Loan {
  id: string;
  name: string; // e.g., "Car Loan", "Student Loan"
  lender: string; // e.g., "Bank X", "Government"
  originalAmount: number;
  currency: string; // e.g., "USD", "EUR", "BRL"
  interestRate: number; // Annual percentage, e.g., 5 for 5%
  termMonths: number; // e.g., 60 for 5 years
  startDate: string; // ISO string: YYYY-MM-DD
  monthlyPayment: number;
  remainingBalance: number; // Initially same as originalAmount
  nextPaymentDate: string; // Calculated: first payment date
  loanType: LoanType; // New field for loan type
  notes?: string;
  createdAt?: object | string;
  updatedAt?: object | string;
}

export type NewLoanData = Omit<Loan, 'id' | 'remainingBalance' | 'nextPaymentDate' | 'createdAt' | 'updatedAt'>;

export function getLoansRefPath(currentUser: User | null) {
  if (!currentUser?.uid) throw new Error("User not authenticated to access loans.");
  return `users/${currentUser.uid}/loans`;
}

export function getSingleLoanRefPath(currentUser: User | null, loanId: string) {
  if (!currentUser?.uid) throw new Error("User not authenticated to access loan.");
  return `users/${currentUser.uid}/loans/${loanId}`;
}

export async function getLoans(): Promise<Loan[]> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.warn("getLoans called without authenticated user, returning empty array.");
    return [];
  }
  const loansRefPath = getLoansRefPath(currentUser);
  const loansRef = ref(database, loansRefPath);

  try {
    const snapshot = await get(loansRef);
    if (snapshot.exists()) {
      const loansData = snapshot.val();
      return Object.entries(loansData).map(([id, data]) => ({
        id,
        ...(data as Omit<Loan, 'id'>),
        loanType: (data as Loan).loanType || 'other', // Default if missing
      }));
    }
    return [];
  } catch (error) {
    console.error("Error fetching loans from Firebase:", error);
    throw error;
  }
}

export async function addLoan(loanData: NewLoanData): Promise<Loan> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("User not authenticated. Cannot add loan.");
  }
  const loansRefPath = getLoansRefPath(currentUser);
  const loansRef = ref(database, loansRefPath);
  const newLoanRef = push(loansRef);

  if (!newLoanRef.key) {
    throw new Error("Failed to generate a new loan ID.");
  }

  const firstPaymentDate = addMonths(new Date(loanData.startDate), 1);

  const newLoan: Loan = {
    ...loanData,
    id: newLoanRef.key,
    remainingBalance: loanData.originalAmount, 
    nextPaymentDate: formatDateFns(firstPaymentDate, 'yyyy-MM-dd'),
    loanType: loanData.loanType || 'other',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const dataToSave = { ...newLoan } as any;
  delete dataToSave.id;

  try {
    await set(newLoanRef, dataToSave);
    return newLoan;
  } catch (error) {
    console.error("Error adding loan to Firebase:", error);
    throw error;
  }
}

export async function updateLoan(updatedLoan: Loan): Promise<Loan> {
  const currentUser = auth.currentUser;
  const { id } = updatedLoan;
  if (!currentUser || !id) {
    throw new Error("User not authenticated or loan ID missing for update.");
  }
  const loanRefPath = getSingleLoanRefPath(currentUser, id);
  const loanRef = ref(database, loanRefPath);

  const dataToUpdate: Partial<Omit<Loan, 'id' | 'createdAt'>> & { updatedAt: object } = {
    ...updatedLoan, 
    loanType: updatedLoan.loanType || 'other',
    updatedAt: serverTimestamp(),
  };
  
  const dataToSave = {...dataToUpdate} as any;
  delete dataToSave.id;
  delete dataToSave.createdAt;


  try {
    await update(loanRef, dataToSave);
    return updatedLoan; 
  } catch (error) {
    console.error("Error updating loan in Firebase:", error);
    throw error;
  }
}

export async function deleteLoan(loanId: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("User not authenticated. Cannot delete loan.");
  }
  const loanRefPath = getSingleLoanRefPath(currentUser, loanId);
  const loanRef = ref(database, loanRefPath);
  try {
    await remove(loanRef);
  } catch (error) {
    console.error("Error deleting loan from Firebase:", error);
    throw error;
  }
}
